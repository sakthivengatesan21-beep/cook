import json
import zipfile
import csv
import io
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import datetime
from app.config import DATA_DIR, OUTPUTS_DIR, UPLOADS_DIR

DB_FILE = DATA_DIR / "cook_db.json"

class StorageService:
    def __init__(self):
        self._load_db()

    def _load_db(self):
        if DB_FILE.exists():
            try:
                with open(DB_FILE, "r", encoding="utf-8") as f:
                    self.db = json.load(f)
            except Exception:
                self.db = {"videos": {}, "transcripts": {}, "clips": {}, "schedules": {}}
        else:
            self.db = {"videos": {}, "transcripts": {}, "clips": {}, "schedules": {}}
            self._save_db()

    def _save_db(self):
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(self.db, f, indent=2, ensure_ascii=False)

    def save_video(self, video_data: Dict[str, Any]):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if "created_at" not in video_data:
            video_data["created_at"] = now
        video_data["updated_at"] = now
        self.db["videos"][video_data["id"]] = video_data
        self._save_db()

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        return self.db["videos"].get(video_id)

    def list_videos(self) -> List[Dict[str, Any]]:
        return list(self.db["videos"].values())

    def delete_video(self, video_id: str) -> bool:
        if video_id in self.db["videos"]:
            del self.db["videos"][video_id]
        if video_id in self.db["transcripts"]:
            del self.db["transcripts"][video_id]
        if video_id in self.db["clips"]:
            del self.db["clips"][video_id]
        if video_id in self.db["schedules"]:
            del self.db["schedules"][video_id]
        self._save_db()
        return True

    def update_video_status(
        self,
        video_id: str,
        status: str,
        message: str = "",
        progress: int = 0,
        stage: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        if video_id in self.db["videos"]:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.db["videos"][video_id]["status"] = status
            self.db["videos"][video_id]["status_message"] = message
            self.db["videos"][video_id]["progress"] = progress
            self.db["videos"][video_id]["updated_at"] = now
            if stage:
                self.db["videos"][video_id]["stage"] = stage
            if error_code or error_message:
                self.db["videos"][video_id]["error_code"] = error_code
                self.db["videos"][video_id]["error_message"] = error_message
            if status == "completed":
                self.db["videos"][video_id]["completed_at"] = now
            elif status == "failed":
                if not error_message:
                    self.db["videos"][video_id]["error_message"] = message
            self._save_db()

    def save_transcript(self, transcript_data: Dict[str, Any]):
        self.db["transcripts"][transcript_data["video_id"]] = transcript_data
        self._save_db()

    def get_transcript(self, video_id: str) -> Optional[Dict[str, Any]]:
        return self.db["transcripts"].get(video_id)

    def save_clips(self, video_id: str, clips: List[Dict[str, Any]]):
        self.db["clips"][video_id] = clips
        self._save_db()

    def get_clips(self, video_id: str) -> List[Dict[str, Any]]:
        return self.db["clips"].get(video_id, [])

    def get_clip_by_id(self, clip_id: str) -> Optional[Dict[str, Any]]:
        for video_id, clips in self.db["clips"].items():
            for clip in clips:
                if clip["id"] == clip_id:
                    return clip
        return None

    def update_clip(self, clip_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for video_id, clips in self.db["clips"].items():
            for i, clip in enumerate(clips):
                if clip["id"] == clip_id:
                    if "metadata" in clip and clip["metadata"]:
                        if "selected_hook" in update_data and update_data["selected_hook"]:
                            clip["metadata"]["selected_hook"] = update_data["selected_hook"]
                        if "selected_title" in update_data and update_data["selected_title"]:
                            clip["metadata"]["selected_title"] = update_data["selected_title"]
                        if "caption" in update_data and update_data["caption"]:
                            clip["metadata"]["caption"] = update_data["caption"]
                        if "hashtags" in update_data and update_data["hashtags"] is not None:
                            clip["metadata"]["hashtags"] = update_data["hashtags"]
                    
                    if "start_time" in update_data:
                        clip["start_time"] = update_data["start_time"]
                    if "end_time" in update_data:
                        clip["end_time"] = update_data["end_time"]
                    if "duration" in update_data:
                        clip["duration"] = update_data["duration"]
                    if "video_url" in update_data:
                        clip["video_url"] = update_data["video_url"]
                    if "vertical_video_url" in update_data:
                        clip["vertical_video_url"] = update_data["vertical_video_url"]
                    
                    # Caption-related fields
                    for cap_key in [
                        "captioned_video_url", "subtitles_srt_url", "subtitles_ass_url",
                        "caption_style", "caption_position", "caption_language",
                        "caption_phrases", "caption_status"
                    ]:
                        if cap_key in update_data:
                            clip[cap_key] = update_data[cap_key]
                        
                    self.db["clips"][video_id][i] = clip
                    self._save_db()
                    return clip
        return None

    def save_schedule(self, video_id: str, schedule: List[Dict[str, Any]]):
        self.db["schedules"][video_id] = schedule
        self._save_db()

    def get_schedule(self, video_id: str) -> List[Dict[str, Any]]:
        return self.db["schedules"].get(video_id, [])

    def touch_heartbeat(self, video_id: str):
        if video_id in self.db["videos"]:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.db["videos"][video_id]["updated_at"] = now
            self._save_db()

    def check_and_mark_stale_jobs(self, timeout_seconds: int = 900, active_ids: Optional[set] = None) -> List[str]:
        """
        Watchdog: Checks for jobs that have been in an active non-terminal state
        without an updated_at heartbeat for longer than timeout_seconds, and marks them FAILED.
        Never marks actively running jobs as stale.
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        stalled_ids = []
        active_set = active_ids or set()
        
        for vid, v in self.db["videos"].items():
            if vid in active_set:
                continue
            st = v.get("status")
            if st not in ["completed", "failed", "uploaded"]:
                up_str = v.get("updated_at") or v.get("created_at")
                if up_str:
                    try:
                        up_dt = datetime.datetime.fromisoformat(up_str)
                        if (now - up_dt).total_seconds() > timeout_seconds:
                            v["status"] = "failed"
                            v["error_code"] = "JOB_STALLED"
                            v["error_message"] = f"Processing stopped unexpectedly during {v.get('status_message', 'pipeline')}."
                            v["status_message"] = v["error_message"]
                            v["updated_at"] = now.isoformat()
                            stalled_ids.append(vid)
                    except Exception:
                        pass
        if stalled_ids:
            self._save_db()
        return stalled_ids

    def create_content_pack_zip(self, video_id: str) -> Optional[Path]:
        video = self.get_video(video_id)
        if not video:
            return None
            
        clips = self.get_clips(video_id)
        schedule = self.get_schedule(video_id)
        transcript = self.get_transcript(video_id)
        
        zip_path = OUTPUTS_DIR / f"cook_content_pack_{video_id}.zip"
        
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. Add video clip files (both captioned and raw)
            for c in clips:
                # Captioned clip
                cap_rel = c.get("captioned_video_url", "").replace("/outputs/", "")
                if cap_rel:
                    cap_file = OUTPUTS_DIR / cap_rel
                    if cap_file.exists():
                        zf.write(cap_file, arcname=f"clips_captioned/clip-0{c['clip_number']}_captioned.mp4")
                
                # Raw vertical clip
                clip_rel = c.get("vertical_video_url", "").replace("/outputs/", "")
                if clip_rel:
                    local_file = OUTPUTS_DIR / clip_rel
                    if local_file.exists():
                        zf.write(local_file, arcname=f"clips_raw_916/clip-0{c['clip_number']}_raw.mp4")
                        
                # Subtitle files
                srt_rel = c.get("subtitles_srt_url", "").replace("/outputs/", "")
                if srt_rel:
                    srt_file = OUTPUTS_DIR / srt_rel
                    if srt_file.exists():
                        zf.write(srt_file, arcname=f"subtitles/clip-0{c['clip_number']}.srt")
                
                ass_rel = c.get("subtitles_ass_url", "").replace("/outputs/", "")
                if ass_rel:
                    ass_file = OUTPUTS_DIR / ass_rel
                    if ass_file.exists():
                        zf.write(ass_file, arcname=f"subtitles/clip-0{c['clip_number']}.ass")
                    
            # 2. Add transcript.txt
            if transcript and transcript.get("text"):
                zf.writestr("transcript.txt", f"COOK TRANSCRIPT FOR VIDEO: {video.get('filename')}\nLANGUAGE: {transcript.get('language')}\nWORDS: {transcript.get('word_count')}\n\n" + transcript.get("text"))

            # 3. Add captions.txt
            captions_txt = "\n\n" + "="*50 + "\n\n"
            captions_content = []
            for c in clips:
                meta = c.get("metadata", {})
                captions_content.append(
                    f"CLIP #{c['clip_number']} - {c['topic']}\n"
                    f"TIMESTAMPS: {c['start_time']}s - {c['end_time']}s\n"
                    f"SCORE: {c['score']}/100\n"
                    f"CAPTION:\n{meta.get('caption', '')}\n"
                    f"HASHTAGS: {' '.join(meta.get('hashtags', []))}"
                )
            zf.writestr("captions.txt", captions_txt.join(captions_content))

            # 4. Add titles.txt
            titles_content = []
            for c in clips:
                meta = c.get("metadata", {})
                titles_content.append(
                    f"CLIP #{c['clip_number']} ({c['topic']}):\n" +
                    "\n".join([f"- {t}" for t in meta.get("titles", [])])
                )
            zf.writestr("titles.txt", "\n\n".join(titles_content))

            # 5. Add hooks.txt
            hooks_content = []
            for c in clips:
                meta = c.get("metadata", {})
                hooks_content.append(
                    f"CLIP #{c['clip_number']} ({c['topic']}):\n" +
                    "\n".join([f"- {h}" for h in meta.get("hooks", [])])
                )
            zf.writestr("hooks.txt", "\n\n".join(hooks_content))

            # 6. Add hashtags.txt
            all_tags = set()
            for c in clips:
                all_tags.update(c.get("metadata", {}).get("hashtags", []))
            zf.writestr("hashtags.txt", " ".join(sorted(all_tags)))

            # 7. Add content-plan.json
            plan_data = {
                "brand": "COOK",
                "campaign": "ONE VIDEO. LET IT COOK.",
                "video_id": video_id,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "clips_count": len(clips),
                "transcript": transcript,
                "clips": clips,
                "schedule": schedule
            }
            zf.writestr("content-plan.json", json.dumps(plan_data, indent=2))

            # 8. Add schedule.csv
            csv_output = io.StringIO()
            writer = csv.writer(csv_output)
            writer.writerow(["Clip", "Day", "Platform", "Scheduled Date", "Time", "Hook", "AI Suggested"])
            for s in schedule:
                writer.writerow([
                    f"Clip #{s.get('clip_number', 1)}",
                    s.get("day_of_week", ""),
                    s.get("platform", ""),
                    s.get("scheduled_date", ""),
                    s.get("scheduled_time", ""),
                    s.get("hook_preview", ""),
                    "YES" if s.get("is_ai_suggested", True) else "NO"
                ])
            zf.writestr("schedule.csv", csv_output.getvalue())
            
        return zip_path

    # Idea Bank Methods
    def save_idea(self, idea_data: Dict[str, Any]) -> Dict[str, Any]:
        if "ideas" not in self.db:
            self.db["ideas"] = {}
        self.db["ideas"][idea_data["id"]] = idea_data
        self._save_db()
        return idea_data

    def list_ideas(self, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        ideas_dict = self.db.get("ideas", {})
        ideas_list = list(ideas_dict.values())
        if user_id:
            ideas_list = [i for i in ideas_list if i.get("user_id") == user_id or not i.get("user_id")]
        # Sort newest first
        ideas_list.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return ideas_list

    def delete_idea(self, idea_id: str) -> bool:
        if "ideas" in self.db and idea_id in self.db["ideas"]:
            del self.db["ideas"][idea_id]
            self._save_db()
            return True
        return False

    def update_schedule_item(self, schedule_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        for video_id, sched_list in self.db.get("schedules", {}).items():
            for item in sched_list:
                if item.get("id") == schedule_id:
                    for k, v in update_data.items():
                        if v is not None:
                            item[k] = v
                    self._save_db()
                    return item
        return None

storage = StorageService()

