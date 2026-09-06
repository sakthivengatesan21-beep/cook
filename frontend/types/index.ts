export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  confidence?: number;
  speaker?: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface ThumbnailIdea {
  headline: string;
  visual_concept: string;
  expression: string;
  layout: string;
  style: string;
  frame_timestamp?: number;
  image_url?: string;
}

export interface ScoreDetail {
  score: number;
  reason: string;
}

export interface ContentScoreBreakdown {
  total_score: number;
  hook: ScoreDetail;
  clarity: ScoreDetail;
  story: ScoreDetail;
  pacing: ScoreDetail;
  emotion: ScoreDetail;
  value: ScoreDetail;
  cta: ScoreDetail;
  style_match: ScoreDetail;
}

export interface WhyThisClip {
  opening_hook: string;
  curiosity_loop: string;
  core_context: string;
  payoff: string;
  standalone_reason: string;
}

export interface HookItem {
  type: string; // CURIOSITY, CONTRARIAN, QUESTION, BOLD_CLAIM, STORY, PROBLEM, OUTCOME, EMOTIONAL, STATISTICAL, PATTERN_INTERRUPT
  text: string;
  attention_score: number;
  clarity_score: number;
  style_match: number;
  reason: string;
}

export interface SEOPackage {
  title_curiosity: string;
  title_educational: string;
  title_search: string;
  title_bold: string;
  title_story: string;
  description: string;
  keywords: string[];
  search_phrases: string[];
  hashtags: string[];
}

export interface SilenceItem {
  start_time: number;
  end_time: number;
  duration: number;
}

export interface FillerWordItem {
  word: string;
  count: number;
  timestamps: number[];
}

export interface AudioIntelligenceReport {
  video_id: string;
  total_silence_duration: number;
  silence_items: SilenceItem[];
  filler_words: FillerWordItem[];
  total_fillers: number;
  estimated_clean_duration: number;
}

export interface ContentGenomeMoment {
  moment_id: string;
  video_id: string;
  clip_number: number;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  summary: string;
  transcript: string;
  category: "HIGH_POTENTIAL" | "EDUCATIONAL" | "FUNNY" | "VALUABLE" | "PODCAST" | "AUDIENCE_GROWTH" | string;
  content_score: number;
  hook_potential: number;
  emotion_score: number;
  clarity_score: number;
  shareability_score: number;
  standalone_score: number;
  why_this_clip: WhyThisClip;
  hooks: HookItem[];
  selected_hook: string;
  titles: string[];
  selected_title: string;
  platform_captions: {
    instagram?: string;
    tiktok?: string;
    shorts?: string;
    linkedin?: string;
    x?: string;
    [key: string]: string | undefined;
  };
  seo_package?: SEOPackage;
  thumbnail_candidates: ThumbnailIdea[];
  hashtags: string[];
  score_breakdown?: ContentScoreBreakdown;
  translations?: Record<string, {
    language: string;
    code: string;
    hook: string;
    topic: string;
    caption: string;
    translated_subtitles: string[];
  }>;
}

export interface ClipMetadata {
  id: string;
  clip_id: string;
  hooks: string[];
  structured_hooks?: HookItem[];
  selected_hook: string;
  titles: string[];
  selected_title: string;
  caption: string;
  platform_captions: {
    instagram?: string;
    shorts?: string;
    tiktok?: string;
    linkedin?: string;
    x?: string;
    [key: string]: string | undefined;
  };
  hashtags: string[];
  thumbnail_idea: ThumbnailIdea;
  thumbnail_candidates?: ThumbnailIdea[];
  score_breakdown?: ContentScoreBreakdown;
  why_this_clip?: WhyThisClip;
  seo_package?: SEOPackage;
  translations?: Record<string, any>;
  created_at: string;
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
  probability?: number;
}

export interface CaptionPhrase {
  index: number;
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
}

