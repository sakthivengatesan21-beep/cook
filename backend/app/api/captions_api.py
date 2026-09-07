import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query

from app.config import UPLOADS_DIR, OUTPUTS_DIR, DATA_DIR
from app.models.schemas import (
    StructuredVisualContext,
    CaptionCandidate,
    MultimodalCaptionResponse,
    AnalyzeVideoRequest,
    GenerateCaptionsRequest,
    CaptionValidationResult
)
from app.services.video_processor import video_processor
from app.services.vision_analyzer import vision_analyzer
from app.services.caption_generator import caption_generator
from app.services.caption_validator import caption_validator
from app.services.caption_ranker import caption_ranker
from app.services.storage import storage
from app.services.supabase_service import supabase_service

captions_router = APIRouter(prefix="/api/captions", tags=["captions"])

# In-memory cache for fast interactive studio retrieval
_CAPTIONS_CACHE: Dict[str, MultimodalCaptionResponse] = {}

def _resolve_video_path(video_id: Optional[str], provided_path: Optional[str]) -> Path:
    """
    Resolves local video path from video_id or provided explicit path.
    """
    if provided_path and Path(provided_path).exists() and Path(provided_path).is_file():
        return Path(provided_path)

    if not video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either video_id or a valid video_path must be provided."
        )

    # 1. Check UPLOADS_DIR variations
    for candidate in [
        UPLOADS_DIR / f"{video_id}_source.mp4",
        UPLOADS_DIR / f"{video_id}.mp4",
        UPLOADS_DIR / f"{video_id}_source.mov",
        UPLOADS_DIR / f"{video_id}.mov"
    ]:
        if candidate.exists() and candidate.is_file() and candidate.stat().st_size > 0:
            return candidate

    # 2. Check storage/supabase records
    video = supabase_service.get_video(video_id) or storage.get_video(video_id)
    if video:
        storage_url = video.get("storage_url")
        if storage_url and Path(storage_url).exists() and Path(storage_url).is_file():
            return Path(storage_url)

    # 3. Check any matching file in uploads starting with video_id
    for f in UPLOADS_DIR.glob(f"{video_id}*"):
        if f.is_file() and f.suffix.lower() in [".mp4", ".mov", ".mkv", ".webm"] and f.stat().st_size > 0:
            return f

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Video file for ID '{video_id}' could not be located on disk."
    )


@captions_router.post("/analyze", response_model=StructuredVisualContext)
async def analyze_video_endpoint(req: AnalyzeVideoRequest):
    """
    Extracts representative timeline frames and generates a structured visual analysis of the video.
    """
    try:
        video_path = _resolve_video_path(req.video_id, req.video_path)
        sample_count = max(4, min(req.sample_frames_count or 8, 16))
        
        frames = video_processor.extract_frames(video_path, max_frames=sample_count)
        meta = video_processor.get_video_duration_and_meta(video_path)
        
        # Retrieve transcript if video_id is available
        transcript_text = ""
        if req.video_id:
            t_data = supabase_service.get_transcript(req.video_id) or storage.get_transcript(req.video_id)
            if t_data and isinstance(t_data, dict):
                transcript_text = t_data.get("full_text", "")
            elif isinstance(t_data, str):
                transcript_text = t_data

        visual_context = vision_analyzer.analyze_video_frames(
            frames=frames,
            transcript=transcript_text,
            duration=meta.get("duration", 0.0)
        )
        return visual_context

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze video visuals: {str(e)}"
        )


