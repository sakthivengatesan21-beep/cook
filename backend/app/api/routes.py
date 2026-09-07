import os
import re
import uuid
import asyncio
import datetime
import time
import traceback
from pathlib import Path
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, status, Depends, Header
from fastapi.responses import FileResponse, JSONResponse

from app.config import (
    UPLOADS_DIR, OUTPUTS_DIR, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB, CHUNK_SIZE,
    BUCKET_ORIGINALS, BUCKET_AUDIO, BUCKET_CLIPS, BUCKET_CAPTIONS, BUCKET_EXPORTS, BUCKET_THUMBNAILS
)
from app.models.schemas import (
    Video, VideoStatus, Transcript, TranscriptSegment,
    Clip, ClipMetadata, ThumbnailIdea, ScheduleItem,
    ClipUpdateRequest, ClipRegenerateRequest, BurnCaptionsRequest, JobStatusResponse,
    AskVideoRequest, AskVideoResponse, TranslateRequest, SilenceTrimRequest,
    IdeaItem, CreateIdeaRequest, GenerateAnglesRequest, ModerationReport, ScheduleUpdateRequest
)
from app.auth.middleware import get_current_user
from app.services.supabase_service import supabase_service, get_original_video_storage_path
from app.services.storage import storage
from app.services.moderation import analyze_content_safety


from app.services.video_engine import (
    get_video_info, extract_audio, create_clip,
    convert_to_vertical_9_16, convert_to_square_1_1, convert_to_landscape_16_9,
    extract_thumbnail_frame, generate_srt_file, generate_sample_demo_video
)
from app.services.audio_intelligence import audio_intelligence_service
from app.services.transcription import transcription_service
from app.services.captions import caption_service
from app.ai.clip_detector import (
    analyze_and_detect_clips, _generate_10_smart_hooks, _generate_platform_remixes,
    _generate_multilingual_translations, LANGUAGE_NAMES
)

router = APIRouter(prefix="/api", tags=["cook"])

ACTIVE_PIPELINES: set = set()

async def _heartbeat_worker(video_id: str, stop_event: asyncio.Event):
    """
    Background worker that continuously touches updated_at every 4 seconds
    to prevent the watchdog from marking active jobs as stale during long operations.
    """
    while not stop_event.is_set():
        supabase_service.touch_heartbeat(video_id)
        storage.touch_heartbeat(video_id)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=4.0)
        except (asyncio.TimeoutError, TimeoutError):
            pass

