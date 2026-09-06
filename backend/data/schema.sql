-- =============================================================================
-- COOK SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ONE VIDEO. LET IT COOK.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Linked to auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Automatic user profile trigger on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at, updated_at)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. PROJECTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 3. VIDEOS TABLE (Original Uploaded Videos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT DEFAULT 'video/mp4',
    file_size BIGINT DEFAULT 0,
    duration_seconds NUMERIC(10, 2) DEFAULT 0.0,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    fps NUMERIC(6, 2) DEFAULT 30.0,
    language TEXT DEFAULT 'en',
    status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 4. PROCESSING JOBS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, COMPLETED, FAILED
    stage TEXT NOT NULL DEFAULT 'UPLOADING',
    progress INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 5. TRANSCRIPTS & TIMESTAMPED SEGMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL UNIQUE REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'en',
    full_text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    segment_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.transcript_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id UUID NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time NUMERIC(10, 3) NOT NULL,
    end_time NUMERIC(10, 3) NOT NULL,
    text TEXT NOT NULL,
    confidence NUMERIC(5, 4) DEFAULT 1.0,
    speaker TEXT
);

CREATE TABLE IF NOT EXISTS public.transcript_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES public.transcript_segments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    word TEXT NOT NULL,
    start_time NUMERIC(10, 3) NOT NULL,
    end_time NUMERIC(10, 3) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. DETECTED MOMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES public.transcripts(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_time NUMERIC(10, 3) NOT NULL,
    end_time NUMERIC(10, 3) NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    reason TEXT,
    category TEXT DEFAULT 'INSIGHT',
    score INTEGER NOT NULL DEFAULT 85,
    transcript_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 7. GENERATED CLIPS (9:16 Vertical Video)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    moment_id UUID REFERENCES public.moments(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    start_time NUMERIC(10, 3) NOT NULL,
    end_time NUMERIC(10, 3) NOT NULL,
    duration_seconds NUMERIC(10, 2) NOT NULL,
    width INTEGER DEFAULT 1080,
    height INTEGER DEFAULT 1920,
    aspect_ratio TEXT DEFAULT '9:16',
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 8. HOOKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    moment_id UUID REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    hook_type TEXT NOT NULL DEFAULT 'CURIOSITY', -- CURIOSITY, CONTRARIAN, STORY, STAT, QUESTION
    score INTEGER NOT NULL DEFAULT 90,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 9. SOCIAL MEDIA CAPTIONS & HASHTAGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_captions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    moment_id UUID REFERENCES public.moments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- Instagram, TikTok, YouTube Shorts, LinkedIn, X
    short_caption TEXT NOT NULL,
    long_caption TEXT,
    cta TEXT,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.hashtags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caption_id UUID NOT NULL REFERENCES public.social_captions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tag TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 10. SUBTITLE TRACKS (SRT / ASS / VTT)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subtitle_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    language TEXT NOT NULL DEFAULT 'en',
    format TEXT NOT NULL DEFAULT 'ASS', -- ASS, SRT, VTT
    storage_path TEXT NOT NULL,
    style TEXT DEFAULT 'ACID',
    position TEXT DEFAULT 'BOTTOM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 11. EDITED / CAPTIONED VIDEOS (Versioned Outputs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.edited_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    caption_style TEXT DEFAULT 'ACID',
    caption_position TEXT DEFAULT 'BOTTOM',
    language TEXT DEFAULT 'en',
    duration_seconds NUMERIC(10, 2) NOT NULL,
    file_size BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.edit_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edited_video_id UUID NOT NULL REFERENCES public.edited_videos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- -----------------------------------------------------------------------------
-- 12. THUMBNAILS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.thumbnails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
    clip_id UUID REFERENCES public.clips(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    timestamp_seconds NUMERIC(10, 2) DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation: User A can NEVER access or mutate User B's data
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_captions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtitle_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edited_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thumbnails ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view/update only their own profile
CREATE POLICY "profiles_owner_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_owner_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects
CREATE POLICY "projects_owner_all" ON public.projects FOR ALL USING (auth.uid() = user_id);

-- Videos
CREATE POLICY "videos_owner_all" ON public.videos FOR ALL USING (auth.uid() = user_id);

-- Processing Jobs
CREATE POLICY "jobs_owner_all" ON public.processing_jobs FOR ALL USING (auth.uid() = user_id);

-- Transcripts & Segments
CREATE POLICY "transcripts_owner_all" ON public.transcripts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "segments_owner_all" ON public.transcript_segments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "words_owner_all" ON public.transcript_words FOR ALL USING (auth.uid() = user_id);

-- Moments
CREATE POLICY "moments_owner_all" ON public.moments FOR ALL USING (auth.uid() = user_id);

-- Clips
CREATE POLICY "clips_owner_all" ON public.clips FOR ALL USING (auth.uid() = user_id);

-- Hooks
CREATE POLICY "hooks_owner_all" ON public.hooks FOR ALL USING (auth.uid() = user_id);

-- Social Captions & Hashtags
CREATE POLICY "captions_owner_all" ON public.social_captions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "hashtags_owner_all" ON public.hashtags FOR ALL USING (auth.uid() = user_id);

-- Subtitles
CREATE POLICY "subtitles_owner_all" ON public.subtitle_tracks FOR ALL USING (auth.uid() = user_id);

-- Edited Videos & Edit Versions
CREATE POLICY "edited_videos_owner_all" ON public.edited_videos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "edit_versions_owner_all" ON public.edit_versions FOR ALL USING (auth.uid() = user_id);

-- Thumbnails
CREATE POLICY "thumbnails_owner_all" ON public.thumbnails FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- STORAGE BUCKETS CONFIGURATION (Supabase Storage)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('cook-originals', 'cook-originals', false, 262144000, ARRAY['video/mp4', 'video/quicktime', 'video/webm']),
    ('cook-audio', 'cook-audio', false, 104857600, ARRAY['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/aac']),
    ('cook-clips', 'cook-clips', false, 104857600, ARRAY['video/mp4']),
    ('cook-captions', 'cook-captions', false, 10485760, ARRAY['text/plain', 'application/x-subrip', 'text/vtt', 'application/octet-stream']),
    ('cook-exports', 'cook-exports', false, 104857600, ARRAY['video/mp4', 'application/zip']),
    ('cook-thumbnails', 'cook-thumbnails', false, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies: Authenticated users can only read/write files in their own folder {auth.uid()}/*
CREATE POLICY "Users can upload to their own folder in cook-originals"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cook-originals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own files in cook-originals"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cook-originals' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own files in cook-originals"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'cook-originals' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Generic policy for all cook buckets
DO $$
DECLARE
    b_name TEXT;
BEGIN
    FOR b_name IN SELECT unnest(ARRAY['cook-audio', 'cook-clips', 'cook-captions', 'cook-exports', 'cook-thumbnails'])
    LOOP
        EXECUTE format('
            CREATE POLICY "Users can insert own files in %1$s" ON storage.objects FOR INSERT TO authenticated
            WITH CHECK (bucket_id = ''%1$s'' AND (storage.foldername(name))[1] = auth.uid()::text);

            CREATE POLICY "Users can select own files in %1$s" ON storage.objects FOR SELECT TO authenticated
            USING (bucket_id = ''%1$s'' AND (storage.foldername(name))[1] = auth.uid()::text);

            CREATE POLICY "Users can delete own files in %1$s" ON storage.objects FOR DELETE TO authenticated
            USING (bucket_id = ''%1$s'' AND (storage.foldername(name))[1] = auth.uid()::text);
        ', b_name);
    END LOOP;
END $$;