@captions_router.post("/generate", response_model=MultimodalCaptionResponse)
async def generate_captions_endpoint(req: GenerateCaptionsRequest):
    """
    Generates 5 distinct creator-friendly caption styles grounded in multimodal visual + audio context.
    Validates anti-hallucination facts and ranks candidates using 5-factor weighted scoring.
    """
    try:
        # Check cache if not explicitly regenerating
        if not req.regenerate and req.video_id in _CAPTIONS_CACHE:
            cached = _CAPTIONS_CACHE[req.video_id]
            if req.style_preference:
                # Re-rank with new style preference
                ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(
                    cached.captions,
                    cached.visual_context,
                    style_preference=req.style_preference
                )
                cached = cached.model_copy(update={
                    "captions": ranked,
                    "recommended_caption": rec_cap,
                    "recommended_style": rec_style,
                    "debug_signals": debug
                })
                _CAPTIONS_CACHE[req.video_id] = cached
            return cached

        # 1. Resolve video & metadata
        video_path = _resolve_video_path(req.video_id, None)
        meta = video_processor.get_video_duration_and_meta(video_path)
        duration = meta.get("duration", 0.0)

        # 2. Resolve transcript
        transcript_text = req.transcript or ""
        if not transcript_text:
            t_data = supabase_service.get_transcript(req.video_id) or storage.get_transcript(req.video_id)
            if t_data and isinstance(t_data, dict):
                transcript_text = t_data.get("full_text", "")
            elif isinstance(t_data, str):
                transcript_text = t_data

        # 3. Resolve visual context
        visual_context = req.visual_context
        if not visual_context or visual_context.frames_analyzed == 0:
            frames = video_processor.extract_frames(video_path, max_frames=8)
            visual_context = vision_analyzer.analyze_video_frames(
                frames=frames,
                transcript=transcript_text,
                duration=duration
            )

        # 4. Generate candidate captions
        title_context = meta.get("filename", "")
        raw_candidates = caption_generator.generate_captions(
            visual_context=visual_context,
            transcript=transcript_text,
            duration=duration,
            title_context=title_context,
            tone_tweak=req.tone_tweak
        )

        # 5. Anti-hallucination validation
        validated_candidates = caption_validator.validate_and_filter_candidates(
            candidates=raw_candidates,
            visual_context=visual_context,
            transcript=transcript_text
        )

        # 6. Multi-factor ranking
        ranked_candidates, recommended_caption, recommended_style, debug_signals = caption_ranker.rank_candidates(
            candidates=validated_candidates,
            visual_context=visual_context,
            style_preference=req.style_preference
        )

        response = MultimodalCaptionResponse(
            video_id=req.video_id,
            duration=duration,
            visual_context=visual_context,
            transcript=transcript_text,
            captions=ranked_candidates,
            recommended_caption=recommended_caption,
            recommended_style=recommended_style,
            debug_signals=debug_signals
        )

        # Save to cache
        _CAPTIONS_CACHE[req.video_id] = response

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Caption generation pipeline failed: {str(e)}"
        )


@captions_router.post("/regenerate", response_model=MultimodalCaptionResponse)
async def regenerate_captions_endpoint(req: GenerateCaptionsRequest):
    """
    Forces regeneration of captions with updated style preference or tone tweak.
    """
    req.regenerate = True
    return await generate_captions_endpoint(req)


@captions_router.get("/video/{video_id}", response_model=MultimodalCaptionResponse)
async def get_video_captions_endpoint(
    video_id: str,
    style_preference: Optional[str] = Query(None, description="Preferred caption style")
):
    """
    Retrieves the generated multimodal captions for a given video ID.
    If not yet generated, generates on-demand.
    """
    if video_id in _CAPTIONS_CACHE:
        cached = _CAPTIONS_CACHE[video_id]
        if style_preference:
            ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(
                cached.captions,
                cached.visual_context,
                style_preference=style_preference
            )
            cached = cached.model_copy(update={
                "captions": ranked,
                "recommended_caption": rec_cap,
                "recommended_style": rec_style,
                "debug_signals": debug
            })
            _CAPTIONS_CACHE[video_id] = cached
        return cached

    # Generate on-demand
    req = GenerateCaptionsRequest(
        video_id=video_id,
        style_preference=style_preference,
        regenerate=False
    )
    return await generate_captions_endpoint(req)