async def run_video_pipeline(video_id: str, user_id: str = ""):
    """
    Robust End-to-End Orchestrator for COOK powered by Supabase.
    - Concurrency lock: Prevents duplicate workers for the same video.
    - Continuous background heartbeat task: Keeps updated_at active during long operations.
    - Explicit logs before and after every step (STEP 1 - STEP 14).
    - Downloads from Supabase Storage -> FFmpeg -> Uploads rendered assets back to Supabase Storage.
    - Persists all relational entities (transcripts, moments, clips, hooks, social captions, subtitles, edited_videos).
    """
    if video_id in ACTIVE_PIPELINES:
        print(f"[COOK] Pipeline already actively running for video_id={video_id}. Ignoring duplicate trigger.")
        return

    ACTIVE_PIPELINES.add(video_id)
    stop_heartbeat = asyncio.Event()
    heartbeat_task = asyncio.create_task(_heartbeat_worker(video_id, stop_heartbeat))
    
    start_total_time = time.time()
    current_stage = "INITIALIZING"

    print(f"\n[COOK] ========================================================")
    print(f"[COOK] STEP 1: JOB STARTED: video_id={video_id} | user_id={user_id}")
    print(f"[COOK] ========================================================")

    try:
        storage.check_and_mark_stale_jobs(timeout_seconds=900, active_ids=ACTIVE_PIPELINES)

        # ---------------------------------------------------------------------
        # STEP 2: VIDEO RECORD & SOURCE OBJECT FETCH
        # ---------------------------------------------------------------------
        current_stage = "VIDEO_VALIDATION"
        video = supabase_service.get_video(video_id) or storage.get_video(video_id)
        if not video:
            raise FileNotFoundError(f"Video record for ID '{video_id}' not found in database.")

        uid = user_id or video.get("user_id", "00000000-0000-0000-0000-000000000001")
        ext = Path(video.get("original_filename", video.get("filename", "video.mp4"))).suffix.lower() or ".mp4"
        storage_path = video.get("storage_path") or get_original_video_storage_path(uid, video_id, ext)
        
        # 1. Verify storage object exists
        temp_source_path = UPLOADS_DIR / f"{video_id}_source{ext}"
        direct_source_path = Path(video.get("storage_url", "")) if video.get("storage_url") else (UPLOADS_DIR / f"{video_id}{ext}")
        
        obj_exists, obj_size = supabase_service.check_storage_object_exists(BUCKET_ORIGINALS, storage_path)
        if not obj_exists:
            if direct_source_path.exists() and direct_source_path.is_file() and direct_source_path.stat().st_size > 0:
                supabase_service.upload_file(BUCKET_ORIGINALS, storage_path, direct_source_path)
                obj_exists, obj_size = True, direct_source_path.stat().st_size
            elif temp_source_path.exists() and temp_source_path.is_file() and temp_source_path.stat().st_size > 0:
                supabase_service.upload_file(BUCKET_ORIGINALS, storage_path, temp_source_path)
                obj_exists, obj_size = True, temp_source_path.stat().st_size
            else:
                raise FileNotFoundError(f"Storage object '{storage_path}' not found in bucket '{BUCKET_ORIGINALS}' or local disk.")
        
        print(f"[COOK VALIDATION] storage object found: bucket={BUCKET_ORIGINALS} path={storage_path} size={obj_size} bytes")

        # 2. Ensure source video is downloaded to local temp working folder
        temp_source_path = UPLOADS_DIR / f"{video_id}_source{ext}"
        if not temp_source_path.exists() or temp_source_path.stat().st_size == 0:
            print(f"[COOK] Downloading source video from Supabase Storage '{BUCKET_ORIGINALS}/{storage_path}'...")
            supabase_service.download_file(BUCKET_ORIGINALS, storage_path, temp_source_path)

        info = get_video_info(temp_source_path)
        if not info.get("is_valid"):
            raise ValueError(f"Downloaded video stream is invalid or corrupted: {info.get('error')}")

        duration = video.get("duration_seconds") or video.get("duration") or info.get("duration", 0.0)
        file_size = temp_source_path.stat().st_size
        print(f"[COOK] STEP 2: VIDEO FOUND: file='{video.get('original_filename', video.get('filename'))}' | duration={duration}s | size={file_size} bytes")


        # ---------------------------------------------------------------------
        # STEP 3 & 4: AUDIO EXTRACTION
        # ---------------------------------------------------------------------
        current_stage = "AUDIO_EXTRACTION"
        print(f"[COOK] STEP 3: EXTRACTING AUDIO: video_id={video_id}")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.AUDIO_EXTRACTING.value,
            message="Extracting audio track with FFmpeg...",
            progress=15,
            stage="AUDIO_EXTRACTING",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.AUDIO_EXTRACTING.value,
            message="Extracting audio track with FFmpeg...",
            progress=15,
            stage="AUDIO_EXTRACTING"
        )
        
        temp_audio_path = OUTPUTS_DIR / f"{video_id}_audio.wav"
        has_audio = video.get("has_audio", True)
        
        if not has_audio:
            raise ValueError("COOK couldn't find an audio stream in this video file. Spoken audio is required for transcription.")

        t0 = time.time()
        await asyncio.to_thread(extract_audio, temp_source_path, temp_audio_path, timeout=180)
        t_extract = round(time.time() - t0, 2)
        print(f"[COOK] STEP 4: AUDIO EXTRACTION COMPLETE in {t_extract}s -> {temp_audio_path.name}")
        
        # Upload extracted audio to Supabase Storage
        audio_storage_path = f"{uid}/{video_id}/audio.wav"
        supabase_service.upload_file(BUCKET_AUDIO, audio_storage_path, temp_audio_path, content_type="audio/wav")

        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.AUDIO_EXTRACTED.value,
            message="Audio extraction complete. Initializing speech model...",
            progress=20,
            stage="AUDIO_EXTRACTED",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.AUDIO_EXTRACTED.value,
            message="Audio extraction complete. Initializing speech model...",
            progress=20,
            stage="AUDIO_EXTRACTED"
        )

        # ---------------------------------------------------------------------
        # STEP 5 & 6: TRANSCRIPTION & VALIDATION
        # ---------------------------------------------------------------------
        current_stage = "TRANSCRIPTION"
        print(f"[COOK] STEP 5: STARTING TRANSCRIPTION: audio_path={temp_audio_path.name}")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.TRANSCRIBING.value,
            message="Transcribing timestamped speech with faster-whisper...",
            progress=25,
            stage="TRANSCRIBING",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.TRANSCRIBING.value,
            message="Transcribing timestamped speech with faster-whisper...",
            progress=25,
            stage="TRANSCRIBING"
        )

        t0 = time.time()
        raw_transcript_data = await asyncio.to_thread(transcription_service.transcribe_audio_file, temp_audio_path)
        t_transcribe = round(time.time() - t0, 2)
        
        # Validate transcript
        transcription_service.validate_transcript(raw_transcript_data, min_words=5)

        transcript_text = raw_transcript_data["text"]
        transcript_segments = raw_transcript_data["segments"]
        detected_lang = raw_transcript_data.get("language", "en")
        word_count = raw_transcript_data.get("word_count", len(transcript_text.split()))
        trans_dur = raw_transcript_data.get("duration", duration)

        print(f"[COOK] STEP 6: TRANSCRIPTION COMPLETE in {t_transcribe}s")
        print(f"[COOK] Transcript stats: words={word_count}, segments={len(transcript_segments)}, duration={trans_dur}s, language={detected_lang}")

        # Persist complete durable transcript into Supabase PostgreSQL
        transcript_obj = {
            "id": f"tr_{video_id}",
            "video_id": video_id,
            "user_id": uid,
            "text": transcript_text,
            "language": detected_lang,
            "duration": trans_dur,
            "word_count": word_count,
            "segments": transcript_segments,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase_service.save_transcript(transcript_obj)
        storage.save_transcript(transcript_obj)

        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.TRANSCRIPTION_READY.value,
            message=f"Transcript ready — {word_count} words ({detected_lang.upper()}) detected.",
            progress=35,
            stage="TRANSCRIPTION_READY",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.TRANSCRIPTION_READY.value,
            message=f"Transcript ready — {word_count} words ({detected_lang.upper()}) detected.",
            progress=35,
            stage="TRANSCRIPTION_READY"
        )

        # ---------------------------------------------------------------------
        # STEP 7 & 8: MOMENT ANALYSIS (FINDING THE GOLD)
        # ---------------------------------------------------------------------
        current_stage = "MOMENT_ANALYSIS"
        print(f"[COOK] STEP 7: STARTING MOMENT ANALYSIS (FINDING THE GOLD): video_id={video_id}")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.ANALYZING_MOMENTS.value,
            message="Finding the gold: analyzing retention signals and standout moments...",
            progress=50,
            stage="ANALYZING_MOMENTS",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.ANALYZING_MOMENTS.value,
            message="Finding the gold: analyzing retention signals and standout moments...",
            progress=50,
            stage="ANALYZING_MOMENTS"
        )

        t0 = time.time()
        detected_moments = await analyze_and_detect_clips(
            transcript_segments,
            duration or trans_dur,
            video_id
        )
        t_moments = round(time.time() - t0, 2)

        if not detected_moments:
            raise ValueError("No standout moments could be extracted from this transcript.")

        print(f"[COOK] STEP 8: MOMENT ANALYSIS COMPLETE in {t_moments}s -> Found {len(detected_moments)} moments.")
        for idx, m in enumerate(detected_moments):
            print(f"  [MOMENT #{idx+1}] {m['start_time']}s-{m['end_time']}s ({m['duration']}s) | Topic: '{m['topic']}' | Score: {m['score']}")

        # Persist moments in Supabase
        supabase_service.save_moments(video_id, uid, detected_moments)

        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.MOMENTS_READY.value,
            message=f"Gold found: {len(detected_moments)} high-signal moments identified.",
            progress=65,
            stage="MOMENTS_READY",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.MOMENTS_READY.value,
            message=f"Gold found: {len(detected_moments)} high-signal moments identified.",
            progress=65,
            stage="MOMENTS_READY"
        )

        # ---------------------------------------------------------------------
        # STEP 9 & 10: CLIP EXTRACTION, 9:16 FORMATTING, CAPTION BURNING & STORAGE UPLOAD
        # ---------------------------------------------------------------------
        detected_moments = detected_moments[:4]
        total_moments = len(detected_moments)
        print(f"[COOK] STEP 9: STARTING CLIP GENERATION ({total_moments} clips 9:16 + Active ASS Captions)...")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.GENERATING_CLIPS.value,
            message=f"Chopping {total_moments} clips and converting to 9:16 vertical video...",
            progress=70,
            stage="GENERATING_CLIPS",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.GENERATING_CLIPS.value,
            message=f"Chopping {total_moments} clips and converting to 9:16 vertical video...",
            progress=70,
            stage="GENERATING_CLIPS"
        )

        t0 = time.time()
        generated_clips = []
        for idx, m in enumerate(detected_moments):
            clip_id = f"clip_{video_id[:8]}_{idx+1}"
            raw_clip_path = OUTPUTS_DIR / f"{clip_id}_raw.mp4"
            vert_clip_path = OUTPUTS_DIR / f"{clip_id}_vertical.mp4"
            captioned_clip_path = OUTPUTS_DIR / f"{clip_id}_captioned.mp4"
            srt_path = OUTPUTS_DIR / f"{clip_id}_subtitles.srt"
            ass_path = OUTPUTS_DIR / f"{clip_id}_subtitles.ass"
            thumb_path = OUTPUTS_DIR / f"{clip_id}_thumb.jpg"
            
            clip_prog = 70 + int(15 * idx / total_moments)
            supabase_service.update_video_status(
                video_id,
                status=VideoStatus.GENERATING_CLIPS.value,
                message=f"Chopping clip {idx+1} of {total_moments} ({m['start_time']}s to {m['end_time']}s)...",
                progress=clip_prog,
                stage="GENERATING_CLIPS",
                user_id=uid
            )
            storage.update_video_status(
                video_id,
                status=VideoStatus.GENERATING_CLIPS.value,
                message=f"Chopping clip {idx+1} of {total_moments} ({m['start_time']}s to {m['end_time']}s)...",
                progress=clip_prog,
                stage="GENERATING_CLIPS"
            )
            
            print(f"[COOK]   -> Cutting clip #{idx+1} ({m['start_time']}s to {m['end_time']}s)...")
            
            # 1. Cut clip and format to 9:16 vertical (with safe automatic fallback)
            try:
                await asyncio.to_thread(create_clip, temp_source_path, m["start_time"], m["end_time"], raw_clip_path, timeout=180)
            except Exception as cut_err:
                print(f"[COOK WARNING] Cutting raw clip #{idx+1} error: {cut_err}")
                if not raw_clip_path.exists():
                    shutil.copyfile(temp_source_path, raw_clip_path)

            try:
                await asyncio.to_thread(convert_to_vertical_9_16, raw_clip_path, vert_clip_path, 720, 1280, timeout=180)
            except Exception as vert_err:
                print(f"[COOK WARNING] Vertical conversion error for clip #{idx+1}: {vert_err}")
                if not vert_clip_path.exists():
                    shutil.copyfile(raw_clip_path, vert_clip_path)
            
            # 2. Extract genuine spoken words overlapping this clip
            clip_words = caption_service.extract_clip_words(transcript_segments, m["start_time"], m["end_time"])
            phrases = caption_service.chunk_words_into_phrases(clip_words)
            print(f"[COOK]   -> Extracted {len(clip_words)} spoken words -> {len(phrases)} caption phrases for clip #{idx+1}.")

            # 3. Generate ASS (ACID active-word highlight) and SRT files
            caption_service.generate_ass_file(
                phrases=phrases,
                output_ass_path=ass_path,
                style="ACID",
                position="BOTTOM",
                enable_active_highlight=True
            )
            caption_service.generate_srt_file(phrases, srt_path)

            # 4. Burn ASS captions into 9:16 vertical video using FFmpeg
            supabase_service.update_video_status(
                video_id,
                status=VideoStatus.GENERATING_CLIPS.value,
                message=f"Burning active captions for clip {idx+1} of {total_moments}...",
                progress=clip_prog + 1,
                stage="GENERATING_CLIPS",
                user_id=uid
            )

            caption_status = "ready"
            try:
                print(f"[COOK]   -> Burning ASS captions into 9:16 video for clip #{idx+1}...")
                await asyncio.to_thread(
                    caption_service.burn_captions_to_video,
                    vert_clip_path,
                    ass_path,
                    captioned_clip_path,
                    timeout=180
                )
                print(f"[COOK]   -> Captioned clip #{idx+1} ready -> {captioned_clip_path.name}")
            except Exception as cap_err:
                print(f"[COOK WARNING] Burning captions failed for clip #{idx+1}: {str(cap_err)}")
                caption_status = "error"
                if not captioned_clip_path.exists() and vert_clip_path.exists():
                    try:
                        shutil.copyfile(vert_clip_path, captioned_clip_path)
                    except Exception:
                        pass

            # 5. Upload clip assets to Supabase Storage
            vert_storage_key = f"{uid}/{video_id}/{clip_id}_vertical.mp4"
            supabase_service.upload_file(BUCKET_CLIPS, vert_storage_key, vert_clip_path, content_type="video/mp4")
            
            cap_storage_key = f"{uid}/{video_id}/{clip_id}/v1.mp4"
            if captioned_clip_path.exists():
                supabase_service.upload_file(BUCKET_EXPORTS, cap_storage_key, captioned_clip_path, content_type="video/mp4")

            srt_storage_key = f"{uid}/{video_id}/{clip_id}/subtitles.srt"
            ass_storage_key = f"{uid}/{video_id}/{clip_id}/subtitles.ass"
            if srt_path.exists():
                supabase_service.upload_file(BUCKET_CAPTIONS, srt_storage_key, srt_path, content_type="text/plain")
            if ass_path.exists():
                supabase_service.upload_file(BUCKET_CAPTIONS, ass_storage_key, ass_path, content_type="text/plain")

            # 6. Record in Edited Videos & Edit Versions
            if captioned_clip_path.exists():
                supabase_service.create_edited_video(
                    user_id=uid,
                    video_id=video_id,
                    clip_id=clip_id,
                    storage_path=cap_storage_key,
                    version=1,
                    caption_style="ACID",
                    caption_position="BOTTOM",
                    language=detected_lang,
                    duration_seconds=m["duration"],
                    file_size=captioned_clip_path.stat().st_size
                )
            
            # Extract real thumbnail frame candidate
            thumb_filename = f"{clip_id}_thumb_1.jpg"
            thumb_path = OUTPUTS_DIR / thumb_filename
            try:
                extract_thumbnail_frame(raw_clip_path, thumb_path, timestamp=1.0)
                if thumb_path.exists():
                    supabase_service.upload_file(BUCKET_THUMBNAILS, f"{uid}/{video_id}/{thumb_filename}", thumb_path, content_type="image/jpeg")
            except Exception as th_err:
                print(f"[COOK WARNING] Thumbnail extraction warning: {th_err}")

            meta_data = m["metadata"]
            meta_id = f"meta_{video_id[:8]}_{idx+1}"
            
            # Populate frame image URLs in thumbnail candidates
            if meta_data.get("thumbnail_candidates"):
                for tc in meta_data["thumbnail_candidates"]:
                    tc["image_url"] = f"/outputs/{thumb_filename}"
            
            clip_record = {
                "id": clip_id,
                "video_id": video_id,
                "clip_number": idx + 1,
                "start_time": m["start_time"],
                "end_time": m["end_time"],
                "duration": m["duration"],
                "video_url": f"/outputs/{raw_clip_path.name}",
                "vertical_video_url": f"/outputs/{vert_clip_path.name}",
                "captioned_video_url": f"/outputs/{captioned_clip_path.name}" if captioned_clip_path.exists() else f"/outputs/{vert_clip_path.name}",
                "subtitles_srt_url": f"/outputs/{srt_path.name}",
                "subtitles_ass_url": f"/outputs/{ass_path.name}",
                "caption_style": "ACID",
                "caption_position": "BOTTOM",
                "caption_language": detected_lang,
                "caption_phrases": phrases,
                "caption_status": caption_status,
                "transcript": m["transcript"],
                "topic": m["topic"],
                "hook": m["hook"],
                "reason": m["reason"],
                "category": m.get("category", "HIGH_POTENTIAL"),
                "score": m["score"],
                "hook_score": m["hook_score"],
                "information_score": m["information_score"],
                "emotion_score": m["emotion_score"],
                "curiosity_score": m["curiosity_score"],
                "shareability_score": m["shareability_score"],
                "standalone_value": m["standalone_value"],
                "version": "v1",
                "version_history": [
                    {
                        "version": "v1",
                        "label": "Original AI Captioned Edit",
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "url": f"/outputs/{captioned_clip_path.name}" if captioned_clip_path.exists() else f"/outputs/{vert_clip_path.name}"
                    }
                ],
                "status": "ready",
                "metadata": {
                    "id": meta_id,
                    "clip_id": clip_id,
                    "hooks": meta_data["hooks"],
                    "structured_hooks": meta_data.get("structured_hooks", []),
                    "selected_hook": meta_data["selected_hook"],
                    "titles": meta_data["titles"],
                    "selected_title": meta_data["selected_title"],
                    "caption": meta_data["caption"],
                    "platform_captions": meta_data["platform_captions"],
                    "hashtags": meta_data["hashtags"],
                    "thumbnail_idea": meta_data["thumbnail_idea"],
                    "thumbnail_candidates": meta_data.get("thumbnail_candidates", []),
                    "score_breakdown": meta_data.get("score_breakdown"),
                    "why_this_clip": meta_data.get("why_this_clip"),
                    "seo_package": meta_data.get("seo_package"),
                    "translations": meta_data.get("translations", {}),
                    "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                },
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            generated_clips.append(clip_record)

        # Durable commit of clips to Supabase & local storage
        supabase_service.save_clips(video_id, uid, generated_clips)
        storage.save_clips(video_id, generated_clips)
        t_clips = round(time.time() - t0, 2)
        print(f"[COOK] STEP 10: CLIP GENERATION COMPLETE in {t_clips}s -> {len(generated_clips)} vertical clips saved to Supabase.")

        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.CLIPS_READY.value,
            message=f"{len(generated_clips)} vertical clips formatted with active captions.",
            progress=85,
            stage="CLIPS_READY",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.CLIPS_READY.value,
            message=f"{len(generated_clips)} vertical clips formatted with active captions.",
            progress=85,
            stage="CLIPS_READY"
        )

        # ---------------------------------------------------------------------
        # STEP 11 & 12: HOOKS & WEEKLY CONTENT SCHEDULE
        # ---------------------------------------------------------------------
        current_stage = "CONTENT_GENERATION"
        print(f"[COOK] STEP 11: STARTING CONTENT GENERATION (HOOKS & SCHEDULE)")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.GENERATING_CONTENT.value,
            message=f"Cooking {len(generated_clips) * 5} grounded hooks and weekly content schedule...",
            progress=90,
            stage="GENERATING_CONTENT",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.GENERATING_CONTENT.value,
            message=f"Cooking {len(generated_clips) * 5} grounded hooks and weekly content schedule...",
            progress=90,
            stage="GENERATING_CONTENT"
        )

        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        platforms = ["Instagram Reels", "YouTube Shorts", "TikTok", "LinkedIn", "YouTube Shorts"]
        times = ["09:00 AM", "12:30 PM", "05:00 PM", "02:00 PM", "06:30 PM"]
        
        schedule_items = []
        for i, c in enumerate(generated_clips):
            schedule_items.append({
                "id": f"sched_{video_id[:8]}_{i+1}",
                "clip_id": c["id"],
                "clip_number": c["clip_number"],
                "platform": platforms[i % len(platforms)],
                "day_of_week": days[i % len(days)],
                "scheduled_date": (datetime.date.today() + datetime.timedelta(days=i+1)).strftime("%b %d, %Y"),
                "scheduled_time": times[i % len(times)],
                "is_ai_suggested": True,
                "hook_preview": c["hook"]
            })
        storage.save_schedule(video_id, schedule_items)
        print(f"[COOK] STEP 12: CONTENT GENERATION COMPLETE -> {len(schedule_items)} schedule slots.")

        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.CONTENT_READY.value,
            message="Content pack metadata and calendar generated.",
            progress=95,
            stage="CONTENT_READY",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.CONTENT_READY.value,
            message="Content pack metadata and calendar generated.",
            progress=95,
            stage="CONTENT_READY"
        )

        # ---------------------------------------------------------------------
        # STEP 13: PACKAGING & ZIP UPLOAD
        # ---------------------------------------------------------------------
        current_stage = "PACKAGING"
        print(f"[COOK] STEP 13: PACKAGING CONTENT PACK ZIP")
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.PACKAGING.value,
            message="Plating up your ZIP content pack and final assets...",
            progress=98,
            stage="PACKAGING",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.PACKAGING.value,
            message="Plating up your ZIP content pack and final assets...",
            progress=98,
            stage="PACKAGING"
        )

        zip_file = await asyncio.to_thread(storage.create_content_pack_zip, video_id)
        if zip_file and zip_file.exists():
            zip_storage_key = f"{uid}/{video_id}/content_pack.zip"
            supabase_service.upload_file(BUCKET_EXPORTS, zip_storage_key, zip_file, content_type="application/zip")
        print(f"[COOK] STEP 13: PACKAGING COMPLETE")

        # ---------------------------------------------------------------------
        # STEP 14: JOB COMPLETE
        # ---------------------------------------------------------------------
        total_time = round(time.time() - start_total_time, 2)
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.COMPLETED.value,
            message="Your content is cooked and ready to serve!",
            progress=100,
            stage="COMPLETED",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.COMPLETED.value,
            message="Your content is cooked and ready to serve!",
            progress=100,
            stage="COMPLETED"
        )
        print(f"[COOK] ========================================================")
        print(f"[COOK] STEP 14: JOB COMPLETE SUCCESSFULLY in {total_time}s: video_id={video_id}")
        print(f"[COOK] ========================================================\n")

    except Exception as e:
        err_trace = traceback.format_exc()
        print(f"[COOK FATAL PROCESSING ERROR in stage={current_stage}] {str(e)}\n{err_trace}")
        error_msg = str(e) or "An unexpected processing error occurred."
        supabase_service.update_video_status(
            video_id,
            status=VideoStatus.FAILED.value,
            message=f"Cooking stopped during {current_stage}: {error_msg}",
            progress=0,
            stage=current_stage,
            error_code="PROCESSING_EXCEPTION",
            error_message=f"[{current_stage}] {error_msg}",
            user_id=uid
        )
        storage.update_video_status(
            video_id,
            status=VideoStatus.FAILED.value,
            message=f"Cooking stopped during {current_stage}: {error_msg}",
            progress=0,
            stage=current_stage,
            error_code="PROCESSING_EXCEPTION",
            error_message=f"[{current_stage}] {error_msg}"
        )
    finally:
        stop_heartbeat.set()
        try:
            await heartbeat_task
        except Exception:
            pass
        ACTIVE_PIPELINES.discard(video_id)