export interface Clip {
  id: string;
  video_id: string;
  clip_number: number;
  start_time: number;
  end_time: number;
  duration: number;
  video_url: string;
  vertical_video_url: string;
  square_video_url?: string;
  landscape_video_url?: string;
  captioned_video_url?: string;
  subtitles_srt_url?: string;
  subtitles_vtt_url?: string;
  subtitles_ass_url?: string;
  caption_style?: "ACID" | "BOLD" | "MINIMAL" | "CLASSIC" | string;
  caption_position?: "BOTTOM" | "CENTER" | "TOP" | string;
  caption_language?: string;
  caption_phrases?: CaptionPhrase[];
  caption_status?: string;
  transcript: string;
  topic: string;
  hook: string;
  selected_hook?: string;
  selected_title?: string;
  hook_type?: string;
  intent_label?: string;
  keywords?: string[];
  key_takeaways?: string[];
  aspect_ratio?: string;
  reason: string;
  category?: string;
  score: number;
  hook_score: number;
  information_score: number;
  emotion_score: number;
  curiosity_score: number;
  shareability_score: number;
  standalone_value: number;
  status: string;
  version?: string;
  version_history?: Array<{
    version: string;
    created_at: string;
    url: string;
    type: string;
  }>;
  metadata?: ClipMetadata;
  created_at: string;
  [key: string]: any;
}

export interface BurnCaptionsRequest {
  style?: string;
  position?: string;
  language?: string;
  phrases?: CaptionPhrase[];
  enable_active_highlight?: boolean;
}

export interface ScheduleItem {
  id: string;
  clip_id: string;
  clip_number: number;
  platform: string;
  day_of_week: string;
  scheduled_date: string;
  scheduled_time: string;
  is_ai_suggested: boolean;
  hook_preview: string;
  status?: "IDEA" | "READY" | "SCHEDULED" | "POSTED" | string;
}

export interface Video {
  id: string;
  filename: string;
  storage_url: string;
  duration: number;
  file_size: number;
  has_audio?: boolean;
  audio_codec?: string;
  video_codec?: string;
  width?: number;
  height?: number;
  status: "uploaded" | "extracting_audio" | "audio_extracted" | "transcribing" | "transcription_ready" | "analyzing" | "moments_ready" | "generating_clips" | "clips_ready" | "generating_metadata" | "content_ready" | "packaging" | "completed" | "failed";
  stage?: string;
  status_message: string;
  progress: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
}

export interface VideoDetailResponse {
  video: Video;
  clips: Clip[];
  transcript?: {
    id: string;
    video_id: string;
    text: string;
    language?: string;
    word_count?: number;
    segments: TranscriptSegment[];
  };
  schedule: ScheduleItem[];
  genome?: ContentGenomeMoment[];
  audio_intelligence?: AudioIntelligenceReport;
}

export interface ProcessingStatusResponse {
  video_id: string;
  status: string;
  stage: string;
  status_message: string;
  progress: number;
  updated_at: string;
  error_code?: string;
  error_message?: string;
  moments_count?: number;
  clips_count?: number;
  transcript_word_count?: number;
}

export interface AskVideoTimestamp {
  timestamp: string;
  seconds: number;
  quote: string;
}

export interface AskVideoResponse {
  query: string;
  answer: string;
  relevant_timestamps: AskVideoTimestamp[];
  confidence: number;
}

export interface RemixTreeNode {
  id: string;
  name: string;
  type: "root" | "category" | "clip" | "asset";
  category?: string;
  data?: any;
  children?: RemixTreeNode[];
}

export interface IdeaItem {
  id: string;
  user_id?: string;
  url?: string;
  platform: "youtube" | "instagram" | "tiktok" | "linkedin" | "x" | "general" | string;
  title: string;
  creator?: string;
  notes?: string;
  tags: string[];
  status: "SAVED" | "IN_PROGRESS" | "COOKED" | "ARCHIVED" | string;
  angles?: string[];
  created_at: string;
}

export interface ModerationFlag {
  category: string;
  matched_terms: string[];
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface ModerationReport {
  clip_id?: string;
  video_id?: string;
  safe: boolean;
  status: "APPROVED" | "REVIEW_RECOMMENDED" | "FLAGGED" | string;
  risk_score: number;
  flags: ModerationFlag[];
  category_scores: Record<string, number>;
  recommendation: "APPROVE" | "REVIEW_RECOMMENDED" | "FLAG";
  summary: string;
}

