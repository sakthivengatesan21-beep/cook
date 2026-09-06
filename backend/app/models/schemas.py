from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import datetime

class VideoStatus(str, Enum):
    UPLOADED = "uploaded"
    AUDIO_EXTRACTING = "extracting_audio"
    AUDIO_EXTRACTED = "audio_extracted"
    TRANSCRIBING = "transcribing"
    TRANSCRIPTION_READY = "transcription_ready"
    ANALYZING_MOMENTS = "analyzing"
    MOMENTS_READY = "moments_ready"
    GENERATING_CLIPS = "generating_clips"
    CLIPS_READY = "clips_ready"
    GENERATING_CONTENT = "generating_metadata"
    CONTENT_READY = "content_ready"
    PACKAGING = "packaging"
    COMPLETED = "completed"
    FAILED = "failed"

class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    confidence: Optional[float] = 0.95
    speaker: Optional[str] = None
    words: Optional[List[Dict[str, Any]]] = None

class Transcript(BaseModel):
    id: str
    video_id: str
    text: str
    language: str = "en"
    duration: float = 0.0
    word_count: int = 0
    segments: List[TranscriptSegment] = []
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

class ThumbnailIdea(BaseModel):
    headline: str
    visual_concept: str
    expression: str
    layout: str
    style: str
    frame_timestamp: Optional[float] = 0.0
    image_url: Optional[str] = None

class ScoreDetail(BaseModel):
    score: int
    reason: str

class ContentScoreBreakdown(BaseModel):
    total_score: int
    hook: ScoreDetail
    clarity: ScoreDetail
    story: ScoreDetail
    pacing: ScoreDetail
    emotion: ScoreDetail
    value: ScoreDetail
    cta: ScoreDetail
    style_match: ScoreDetail

class WhyThisClip(BaseModel):
    opening_hook: str
    curiosity_loop: str
    core_context: str
    payoff: str
    standalone_reason: str

class HookItem(BaseModel):
    type: str  # CURIOSITY, CONTRARIAN, QUESTION, BOLD_CLAIM, STORY, PROBLEM, OUTCOME, EMOTIONAL, STATISTICAL, PATTERN_INTERRUPT
    text: str
    attention_score: int
    clarity_score: int
    style_match: int
    reason: str

class SEOPackage(BaseModel):
    title_curiosity: str
    title_educational: str
    title_search: str
    title_bold: str
    title_story: str
    description: str
    keywords: List[str] = []
    search_phrases: List[str] = []
    hashtags: List[str] = []

class SilenceItem(BaseModel):
    start_time: float
    end_time: float
    duration: float

class FillerWordItem(BaseModel):
    word: str
    count: int
    timestamps: List[float] = []

class AudioIntelligenceReport(BaseModel):
    video_id: str
    total_silence_duration: float = 0.0
    silence_items: List[SilenceItem] = []
    filler_words: List[FillerWordItem] = []
    total_fillers: int = 0
    estimated_clean_duration: float = 0.0

class ContentGenomeMoment(BaseModel):
    moment_id: str
    video_id: str
    clip_number: int
    start_time: float
    end_time: float
    duration: float
    title: str
    summary: str
    transcript: str
    category: str  # HIGH_POTENTIAL, EDUCATIONAL, FUNNY, VALUABLE, PODCAST, AUDIENCE_GROWTH
    content_score: int
    hook_potential: int
    emotion_score: int
    clarity_score: int
    shareability_score: int
    standalone_score: int
    why_this_clip: WhyThisClip
    hooks: List[HookItem] = []
    selected_hook: str = ""
    titles: List[str] = []
    selected_title: str = ""
    platform_captions: Dict[str, str] = {}  # instagram, tiktok, shorts, linkedin, x
    seo_package: Optional[SEOPackage] = None
    thumbnail_candidates: List[ThumbnailIdea] = []
    hashtags: List[str] = []
    score_breakdown: Optional[ContentScoreBreakdown] = None
    translations: Optional[Dict[str, Dict[str, Any]]] = None

class ClipMetadata(BaseModel):
    id: str
    clip_id: str
    hooks: List[str] = []
    structured_hooks: List[HookItem] = []
    selected_hook: str = ""
    titles: List[str] = []
    selected_title: str = ""
    caption: str = ""
    platform_captions: Dict[str, str] = {}
    hashtags: List[str] = []
    thumbnail_idea: ThumbnailIdea
    thumbnail_candidates: Optional[List[ThumbnailIdea]] = None
    score_breakdown: Optional[ContentScoreBreakdown] = None
    why_this_clip: Optional[WhyThisClip] = None
    seo_package: Optional[SEOPackage] = None
    translations: Optional[Dict[str, Dict[str, Any]]] = None
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