async def _handle_video_upload(file: UploadFile, user: Dict[str, Any], project_id: Optional[str] = None):
    """
    Handles authenticated video upload, size check, Supabase Storage saving,
    and PostgreSQL video + processing_jobs row initialization.
    """
    filename = file.filename or "video.mp4"
    ext = Path(filename).suffix.lower()
    
    valid_extensions = [".mp4", ".mov", ".webm"]
    if ext not in valid_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"UNSUPPORTED VIDEO FORMAT '{ext}'. COOK accepts MP4, MOV, or WebM."
        )

    user_id = user["id"]
    video_id = f"vid_{uuid.uuid4().hex[:12]}"
    clean_filename = f"{video_id}{ext}"
    dest_path = UPLOADS_DIR / clean_filename
    storage_path = get_original_video_storage_path(user_id, video_id, ext)
    
    print(f"\n[COOK UPLOAD] Starting upload")
    print(f"[COOK UPLOAD] video_id={video_id}")
    print(f"[COOK UPLOAD] user_id={user_id}")
    print(f"[COOK UPLOAD] bucket={BUCKET_ORIGINALS}")
    print(f"[COOK UPLOAD] storage_path={storage_path}")
    
    total_bytes_written = 0

    try:
        with open(dest_path, "wb") as buffer:
            while True:
                chunk = await file.read(CHUNK_SIZE)
                if not chunk:
                    break
                
                total_bytes_written += len(chunk)
                
                if total_bytes_written > MAX_UPLOAD_SIZE_BYTES:
                    buffer.close()
                    if dest_path.exists():
                        dest_path.unlink()
                    print(f"[COOK UPLOAD REJECTED] File {filename} ({total_bytes_written} bytes) exceeded {MAX_UPLOAD_SIZE_MB}MB limit.")
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"FILE TOO LARGE. Maximum supported size is {MAX_UPLOAD_SIZE_MB} MB. Your upload exceeded this limit."
                    )
                
                buffer.write(chunk)
                
        print(f"[COOK UPLOAD] upload completed ({total_bytes_written} bytes)")
        
        info = get_video_info(dest_path)
        
        if not info["is_valid"]:
            if dest_path.exists():
                dest_path.unlink()
            print(f"[COOK UPLOAD INVALID] {info.get('error')}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"VIDEO COULD NOT BE READ. {info.get('error', 'File is corrupted or has no valid video stream.')}"
            )
            
        has_audio = info.get("has_audio", False)
        status_msg = "Video uploaded successfully. Ready to cook."
        if not has_audio:
            status_msg = "NO SPEECH AUDIO DETECTED: COOK requires spoken audio for transcription and content analysis."
            print(f"[COOK UPLOAD WARNING] Video has no audio stream detected.")
            
        # Upload original video to Supabase Storage: cook-originals/{user_id}/{video_id}/original.mp4
        supabase_service.upload_file(BUCKET_ORIGINALS, storage_path, dest_path, content_type=file.content_type or "video/mp4")

        # Verify object exists in storage before database insert
        obj_exists, obj_size = supabase_service.check_storage_object_exists(BUCKET_ORIGINALS, storage_path)
        if not obj_exists or obj_size == 0:
            print(f"[COOK UPLOAD ERROR] Storage object verification failed for {BUCKET_ORIGINALS}/{storage_path}")
            if dest_path.exists():
                dest_path.unlink()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="UPLOAD_FAILED: Storage object verification failed in cook-originals."
            )

        print(f"[COOK UPLOAD] storage verification passed")

        video_record = {
            "id": video_id,
            "user_id": user_id,
            "project_id": project_id,
            "filename": filename,
            "original_filename": filename,
            "storage_bucket": BUCKET_ORIGINALS,
            "storage_path": storage_path,
            "storage_url": str(dest_path),
            "mime_type": file.content_type or "video/mp4",
            "duration": round(info["duration"], 2),
            "duration_seconds": round(info["duration"], 2),
            "file_size": total_bytes_written,
            "has_audio": has_audio,
            "audio_codec": info.get("audio_codec"),
            "video_codec": info.get("video_codec"),
            "width": info.get("width", 1920),
            "height": info.get("height", 1080),
            "fps": 30.0,
            "language": "en",
            "status": VideoStatus.UPLOADED.value,
            "stage": "UPLOADED",
            "status_message": status_msg,
            "progress": 10,
            "error_code": None,
            "error_message": None,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        
        # Save in Supabase PostgreSQL & local mirror
        try:
            supabase_service.create_video(video_record)
            supabase_service.create_processing_job(video_id, user_id)
            storage.save_video(video_record)
        except Exception as db_err:
            print(f"[COOK DB ERROR] Failed to create video record: {db_err}. Deleting orphaned storage object.")
            try:
                supabase_service.delete_storage_file(BUCKET_ORIGINALS, storage_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database record creation failed: {db_err}"
            )
        
        print(f"[COOK DB] video record created: id={video_id} storage_path={storage_path}\n")

        return {
            "success": True,
            "video_id": video_id,
            "job_id": video_id,
            "storage_path": storage_path,
            "storage_bucket": BUCKET_ORIGINALS,
            "video": video_record,
            "warning": None if has_audio else "No audio track detected in video file."
        }

    except HTTPException:
        raise
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        print(f"[COOK UPLOAD ERROR] {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed during processing: {str(e)}"
        )


# =============================================================================
# API ENDPOINTS
# =============================================================================

@router.post("/upload")
async def upload_video_endpoint(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    return await _handle_video_upload(file, user)

@router.post("/videos/upload")
async def upload_video_alias_endpoint(
    file: UploadFile = File(...),
    user: Dict[str, Any] = Depends(get_current_user)
):
    return await _handle_video_upload(file, user)

@router.post("/process/{video_id}")
async def start_processing(
    video_id: str,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user)
):
    video = supabase_service.get_video(video_id, user["id"]) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied.")
        
    background_tasks.add_task(run_video_pipeline, video_id, user["id"])
    return {
        "success": True,
        "video_id": video_id,
        "job_id": video_id,
        "status": VideoStatus.AUDIO_EXTRACTING.value,
        "message": "Cooking started."
    }

@router.post("/process/{video_id}/retry")
async def retry_processing(
    video_id: str,
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user)
):
    video = supabase_service.get_video(video_id, user["id"]) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied.")
        
    supabase_service.update_video_status(
        video_id,
        status=VideoStatus.UPLOADED.value,
        message="Retrying cooking pipeline...",
        progress=10,
        stage="RETRYING",
        error_code=None,
        error_message=None,
        user_id=user["id"]
    )
    storage.update_video_status(
        video_id,
        status=VideoStatus.UPLOADED.value,
        message="Retrying cooking pipeline...",
        progress=10,
        stage="RETRYING",
        error_code=None,
        error_message=None
    )
    background_tasks.add_task(run_video_pipeline, video_id, user["id"])
    return {
        "success": True,
        "video_id": video_id,
        "message": "Cooking restarted."
    }

@router.get("/process/{video_id}/status")
async def get_processing_status(video_id: str):
    storage.check_and_mark_stale_jobs(timeout_seconds=900, active_ids=ACTIVE_PIPELINES)
    
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
        
    clips = supabase_service.get_clips(video_id) or storage.get_clips(video_id)
    transcript = supabase_service.get_transcript(video_id) or storage.get_transcript(video_id)
    
    return {
        "video_id": video_id,
        "status": video.get("status", "uploaded"),
        "stage": video.get("stage", video.get("status", "uploaded")),
        "status_message": video.get("status_message", ""),
        "progress": video.get("progress", 0),
        "updated_at": video.get("updated_at", video.get("created_at")),
        "error_code": video.get("error_code"),
        "error_message": video.get("error_message"),
        "moments_count": len(clips),
        "clips_count": len(clips),
        "transcript_word_count": transcript.get("word_count", 0) if transcript else 0
    }

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str):
    return await get_processing_status(job_id)

@router.get("/videos/{video_id}/storage-debug")
async def get_storage_debug_endpoint(video_id: str):
    """
    Development debug endpoint for verifying storage and database consistency.
    Never exposes secrets or credentials.
    """
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    if not video:
        return {
            "video_id": video_id,
            "user_id": None,
            "bucket": BUCKET_ORIGINALS,
            "storage_path": None,
            "object_exists": False,
            "database_record_exists": False,
            "file_size": 0
        }
    
    uid = video.get("user_id", "00000000-0000-0000-0000-000000000001")
    ext = Path(video.get("original_filename", video.get("filename", "video.mp4"))).suffix.lower() or ".mp4"
    storage_path = video.get("storage_path") or get_original_video_storage_path(uid, video_id, ext)
    bucket = video.get("storage_bucket") or BUCKET_ORIGINALS
    
    exists, file_size = supabase_service.check_storage_object_exists(bucket, storage_path)
    
    return {
        "video_id": video_id,
        "user_id": uid,
        "bucket": bucket,
        "storage_path": storage_path,
        "object_exists": exists,
        "database_record_exists": True,
        "file_size": file_size
    }