class Clip(BaseModel):
    id: str
    video_id: str
    clip_number: int
    start_time: float
    end_time: float
    duration: float
    video_url: str
    vertical_video_url: str
    captioned_video_url: Optional[str] = None
    square_video_url: Optional[str] = None
    landscape_video_url: Optional[str] = None
    subtitles_srt_url: Optional[str] = None
    subtitles_vtt_url: Optional[str] = None
    subtitles_ass_url: Optional[str] = None
    caption_style: str = "ACID"
    caption_position: str = "BOTTOM"
    caption_language: str = "en"
    caption_phrases: Optional[List[Dict[str, Any]]] = None
    caption_status: str = "ready"
    transcript: str
    topic: str
    hook: str
    reason: str
    category: str = "HIGH_POTENTIAL"
    score: int
    hook_score: int
    information_score: int
    emotion_score: int
    curiosity_score: int
    shareability_score: int
    standalone_value: int
    status: str = "ready"
    version: str = "v1"
    version_history: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[ClipMetadata] = None
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

class BurnCaptionsRequest(BaseModel):
    style: Optional[str] = "ACID"
    position: Optional[str] = "BOTTOM"
    language: Optional[str] = None
    phrases: Optional[List[Dict[str, Any]]] = None
    enable_active_highlight: Optional[bool] = True

class ScheduleItem(BaseModel):
    id: str
    clip_id: str
    clip_number: int
    platform: str
    day_of_week: str
    scheduled_date: str
    scheduled_time: str
    is_ai_suggested: bool = True
    hook_preview: str
    status: str = "SCHEDULED"  # IDEA, READY, SCHEDULED, POSTED

class Video(BaseModel):
    id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    filename: str
    original_filename: Optional[str] = None
    storage_bucket: Optional[str] = "cook-originals"
    storage_path: Optional[str] = None
    storage_url: str
    mime_type: Optional[str] = "video/mp4"
    duration: float
    duration_seconds: Optional[float] = None
    file_size: int
    has_audio: bool = True
    audio_codec: Optional[str] = None
    video_codec: Optional[str] = None
    width: Optional[int] = 1920
    height: Optional[int] = 1080
    fps: Optional[float] = 30.0
    language: Optional[str] = "en"
    status: VideoStatus = VideoStatus.UPLOADED
    stage: str = "uploaded"
    status_message: str = "Video uploaded"
    progress: int = 0
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    completed_at: Optional[str] = None

class JobStatusResponse(BaseModel):
    video_id: str
    status: str
    stage: str
    status_message: str
    progress: int
    updated_at: str
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    moments_count: Optional[int] = 0
    clips_count: Optional[int] = 0
    transcript_word_count: Optional[int] = 0

class AskVideoRequest(BaseModel):
    query: str

class AskVideoResponse(BaseModel):
    query: str
    answer: str
    relevant_timestamps: List[Dict[str, Any]] = []
    confidence: float = 0.95

class ClipUpdateRequest(BaseModel):
    selected_hook: Optional[str] = None
    selected_title: Optional[str] = None
    caption: Optional[str] = None
    hashtags: Optional[List[str]] = None
    version_label: Optional[str] = None

class ClipRegenerateRequest(BaseModel):
    start_time: float
    end_time: float
    burn_subtitles: bool = True

class TranslateRequest(BaseModel):
    target_language: str  # ta, hi, te, ml, kn, bn, mr, gu, pa, ur, es, fr, de, it, pt, ar, ja, ko, etc.

class SilenceTrimRequest(BaseModel):
    threshold_seconds: Optional[float] = 1.2
    remove_fillers: Optional[bool] = False

class IdeaItem(BaseModel):
    id: str
    user_id: Optional[str] = "dev_user_token_001"
    url: Optional[str] = ""
    platform: str = "general"  # youtube, instagram, tiktok, linkedin, x, general
    title: str
    creator: Optional[str] = ""
    notes: Optional[str] = ""
    tags: List[str] = []
    status: str = "SAVED"  # SAVED, IN_PROGRESS, COOKED, ARCHIVED
    angles: Optional[List[str]] = []
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

class CreateIdeaRequest(BaseModel):
    url: Optional[str] = ""
    platform: Optional[str] = "general"
    title: str
    creator: Optional[str] = ""
    notes: Optional[str] = ""
    tags: Optional[List[str]] = []

class GenerateAnglesRequest(BaseModel):
    text: str
    platform: Optional[str] = "general"

class ModerationReport(BaseModel):
    clip_id: Optional[str] = None
    safe: bool
    status: str  # APPROVED, REVIEW_RECOMMENDED, FLAGGED
    risk_score: int
    flags: List[Dict[str, Any]] = []
    category_scores: Dict[str, int] = {}
    recommendation: str
    summary: str

class ScheduleUpdateRequest(BaseModel):
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None  # IDEA, READY, SCHEDULED, POSTED
    platform: Optional[str] = None