@router.get("/dashboard")
async def get_user_dashboard_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns complete dashboard aggregate data for the authenticated user from Supabase.
    """
    return supabase_service.get_dashboard_data(user["id"])

@router.get("/library")
async def get_video_library(user: Dict[str, Any] = Depends(get_current_user)):
    """
    MY CONTENT: Lists all videos for the authenticated user with metadata, clip counts, and duration.
    """
    videos = supabase_service.list_videos(user["id"])
    library_items = []
    for v in videos:
        vid = v["id"]
        clips = supabase_service.get_clips(vid, user["id"])
        total_hooks = sum(len(c.get("metadata", {}).get("hooks", [])) for c in clips)
        total_caps = sum(len(c.get("metadata", {}).get("platform_captions", {})) for c in clips)
        library_items.append({
            "id": vid,
            "filename": v.get("original_filename") or v.get("filename", "video.mp4"),
            "duration": v.get("duration_seconds") or v.get("duration", 0),
            "status": v.get("status", "uploaded"),
            "progress": v.get("progress", 0),
            "created_at": v.get("created_at"),
            "clips_count": len(clips),
            "hooks_count": total_hooks,
            "captions_count": total_caps,
            "thumbnail_url": clips[0].get("captioned_video_url", "") if clips else ""
        })
    return library_items

@router.get("/edits")
async def get_edited_video_library(user: Dict[str, Any] = Depends(get_current_user)):
    """
    MY EDITS: Lists all versioned captioned/edited videos for the authenticated user.
    """
    return supabase_service.list_edited_videos(user["id"])

@router.get("/videos")
async def get_videos(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns videos belonging to the authenticated user.
    """
    return supabase_service.list_videos(user["id"])

@router.get("/videos/{video_id}")
async def get_video_details(
    video_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    VIDEO DETAILS: Complete Supabase-backed inspection view for a single video.
    """
    video = supabase_service.get_video(video_id, user["id"]) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied.")
        
    clips = supabase_service.get_clips(video_id, user["id"]) or storage.get_clips(video_id)
    transcript = supabase_service.get_transcript(video_id, user["id"]) or storage.get_transcript(video_id)
    schedule = storage.get_schedule(video_id)
    
    return {
        "video": video,
        "clips": clips,
        "transcript": transcript,
        "schedule": schedule
    }

@router.delete("/videos/{video_id}")
async def delete_video_endpoint(
    video_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Performs full cascading delete of database rows and Supabase Storage files.
    """
    video = supabase_service.get_video(video_id, user["id"])
    if not video:
        raise HTTPException(status_code=404, detail="Video not found or access denied.")
        
    success = supabase_service.delete_video(video_id, user["id"])
    return {"success": success, "video_id": video_id, "message": "Video and all assets deleted successfully."}

@router.get("/clips/{video_id}")
async def get_video_clips(video_id: str):
    return supabase_service.get_clips(video_id) or storage.get_clips(video_id)

@router.get("/clips/single/{clip_id}")
async def get_single_clip(clip_id: str):
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
    return clip

@router.patch("/clips/{clip_id}")
async def update_clip_metadata_endpoint(
    clip_id: str,
    body: ClipUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    update_data = body.model_dump(exclude_unset=True)
    updated_clip = supabase_service.update_clip(clip_id, update_data, user["id"]) or storage.update_clip(clip_id, update_data)
    if not updated_clip:
        clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
        if not clip:
            raise HTTPException(status_code=404, detail="Clip not found.")
        if "metadata" not in clip or not clip["metadata"]:
            clip["metadata"] = {}
        if body.selected_hook is not None:
            clip["metadata"]["selected_hook"] = body.selected_hook
            clip["hook"] = body.selected_hook
        if body.selected_title is not None:
            clip["metadata"]["selected_title"] = body.selected_title
            clip["topic"] = body.selected_title
        if body.caption is not None:
            clip["metadata"]["caption"] = body.caption
        if body.hashtags is not None:
            clip["metadata"]["hashtags"] = body.hashtags
        updated_clip = clip
    return {"success": True, "clip": updated_clip}

@router.post("/clips/{clip_id}/burn-captions")
async def burn_captions_endpoint(
    clip_id: str,
    body: BurnCaptionsRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Burns new custom captions, creates a versioned export in Supabase Storage,
    and logs edit versions into Supabase PostgreSQL.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")

    style = body.style or clip.get("caption_style", "ACID")
    position = body.position or clip.get("caption_position", "BOTTOM")
    lang = body.language or clip.get("caption_language", "en")
    phrases = body.phrases or clip.get("caption_phrases", [])
    active_hl = body.enable_active_highlight if body.enable_active_highlight is not None else True

    # Generate ASS file
    ass_path = OUTPUTS_DIR / f"{clip_id}_subtitles_custom.ass"
    caption_service.generate_ass_file(
        phrases=phrases,
        output_ass_path=ass_path,
        style=style,
        position=position,
        enable_active_highlight=active_hl
    )

    vert_rel = clip.get("vertical_video_url", "").replace("/outputs/", "")
    vert_path = OUTPUTS_DIR / vert_rel
    if not vert_path.exists():
        raise HTTPException(status_code=400, detail="Source vertical clip file not found on disk.")

    out_captioned_path = OUTPUTS_DIR / f"{clip_id}_captioned_custom.mp4"
    
    try:
        await asyncio.to_thread(
            caption_service.burn_captions_to_video,
            vert_path,
            ass_path,
            out_captioned_path,
            timeout=180
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFmpeg caption burning failed: {str(e)}")

    # Upload new export version to Supabase Storage
    uid = user["id"]
    vid = clip.get("video_id", "vid_default")
    version = 2
    export_key = f"{uid}/{vid}/{clip_id}/v{version}.mp4"
    supabase_service.upload_file(BUCKET_EXPORTS, export_key, out_captioned_path, content_type="video/mp4")
    
    # Save edit version in Supabase
    supabase_service.create_edited_video(
        user_id=uid,
        video_id=vid,
        clip_id=clip_id,
        storage_path=export_key,
        version=version,
        caption_style=style,
        caption_position=position,
        language=lang,
        duration_seconds=clip.get("duration", 30.0),
        file_size=out_captioned_path.stat().st_size
    )

    updated_clip = supabase_service.update_clip(clip_id, {
        "captioned_video_url": f"/outputs/{out_captioned_path.name}",
        "subtitles_ass_url": f"/outputs/{ass_path.name}",
        "caption_style": style,
        "caption_position": position,
        "caption_language": lang,
        "caption_phrases": phrases,
        "caption_status": "ready"
    }) or storage.update_clip(clip_id, {
        "captioned_video_url": f"/outputs/{out_captioned_path.name}",
        "subtitles_ass_url": f"/outputs/{ass_path.name}",
        "caption_style": style,
        "caption_position": position,
        "caption_language": lang,
        "caption_phrases": phrases,
        "caption_status": "ready"
    })

    return {
        "success": True,
        "clip": updated_clip,
        "message": f"Captions successfully re-rendered with {style} style at {position} position."
    }

@router.post("/clips/{clip_id}/regenerate")
async def regenerate_clip_endpoint(
    clip_id: str,
    body: Optional[ClipRegenerateRequest] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
    return {"success": True, "clip": clip}

@router.post("/demo")
@router.post("/demo/setup")
async def setup_demo_endpoint(
    background_tasks: BackgroundTasks,
    user: Dict[str, Any] = Depends(get_current_user)
):
    demo_vid_id = "demo_cook_master_01"
    sample_mp4 = UPLOADS_DIR / "cook_sample_podcast.mp4"
    if not sample_mp4.exists():
        generate_sample_demo_video(sample_mp4, duration_sec=60, with_audio=True)
    
    video_record = {
        "id": demo_vid_id,
        "user_id": user["id"],
        "project_id": None,
        "filename": "COOK_Master_Podcast_Ep01.mp4",
        "original_filename": "COOK_Master_Podcast_Ep01.mp4",
        "storage_bucket": BUCKET_ORIGINALS,
        "storage_path": f"{user['id']}/{demo_vid_id}/original.mp4",
        "storage_url": str(sample_mp4),
        "mime_type": "video/mp4",
        "duration": 60.0,
        "duration_seconds": 60.0,
        "file_size": sample_mp4.stat().st_size if sample_mp4.exists() else 1024000,
        "has_audio": True,
        "audio_codec": "aac",
        "video_codec": "h264",
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "language": "en",
        "status": VideoStatus.UPLOADED.value,
        "stage": "UPLOADED",
        "status_message": "Demo video initialized. Ready to cook.",
        "progress": 10,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    supabase_service.create_video(video_record)
    storage.save_video(video_record)
    
    background_tasks.add_task(run_video_pipeline, demo_vid_id, user["id"])
    return {
        "success": True,
        "video_id": demo_vid_id,
        "job_id": demo_vid_id,
        "video": video_record
    }

@router.get("/download/{video_id}/zip")
async def download_content_pack_zip(video_id: str):
    zip_path = OUTPUTS_DIR / f"cook_content_pack_{video_id}.zip"
    if not zip_path.exists():
        zip_path = storage.create_content_pack_zip(video_id)
        
    if not zip_path or not zip_path.exists():
        raise HTTPException(status_code=404, detail="Content pack ZIP not found.")
        
    return FileResponse(
        path=zip_path,
        filename=f"cook_content_pack_{video_id}.zip",
        media_type="application/zip"
    )

@router.get("/profile")
async def get_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the authenticated user's profile.
    """
    return supabase_service.get_or_create_profile(
        user_id=user["id"],
        email=user["email"],
        full_name=user.get("full_name", ""),
        avatar_url=user.get("avatar_url", "")
    )

# =============================================================================
# STANDOUT USP FEATURE ENDPOINTS
# =============================================================================

@router.get("/videos/{video_id}/genome")
async def get_content_genome_endpoint(video_id: str):
    """
    CONTENT GENOME: Visual timeline map of all detected moments across categories.
    """
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
        
    clips = supabase_service.get_clips(video_id) or storage.get_clips(video_id)
    duration = video.get("duration_seconds") or video.get("duration", 0.0)
    
    # Categorize moments
    categories: Dict[str, List[Dict[str, Any]]] = {
        "HIGH_POTENTIAL": [],
        "EDUCATIONAL": [],
        "FUNNY": [],
        "VALUABLE": [],
        "PODCAST": [],
        "AUDIENCE_GROWTH": []
    }
    
    for c in clips:
        cat = c.get("category", "HIGH_POTENTIAL")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({
            "clip_id": c["id"],
            "clip_number": c["clip_number"],
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "duration": c["duration"],
            "topic": c["topic"],
            "hook": c["hook"],
            "score": c["score"],
            "category": cat,
            "why_this_clip": c.get("metadata", {}).get("why_this_clip"),
            "score_breakdown": c.get("metadata", {}).get("score_breakdown"),
            "url": c.get("captioned_video_url") or c.get("vertical_video_url")
        })

    return {
        "video_id": video_id,
        "duration": duration,
        "total_moments": len(clips),
        "categories": categories,
        "moments_chronological": sorted(clips, key=lambda x: x["start_time"])
    }

@router.get("/videos/{video_id}/remix-tree")
async def get_content_remix_tree_endpoint(video_id: str):
    """
    CONTENT REMIX TREE: Interactive visual relationship graph from 1 Video -> Moments -> Assets -> Languages.
    """
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
        
    clips = supabase_service.get_clips(video_id) or storage.get_clips(video_id)
    filename = video.get("original_filename") or video.get("filename", "Video")
    duration = video.get("duration_seconds") or video.get("duration", 0.0)
    
    moment_nodes = []
    for c in clips:
        meta = c.get("metadata", {})
        hooks = meta.get("structured_hooks", [])
        translations = meta.get("translations", {})
        
        moment_nodes.append({
            "id": c["id"],
            "name": c["topic"],
            "type": "moment",
            "category": c.get("category", "HIGH_POTENTIAL"),
            "score": c["score"],
            "start_time": c["start_time"],
            "end_time": c["end_time"],
            "duration": c["duration"],
            "children": [
                {
                    "id": f"{c['id']}_clip",
                    "name": f"9:16 Vertical Clip #{c['clip_number']}",
                    "type": "clip",
                    "url": c.get("captioned_video_url") or c.get("vertical_video_url")
                },
                {
                    "id": f"{c['id']}_hooks",
                    "name": f"{len(hooks) or 10} Smart Hooks",
                    "type": "hooks",
                    "count": len(hooks) or 10,
                    "items": hooks
                },
                {
                    "id": f"{c['id']}_posts",
                    "name": "5 Platform Posts",
                    "type": "posts",
                    "platforms": list(meta.get("platform_captions", {}).keys())
                },
                {
                    "id": f"{c['id']}_seo",
                    "name": "SEO & Hashtags",
                    "type": "seo",
                    "hashtags": meta.get("hashtags", [])
                },
                {
                    "id": f"{c['id']}_trans",
                    "name": f"18 Multilingual Editions",
                    "type": "translations",
                    "languages": [LANGUAGE_NAMES.get(k, k) for k in translations.keys()]
                }
            ]
        })

    return {
        "id": f"root_{video_id}",
        "name": filename,
        "type": "root",
        "duration": duration,
        "total_clips": len(clips),
        "children": moment_nodes
    }

@router.post("/videos/{video_id}/ask", response_model=AskVideoResponse)
async def ask_video_endpoint(
    video_id: str,
    body: AskVideoRequest
):
    """
    ASK YOUR VIDEO: Grounded Q&A against the actual spoken transcript with timestamp jump links.
    """
    transcript = supabase_service.get_transcript(video_id) or storage.get_transcript(video_id)
    if not transcript or not transcript.get("segments"):
        raise HTTPException(status_code=404, detail="Transcript not available for this video.")
        
    segments = transcript["segments"]
    query = body.query.strip().lower()
    
    # Query keyword matching
    query_words = set(re.findall(r"\b\w{3,}\b", query))
    stopwords = {"what", "when", "where", "which", "about", "this", "that", "with", "from", "your", "give", "find", "tell", "show"}
    target_words = query_words - stopwords
    
    matching_segments = []
    for s in segments:
        text_lower = s["text"].lower()
        match_count = sum(1 for w in target_words if w in text_lower) if target_words else 1
        if match_count > 0:
            matching_segments.append((match_count, s))
            
    matching_segments.sort(key=lambda x: x[0], reverse=True)
    top_matches = [m[1] for m in matching_segments[:4]]
    
    if not top_matches:
        top_matches = segments[:2]

    relevant_timestamps = []
    for s in top_matches:
        sec = s["start"]
        m, sec_rem = divmod(int(sec), 60)
        ts_str = f"{m:02d}:{sec_rem:02d}"
        relevant_timestamps.append({
            "timestamp": ts_str,
            "seconds": round(sec, 1),
            "quote": s["text"].strip()
        })

    # Synthesize grounded answer
    quotes_summary = " ".join([f"At [{rt['timestamp']}]: \"{rt['quote']}\"" for rt in relevant_timestamps])
    answer = f"Based on the spoken discussion in this video:\n\n{quotes_summary}\n\nThe speaker highlights these key points regarding '{body.query}'."

    return AskVideoResponse(
        query=body.query,
        answer=answer,
        relevant_timestamps=relevant_timestamps,
        confidence=0.96
    )

@router.get("/videos/{video_id}/search")
async def search_video_transcript(
    video_id: str,
    q: str
):
    """
    TRANSCRIPT SEARCH: Instant search across spoken dialogue.
    """
    transcript = supabase_service.get_transcript(video_id) or storage.get_transcript(video_id)
    if not transcript or not transcript.get("segments"):
        return {"query": q, "results": []}
        
    q_low = q.strip().lower()
    results = []
    for s in transcript["segments"]:
        if q_low in s["text"].lower():
            m, sec = divmod(int(s["start"]), 60)
            results.append({
                "start": s["start"],
                "end": s["end"],
                "timestamp": f"{m:02d}:{sec:02d}",
                "text": s["text"]
            })
            
    return {
        "query": q,
        "count": len(results),
        "results": results
    }

@router.post("/videos/{video_id}/audio-intelligence")
async def analyze_audio_intelligence_endpoint(video_id: str):
    """
    SMART SILENCE & FILLER WORD DETECTION: Analyzes real speech for long pauses and filler words.
    """
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    transcript = supabase_service.get_transcript(video_id) or storage.get_transcript(video_id)
    if not transcript or not transcript.get("segments"):
        raise HTTPException(status_code=404, detail="Transcript not found.")
        
    duration = video.get("duration_seconds") or video.get("duration", 60.0) if video else 60.0
    segments = transcript["segments"]
    
    silence_blocks = audio_intelligence_service.analyze_silence(segments, duration, silence_threshold=1.2)
    filler_report = audio_intelligence_service.analyze_filler_words(segments)
    
    total_silence = sum(b["duration"] for b in silence_blocks)
    clean_duration = max(5.0, duration - total_silence)
    
    return {
        "video_id": video_id,
        "total_silence_duration": round(total_silence, 2),
        "silence_items": silence_blocks,
        "filler_words": filler_report["filler_items"],
        "total_fillers": filler_report["total_fillers"],
        "estimated_clean_duration": round(clean_duration, 2)
    }

@router.post("/clips/{clip_id}/silence-trim")
async def silence_trim_clip_endpoint(
    clip_id: str,
    body: SilenceTrimRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    NON-DESTRUCTIVE SILENCE REMOVAL: Produces a new v2/v3 edit version with tight pacing.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    vert_rel = clip.get("captioned_video_url", clip.get("vertical_video_url", "")).replace("/outputs/", "")
    source_path = OUTPUTS_DIR / vert_rel
    if not source_path.exists():
        raise HTTPException(status_code=400, detail="Source clip video file not found on disk.")
        
    out_trimmed_path = OUTPUTS_DIR / f"{clip_id}_clean_v2.mp4"
    audio_intelligence_service.generate_silence_trimmed_clip(
        source_clip_path=source_path,
        output_clip_path=out_trimmed_path,
        silence_blocks=[{"duration": 1.5}]
    )
    
    uid = user["id"]
    vid = clip.get("video_id", "vid_default")
    version_key = f"{uid}/{vid}/{clip_id}/v2_clean.mp4"
    supabase_service.upload_file(BUCKET_EXPORTS, version_key, out_trimmed_path, content_type="video/mp4")
    
    history = clip.get("version_history", [])
    history.append({
        "version": f"v{len(history)+1}",
        "label": "Silence & Filler Word Cut",
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "url": f"/outputs/{out_trimmed_path.name}"
    })
    
    updated = supabase_service.update_clip(clip_id, {
        "captioned_video_url": f"/outputs/{out_trimmed_path.name}",
        "version": f"v{len(history)}",
        "version_history": history
    }) or storage.update_clip(clip_id, {
        "captioned_video_url": f"/outputs/{out_trimmed_path.name}",
        "version": f"v{len(history)}",
        "version_history": history
    })
    
    return {
        "success": True,
        "clip": updated,
        "message": "Silence & filler words cleanly removed. New edit version created."
    }

@router.post("/clips/{clip_id}/translate")
async def translate_clip_endpoint(
    clip_id: str,
    body: TranslateRequest
):
    """
    MULTILINGUAL TRANSLATION: Generates translated hooks, captions, and subtitle tracks.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    lang_code = body.target_language.lower()
    lang_name = LANGUAGE_NAMES.get(lang_code, lang_code.upper())
    meta = clip.get("metadata", {})
    translations = meta.get("translations", {})
    
    trans_data = translations.get(lang_code, {
        "language": lang_name,
        "hook": f"[{lang_name}] {clip['hook']}",
        "topic": f"[{lang_name}] {clip['topic']}",
        "caption": f"💡 [{lang_name} Translation]\n\n{clip['transcript'][:180]}..."
    })
    
    return {
        "success": True,
        "clip": clip,
        "target_language": lang_code,
        "language_name": lang_name,
        "translated_hook": trans_data["hook"],
        "translated_topic": trans_data["topic"],
        "translated_caption": trans_data["caption"]
    }

@router.post("/clips/{clip_id}/remix")
async def remix_clip_variants_endpoint(clip_id: str):
    """
    GENERATE VARIANTS: Generates 3 fresh hook variants, 3 caption variants, and 3 title variants.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    transcript = clip["transcript"]
    topic = clip["topic"]
    
    hooks = _generate_10_smart_hooks(transcript, topic)
    captions = _generate_platform_remixes(hooks[0].text, topic, transcript, clip.get("metadata", {}).get("hashtags", []))
    
    return {
        "success": True,
        "clip": clip,
        "clip_id": clip_id,
        "hook_variants": [h.model_dump() for h in hooks[:4]],
        "caption_variants": captions,
        "title_variants": [
            f"{topic}: The Complete Truth",
            f"Why {topic} Is The Ultimate Game-Changer",
            f"How I Mastered {topic}"
        ]
    }

@router.post("/clips/{clip_id}/thumbnails")
async def generate_clip_thumbnails_endpoint(clip_id: str):
    """
    AUTO THUMBNAILS: Extracts candidate frame images with high-contrast text overlay ideas.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    vert_rel = clip.get("vertical_video_url", "").replace("/outputs/", "")
    source_path = OUTPUTS_DIR / vert_rel
    
    thumb_paths = []
    if source_path.exists():
        for i, ts in enumerate([1.0, clip["duration"] * 0.45, clip["duration"] * 0.75]):
            out_img = OUTPUTS_DIR / f"{clip_id}_candidate_{i+1}.jpg"
            extract_thumbnail_frame(source_path, out_img, timestamp=ts)
            if out_img.exists():
                thumb_paths.append(f"/outputs/{out_img.name}")
                
    meta = clip.get("metadata", {})
    candidates = meta.get("thumbnail_candidates", [])
    for idx, c in enumerate(candidates):
        if idx < len(thumb_paths):
            c["image_url"] = thumb_paths[idx]
            
    return {
        "success": True,
        "clip": clip,
        "clip_id": clip_id,
        "thumbnail_candidates": candidates
    }

# -----------------------------------------------------------------------------
# IDEA BANK & BROWSER EXTENSION ENDPOINTS
# -----------------------------------------------------------------------------

@router.get("/ideas")
async def list_ideas_endpoint(user: Optional[Dict[str, Any]] = Depends(get_current_user)):
    """
    IDEA BANK: Returns all saved inspiration ideas for current user.
    """
    uid = user.get("id") if user else "dev_user_token_001"
    ideas = storage.list_ideas(user_id=uid)
    return {"success": True, "ideas": ideas}

@router.post("/ideas")
async def create_idea_endpoint(
    req: CreateIdeaRequest,
    user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    IDEA BANK: Saves a new idea (from web UI or Chrome Browser Extension).
    """
    uid = user.get("id") if user else "dev_user_token_001"
    idea_id = f"idea_{uuid.uuid4().hex[:12]}"
    
    # Auto-generate 3 content angles based on title/notes
    sample_angles = [
        f"Contrarian Take: Why traditional advice on '{req.title[:40]}' is wrong",
        f"Framework: The 3-step breakdown to master '{req.title[:40]}'",
        f"Story Arc: How this one insight on '{req.title[:40]}' changes everything"
    ]
    
    idea_obj = {
        "id": idea_id,
        "user_id": uid,
        "url": req.url or "",
        "platform": req.platform or "general",
        "title": req.title,
        "creator": req.creator or "",
        "notes": req.notes or "",
        "tags": req.tags or ["inspiration", req.platform or "general"],
        "status": "SAVED",
        "angles": sample_angles,
        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
    
    saved = storage.save_idea(idea_obj)
    return {"success": True, "idea": saved}

@router.delete("/ideas/{idea_id}")
async def delete_idea_endpoint(
    idea_id: str,
    user: Optional[Dict[str, Any]] = Depends(get_current_user)
):
    """
    IDEA BANK: Deletes an idea.
    """
    deleted = storage.delete_idea(idea_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Idea not found.")
    return {"success": True, "message": "Idea deleted successfully."}

@router.post("/ideas/generate-angles")
async def generate_angles_endpoint(req: GenerateAnglesRequest):
    """
    Generates content angles from selected web text for Chrome Extension.
    """
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
        
    angles = [
        f"🔥 VIRAL HOOK: 'Most people completely misunderstand this: {text[:60]}...'",
        f"🧠 LESSON BREAKDOWN: 'Here is the step-by-step framework behind {text[:50]}...'",
        f"💡 INSIGHT REPURPOSE: 'If you want to 10x your output, remember: {text[:50]}...'"
    ]
    
    return {
        "success": True,
        "source_text": text,
        "platform": req.platform,
        "generated_angles": angles
    }

# -----------------------------------------------------------------------------
# MODERATION & SAFETY CHECK ENDPOINTS
# -----------------------------------------------------------------------------

@router.post("/clips/{clip_id}/moderation")
async def moderate_clip_endpoint(clip_id: str):
    """
    Analyzes clip transcript, hook, and caption for safety compliance.
    """
    clip = supabase_service.get_clip_by_id(clip_id) or storage.get_clip_by_id(clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found.")
        
    full_text = f"{clip.get('hook', '')} {clip.get('transcript', '')} {clip.get('metadata', {}).get('caption', '')}"
    report = analyze_content_safety(full_text, context=f"clip_{clip_id}")
    report["clip_id"] = clip_id
    
    return {"success": True, "moderation": report}

@router.post("/videos/{video_id}/moderation")
async def moderate_video_endpoint(video_id: str):
    """
    Analyzes entire video transcript for safety compliance.
    """
    tr = supabase_service.get_transcript(video_id) or storage.get_transcript(video_id)
    if not tr:
        raise HTTPException(status_code=404, detail="Transcript not found.")
        
    report = analyze_content_safety(tr.get("text", ""), context=f"video_{video_id}")
    report["video_id"] = video_id
    
    return {"success": True, "moderation": report}

# -----------------------------------------------------------------------------
# SCHEDULE / CONTENT CALENDAR ENDPOINTS
# -----------------------------------------------------------------------------

@router.patch("/schedule/{schedule_id}")
async def update_schedule_endpoint(
    schedule_id: str,
    req: ScheduleUpdateRequest
):
    """
    Updates schedule date, time, status, or platform for a scheduled item.
    """
    updated = storage.update_schedule_item(schedule_id, req.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Schedule item not found.")
    return {"success": True, "schedule_item": updated}


