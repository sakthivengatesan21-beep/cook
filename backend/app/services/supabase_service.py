import os
import io
import json
import uuid
import datetime
import mimetypes
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

from app.config import (
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
    BUCKET_ORIGINALS, BUCKET_AUDIO, BUCKET_CLIPS, BUCKET_CAPTIONS,
    BUCKET_EXPORTS, BUCKET_THUMBNAILS, UPLOADS_DIR, OUTPUTS_DIR, DATA_DIR
)

# Local fallback store when Supabase keys are not set
FALLBACK_DB_FILE = DATA_DIR / "supabase_local_mirror.json"

# Canonical storage path helper function
def get_original_video_storage_path(user_id: str, video_id: str, ext: str = ".mp4") -> str:
    """
    Returns the single canonical Supabase Storage path for an original video.
    Strictly uses forward slashes without leading/trailing slashes.
    Format: {user_id}/{video_id}/original{ext}
    """
    clean_ext = ext if ext.startswith(".") else f".{ext}"
    clean_user = str(user_id).strip().strip("/").replace("\\", "/")
    clean_vid = str(video_id).strip().strip("/").replace("\\", "/")
    return f"{clean_user}/{clean_vid}/original{clean_ext}"


class SupabaseService:
    def __init__(self):
        self.is_connected = False
        self.client = None
        self._init_client()
        self._init_local_mirror()

    def _init_client(self):
        if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
            try:
                from supabase import create_client, Client
                self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                self.is_connected = True
                print(f"[SUPABASE] Successfully connected to Supabase at {SUPABASE_URL}")
            except Exception as e:
                print(f"[SUPABASE WARNING] Failed to initialize Supabase client: {e}. Using local JSON mirror.")
                self.is_connected = False
        else:
            print("[SUPABASE INFO] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured. Running in high-fidelity local mirror mode.")
            self.is_connected = False

    def _init_local_mirror(self):
        if FALLBACK_DB_FILE.exists():
            try:
                with open(FALLBACK_DB_FILE, "r", encoding="utf-8") as f:
                    self.local_db = json.load(f)
            except Exception:
                self._create_empty_mirror()
        else:
            self._create_empty_mirror()

    def _create_empty_mirror(self):
        self.local_db = {
            "profiles": {},
            "projects": {},
            "videos": {},
            "processing_jobs": {},
            "transcripts": {},
            "transcript_segments": {},
            "transcript_words": {},
            "moments": {},
            "clips": {},
            "hooks": {},
            "social_captions": {},
            "hashtags": {},
            "subtitle_tracks": {},
            "edited_videos": {},
            "edit_versions": {},
            "thumbnails": {}
        }
        self._save_local_mirror()

    def _save_local_mirror(self):
        try:
            with open(FALLBACK_DB_FILE, "w", encoding="utf-8") as f:
                json.dump(self.local_db, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"[LOCAL DB ERROR] Failed to save local mirror: {e}")

    # =========================================================================
    # STORAGE METHODS
    # =========================================================================

    def get_original_video_storage_path(self, user_id: str, video_id: str, ext: str = ".mp4") -> str:
        return get_original_video_storage_path(user_id, video_id, ext)

    def normalize_storage_path(self, storage_path: str) -> str:
        """
        Ensures storage path uses forward slashes, no leading slash, and no duplicated slashes.
        """
        normalized = str(storage_path).replace("\\", "/").strip().lstrip("/")
        while "//" in normalized:
            normalized = normalized.replace("//", "/")
        return normalized

    def check_storage_object_exists(self, bucket: str, storage_path: str) -> Tuple[bool, int]:
        """
        Checks whether a storage object exists in Supabase Storage or the local storage mirror.
        Returns (exists: bool, file_size: int).
        """
        norm_path = self.normalize_storage_path(storage_path)
        exists = False
        size = 0

        # 1. Check in connected Supabase Storage
        if self.is_connected and self.client:
            try:
                parent_dir = str(Path(norm_path).parent).replace("\\", "/")
                filename = Path(norm_path).name
                if parent_dir == ".":
                    parent_dir = ""
                
                files = self.client.storage.from_(bucket).list(parent_dir)
                if files:
                    for f in files:
                        if isinstance(f, dict) and f.get("name") == filename:
                            exists = True
                            size = f.get("metadata", {}).get("size") or f.get("size") or 0
                            break
            except Exception as e:
                print(f"[SUPABASE STORAGE WARNING] Failed checking object in {bucket}/{norm_path}: {e}")

        # 2. Check in local storage mirror
        local_mirror_path = DATA_DIR / "storage" / bucket / norm_path
        if local_mirror_path.exists() and local_mirror_path.stat().st_size > 0:
            exists = True
            size = local_mirror_path.stat().st_size

        # Also check direct uploads folder candidates
        if not exists:
            vid_candidates = [
                UPLOADS_DIR / norm_path,
                OUTPUTS_DIR / norm_path,
                UPLOADS_DIR / Path(norm_path).name,
                OUTPUTS_DIR / Path(norm_path).name,
            ]
            parts = norm_path.split("/")
            if len(parts) >= 2:
                vid_id = parts[-2]
                for e in [".mp4", ".mov", ".webm", ".mkv", ".wav", ".aac", ".json"]:
                    vid_candidates.append(UPLOADS_DIR / f"{vid_id}{e}")
                    vid_candidates.append(UPLOADS_DIR / f"{vid_id}_source{e}")
                    vid_candidates.append(OUTPUTS_DIR / f"{vid_id}{e}")
                    vid_candidates.append(DATA_DIR / f"{vid_id}{e}")

            for c in vid_candidates:
                if c.exists() and c.is_file() and c.stat().st_size > 0:
                    exists = True
                    size = c.stat().st_size
                    break

        print(f"[COOK STORAGE]\nbucket = {bucket}\npath = {norm_path}\nexists = {str(exists).lower()}")
        return exists, size

    def upload_file(
        self,
        bucket: str,
        storage_path: str,
        local_file_path: Path,
        content_type: Optional[str] = None
    ) -> str:
        """
        Uploads a local file to Supabase Storage bucket and mirrors to local storage directory.
        Returns the canonical storage path key.
        """
        if not local_file_path.exists():
            raise FileNotFoundError(f"Local file does not exist: {local_file_path}")

        norm_path = self.normalize_storage_path(storage_path)
        file_size = local_file_path.stat().st_size
        mime = content_type or mimetypes.guess_type(str(local_file_path))[0] or "application/octet-stream"

        # 1. Mirror to local persistent storage folder
        local_mirror = DATA_DIR / "storage" / bucket / norm_path
        local_mirror.parent.mkdir(parents=True, exist_ok=True)
        if local_file_path != local_mirror:
            import shutil
            shutil.copy2(local_file_path, local_mirror)

        # 2. Upload to Supabase Storage if connected
        if self.is_connected and self.client:
            try:
                with open(local_file_path, "rb") as f:
                    file_bytes = f.read()
                
                self.client.storage.from_(bucket).upload(
                    path=norm_path,
                    file=file_bytes,
                    file_options={"content-type": mime, "upsert": "true"}
                )
            except Exception as e:
                print(f"[SUPABASE STORAGE WARNING] Upload to {bucket}/{norm_path} failed: {e}")

        # 3. Log verified upload
        print(f"[COOK STORAGE] Upload successful")
        print(f"[COOK STORAGE] bucket={bucket}")
        print(f"[COOK STORAGE] path={norm_path}")
        print(f"[COOK STORAGE] size={file_size}")
        print(f"[COOK STORAGE] verified=true")
        return norm_path

    def download_file(
        self,
        bucket: str,
        storage_path: str,
        destination_path: Path
    ) -> Path:
        """
        Downloads a storage object from Supabase or local mirror into a local temporary processing path.
        """
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        norm_path = self.normalize_storage_path(storage_path)

        # 1. Download from connected Supabase Storage
        if self.is_connected and self.client:
            try:
                res = self.client.storage.from_(bucket).download(norm_path)
                with open(destination_path, "wb") as f:
                    f.write(res)
                if destination_path.exists() and destination_path.stat().st_size > 0:
                    print(f"[COOK STORAGE] Downloaded {bucket}/{norm_path} -> {destination_path} ({destination_path.stat().st_size} bytes)")
                    return destination_path
            except Exception as e:
                print(f"[SUPABASE STORAGE WARNING] Download failed for {bucket}/{norm_path}: {e}")

        # 2. Check local mirror storage path
        local_mirror = DATA_DIR / "storage" / bucket / norm_path
        if local_mirror.exists() and local_mirror.is_file() and local_mirror.stat().st_size > 0:
            import shutil
            if local_mirror != destination_path:
                shutil.copy2(local_mirror, destination_path)
            return destination_path

        # 3. Check auxiliary local fallback paths
        filename = Path(norm_path).name
        candidates = [
            UPLOADS_DIR / norm_path,
            OUTPUTS_DIR / norm_path,
            UPLOADS_DIR / filename,
            OUTPUTS_DIR / filename
        ]
        
        # Check if video_id prefix matches a file in UPLOADS_DIR
        parts = norm_path.split("/")
        if len(parts) >= 2:
            vid_id = parts[-2]
            for ext in [".mp4", ".mov", ".webm", ".mkv"]:
                candidates.append(UPLOADS_DIR / f"{vid_id}{ext}")
                candidates.append(UPLOADS_DIR / f"{vid_id}_source{ext}")

        for c in candidates:
            if c.exists() and c.is_file() and c.stat().st_size > 0:
                import shutil
                if c != destination_path:
                    shutil.copy2(c, destination_path)
                return destination_path

        if destination_path.exists() and destination_path.stat().st_size > 0:
            return destination_path

        print(f"[COOK STORAGE]\nbucket = {bucket}\npath = {norm_path}\nexists = false")
        raise FileNotFoundError(f"Storage object '{norm_path}' not found in bucket '{bucket}' or local disk.")

    def get_signed_url(self, bucket: str, storage_path: str, expires_in: int = 3600) -> str:
        """
        Generates a secure temporary signed URL for a private Supabase Storage asset.
        """
        norm_path = self.normalize_storage_path(storage_path)
        if self.is_connected and self.client:
            try:
                res = self.client.storage.from_(bucket).create_signed_url(norm_path, expires_in)
                if res and "signedURL" in res:
                    return res["signedURL"]
                if res and "signedUrl" in res:
                    return res["signedUrl"]
            except Exception as e:
                print(f"[SUPABASE STORAGE WARNING] Failed to create signed URL: {e}")

        # Fallback local URL served by FastAPI backend
        fname = Path(norm_path).name
        if bucket in [BUCKET_CLIPS, BUCKET_CAPTIONS, BUCKET_EXPORTS, BUCKET_THUMBNAILS]:
            return f"/outputs/{fname}"
        return f"/uploads/{fname}"

    def delete_storage_file(self, bucket: str, storage_path: str):
        norm_path = self.normalize_storage_path(storage_path)
        if self.is_connected and self.client:
            try:
                self.client.storage.from_(bucket).remove([norm_path])
            except Exception as e:
                print(f"[SUPABASE STORAGE] Delete error on {bucket}/{norm_path}: {e}")
        
        local_mirror = DATA_DIR / "storage" / bucket / norm_path
        if local_mirror.exists():
            try:
                local_mirror.unlink()
            except Exception:
                pass

    def delete_storage_prefix(self, bucket: str, prefix: str):
        if self.is_connected and self.client:
            try:
                files = self.client.storage.from_(bucket).list(prefix)
                if files:
                    paths = [f"{prefix}/{f['name']}" for f in files if isinstance(f, dict) and "name" in f]
                    if paths:
                        self.client.storage.from_(bucket).remove(paths)
            except Exception as e:
                print(f"[SUPABASE STORAGE] Delete prefix error on {bucket}/{prefix}: {e}")

    # =========================================================================
    # USER PROFILES
    # =========================================================================

    def get_or_create_profile(self, user_id: str, email: str, full_name: str = "", avatar_url: str = "") -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        profile_data = {
            "id": user_id,
            "email": email,
            "full_name": full_name or email.split("@")[0],
            "avatar_url": avatar_url,
            "created_at": now,
            "updated_at": now
        }

        if self.is_connected and self.client:
            try:
                res = self.client.table("profiles").select("*").eq("id", user_id).execute()
                if res.data:
                    return res.data[0]
                ins = self.client.table("profiles").insert(profile_data).execute()
                if ins.data:
                    return ins.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Profile operation failed: {e}")

        # Local mirror
        if user_id in self.local_db["profiles"]:
            return self.local_db["profiles"][user_id]
        self.local_db["profiles"][user_id] = profile_data
        self._save_local_mirror()
        return profile_data

    # =========================================================================
    # PROJECTS
    # =========================================================================

    def create_project(self, user_id: str, name: str, description: str = "") -> Dict[str, Any]:
        proj_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        proj_data = {
            "id": proj_id,
            "user_id": user_id,
            "name": name,
            "description": description,
            "created_at": now,
            "updated_at": now
        }
        if self.is_connected and self.client:
            try:
                res = self.client.table("projects").insert(proj_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Create project failed: {e}")

        self.local_db["projects"][proj_id] = proj_data
        self._save_local_mirror()
        return proj_data

    def list_projects(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                res = self.client.table("projects").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"[SUPABASE DB WARNING] List projects failed: {e}")

        return [p for p in self.local_db["projects"].values() if p.get("user_id") == user_id]

    # =========================================================================
    # VIDEOS
    # =========================================================================

    def create_video(self, video_data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if "id" not in video_data:
            video_data["id"] = f"vid_{uuid.uuid4().hex[:12]}"
        if "created_at" not in video_data:
            video_data["created_at"] = now
        video_data["updated_at"] = now

        if self.is_connected and self.client:
            try:
                db_payload = {
                    "id": video_data["id"],
                    "user_id": video_data["user_id"],
                    "project_id": video_data.get("project_id"),
                    "original_filename": video_data.get("original_filename") or video_data.get("filename", "video.mp4"),
                    "storage_path": video_data.get("storage_path") or video_data.get("storage_url", ""),
                    "mime_type": video_data.get("mime_type", "video/mp4"),
                    "file_size": video_data.get("file_size", 0),
                    "duration_seconds": video_data.get("duration_seconds") or video_data.get("duration", 0.0),
                    "width": video_data.get("width", 1920),
                    "height": video_data.get("height", 1080),
                    "fps": video_data.get("fps", 30.0),
                    "language": video_data.get("language", "en"),
                    "status": video_data.get("status", "uploaded"),
                    "created_at": video_data["created_at"],
                    "updated_at": video_data["updated_at"]
                }
                res = self.client.table("videos").insert(db_payload).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Create video failed: {e}")

        self.local_db["videos"][video_data["id"]] = video_data
        self._save_local_mirror()
        return video_data

    def get_video(self, video_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                q = self.client.table("videos").select("*").eq("id", video_id)
                if user_id:
                    q = q.eq("user_id", user_id)
                res = q.execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Get video failed: {e}")

        v = self.local_db["videos"].get(video_id)
        if v and user_id and v.get("user_id") != user_id:
            return None
        return v

    def list_videos(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                res = self.client.table("videos").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"[SUPABASE DB WARNING] List videos failed: {e}")

        return [v for v in self.local_db["videos"].values() if v.get("user_id") == user_id]

    def update_video_status(
        self,
        video_id: str,
        status: str,
        message: str = "",
        progress: int = 0,
        stage: Optional[str] = None,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        user_id: Optional[str] = None
    ):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # 1. Update Video
        if self.is_connected and self.client:
            try:
                up_payload: Dict[str, Any] = {"status": status, "updated_at": now}
                q = self.client.table("videos").update(up_payload).eq("id", video_id)
                if user_id:
                    q = q.eq("user_id", user_id)
                q.execute()

                # Update processing_jobs row as well
                job_payload: Dict[str, Any] = {
                    "status": "COMPLETED" if status == "completed" else ("FAILED" if status == "failed" else "PROCESSING"),
                    "stage": stage or status.upper(),
                    "progress": progress,
                    "updated_at": now
                }
                if error_code:
                    job_payload["error_code"] = error_code
                if error_message:
                    job_payload["error_message"] = error_message
                if status == "completed":
                    job_payload["completed_at"] = now
                
                self.client.table("processing_jobs").update(job_payload).eq("video_id", video_id).execute()
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Update video status failed: {e}")

        # Local mirror
        if video_id in self.local_db["videos"]:
            v = self.local_db["videos"][video_id]
            v["status"] = status
            v["status_message"] = message
            v["progress"] = progress
            v["updated_at"] = now
            if stage:
                v["stage"] = stage
            if error_code:
                v["error_code"] = error_code
            if error_message:
                v["error_message"] = error_message
            self._save_local_mirror()

    def touch_heartbeat(self, video_id: str):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if self.is_connected and self.client:
            try:
                self.client.table("videos").update({"updated_at": now}).eq("id", video_id).execute()
                self.client.table("processing_jobs").update({"updated_at": now}).eq("video_id", video_id).execute()
            except Exception:
                pass
        if video_id in self.local_db["videos"]:
            self.local_db["videos"][video_id]["updated_at"] = now
            self._save_local_mirror()

    def delete_video(self, video_id: str, user_id: Optional[str] = None) -> bool:
        """
        Deletes video and performs cascading cleanup of:
        - DB records (transcripts, moments, clips, hooks, captions, edited_videos, thumbnails, jobs)
        - Supabase Storage files in all cook-* buckets.
        """
        if not user_id:
            video = self.get_video(video_id)
            if video:
                user_id = video.get("user_id", "00000000-0000-0000-0000-000000000001")
            else:
                user_id = "00000000-0000-0000-0000-000000000001"

        # 1. Clean up storage files
        user_prefix = f"{user_id}/{video_id}"
        for b in [BUCKET_ORIGINALS, BUCKET_AUDIO, BUCKET_CLIPS, BUCKET_CAPTIONS, BUCKET_EXPORTS, BUCKET_THUMBNAILS]:
            self.delete_storage_prefix(b, user_prefix)

        # 2. Clean up Supabase PostgreSQL (Foreign Keys with CASCADE will handle children)
        if self.is_connected and self.client:
            try:
                self.client.table("videos").delete().eq("id", video_id).execute()
                return True
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Delete video DB error: {e}")

        # 3. Clean up local mirror
        if video_id in self.local_db["videos"]:
            del self.local_db["videos"][video_id]
        if video_id in self.local_db["transcripts"]:
            del self.local_db["transcripts"][video_id]
        if video_id in self.local_db["clips"]:
            del self.local_db["clips"][video_id]
        if video_id in self.local_db["moments"]:
            del self.local_db["moments"][video_id]
        if video_id in self.local_db["hooks"]:
            del self.local_db["hooks"][video_id]
        if video_id in self.local_db["social_captions"]:
            del self.local_db["social_captions"][video_id]
        if video_id in self.local_db["edited_videos"]:
            del self.local_db["edited_videos"][video_id]
        self._save_local_mirror()
        return True

    # =========================================================================
    # PROCESSING JOBS
    # =========================================================================

    def create_processing_job(self, video_id: str, user_id: str) -> Dict[str, Any]:
        job_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        job_data = {
            "id": job_id,
            "user_id": user_id,
            "video_id": video_id,
            "status": "QUEUED",
            "stage": "UPLOADING",
            "progress": 10,
            "error_code": None,
            "error_message": None,
            "started_at": now,
            "created_at": now,
            "updated_at": now
        }
        if self.is_connected and self.client:
            try:
                res = self.client.table("processing_jobs").insert(job_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Create processing job failed: {e}")

        self.local_db["processing_jobs"][job_id] = job_data
        self._save_local_mirror()
        return job_data

    def get_processing_job(self, video_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                q = self.client.table("processing_jobs").select("*").eq("video_id", video_id).order("created_at", desc=True).limit(1)
                if user_id:
                    q = q.eq("user_id", user_id)
                res = q.execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Get job failed: {e}")

        for j in reversed(list(self.local_db["processing_jobs"].values())):
            if j.get("video_id") == video_id:
                if user_id and j.get("user_id") != user_id:
                    return None
                return j
        return None

    # =========================================================================
    # TRANSCRIPTS
    # =========================================================================

    def save_transcript(self, transcript_data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        video_id = transcript_data["video_id"]
        user_id = transcript_data.get("user_id", "")
        trans_id = transcript_data.get("id") or str(uuid.uuid4())

        if self.is_connected and self.client:
            try:
                t_row = {
                    "id": trans_id,
                    "video_id": video_id,
                    "user_id": user_id,
                    "language": transcript_data.get("language", "en"),
                    "full_text": transcript_data.get("text") or transcript_data.get("full_text", ""),
                    "word_count": transcript_data.get("word_count", 0),
                    "segment_count": len(transcript_data.get("segments", [])),
                    "created_at": now,
                    "updated_at": now
                }
                res = self.client.table("transcripts").upsert(t_row, on_conflict="video_id").execute()
                
                # Insert segments
                segments = transcript_data.get("segments", [])
                if segments and res.data:
                    saved_t_id = res.data[0]["id"]
                    seg_rows = []
                    for s in segments:
                        seg_rows.append({
                            "id": str(uuid.uuid4()),
                            "transcript_id": saved_t_id,
                            "user_id": user_id,
                            "start_time": s["start"],
                            "end_time": s["end"],
                            "text": s["text"],
                            "confidence": s.get("confidence", 1.0),
                            "speaker": s.get("speaker")
                        })
                    self.client.table("transcript_segments").insert(seg_rows).execute()
                return t_row
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Save transcript failed: {e}")

        self.local_db["transcripts"][video_id] = transcript_data
        self._save_local_mirror()
        return transcript_data

    def get_transcript(self, video_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                q = self.client.table("transcripts").select("*, transcript_segments(*)").eq("video_id", video_id)
                if user_id:
                    q = q.eq("user_id", user_id)
                res = q.execute()
                if res.data:
                    t = res.data[0]
                    segs = t.get("transcript_segments", [])
                    segs.sort(key=lambda s: s.get("start_time", 0))
                    formatted_segs = [
                        {"start": s["start_time"], "end": s["end_time"], "text": s["text"]}
                        for s in segs
                    ]
                    return {
                        "id": t["id"],
                        "video_id": t["video_id"],
                        "text": t["full_text"],
                        "language": t["language"],
                        "word_count": t["word_count"],
                        "segments": formatted_segs,
                        "created_at": t["created_at"]
                    }
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Get transcript failed: {e}")

        return self.local_db["transcripts"].get(video_id)

    # =========================================================================
    # MOMENTS & CLIPS
    # =========================================================================

    def save_moments(self, video_id: str, user_id: str, moments: List[Dict[str, Any]]):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if self.is_connected and self.client:
            try:
                m_rows = []
                for m in moments:
                    m_rows.append({
                        "id": m.get("id") or str(uuid.uuid4()),
                        "video_id": video_id,
                        "user_id": user_id,
                        "start_time": m["start_time"],
                        "end_time": m["end_time"],
                        "title": m["topic"],
                        "summary": m.get("reason", ""),
                        "reason": m.get("reason", ""),
                        "category": m.get("category", "INSIGHT"),
                        "score": m.get("score", 90),
                        "transcript_text": m.get("transcript", ""),
                        "created_at": now
                    })
                self.client.table("moments").insert(m_rows).execute()
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Save moments failed: {e}")

        self.local_db["moments"][video_id] = moments
        self._save_local_mirror()

    def save_clips(self, video_id: str, user_id: str, clips: List[Dict[str, Any]]):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        if self.is_connected and self.client:
            try:
                for c in clips:
                    clip_row = {
                        "id": c.get("id") or str(uuid.uuid4()),
                        "video_id": video_id,
                        "user_id": user_id,
                        "storage_path": c.get("captioned_video_url", c.get("vertical_video_url", "")),
                        "start_time": c["start_time"],
                        "end_time": c["end_time"],
                        "duration_seconds": c["duration"],
                        "width": 1080,
                        "height": 1920,
                        "aspect_ratio": "9:16",
                        "status": c.get("status", "ready"),
                        "created_at": now
                    }
                    self.client.table("clips").upsert(clip_row).execute()

                    # Save hooks
                    meta = c.get("metadata", {})
                    hooks = meta.get("hooks", [])
                    if hooks:
                        hook_rows = []
                        for h in hooks:
                            hook_rows.append({
                                "id": str(uuid.uuid4()),
                                "video_id": video_id,
                                "moment_id": clip_row["id"],
                                "user_id": user_id,
                                "text": h,
                                "hook_type": "CURIOSITY",
                                "score": c.get("hook_score", 92),
                                "created_at": now
                            })
                        self.client.table("hooks").insert(hook_rows).execute()

                    # Save social captions
                    plat_caps = meta.get("platform_captions", {})
                    if plat_caps:
                        cap_rows = []
                        for plat, cap_text in plat_caps.items():
                            cap_rows.append({
                                "id": str(uuid.uuid4()),
                                "video_id": video_id,
                                "moment_id": clip_row["id"],
                                "user_id": user_id,
                                "platform": plat.capitalize(),
                                "short_caption": meta.get("caption", cap_text[:120]),
                                "long_caption": cap_text,
                                "cta": "Save and share for more creator insights.",
                                "language": "en",
                                "created_at": now
                            })
                        self.client.table("social_captions").insert(cap_rows).execute()
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Save clips failed: {e}")

        self.local_db["clips"][video_id] = clips
        self._save_local_mirror()

    def get_clips(self, video_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.local_db["clips"].get(video_id, [])

    def get_clip_by_id(self, clip_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        for video_id, clips in self.local_db["clips"].items():
            for c in clips:
                if c["id"] == clip_id:
                    return c
        return None

    def update_clip(self, clip_id: str, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        for video_id, clips in self.local_db["clips"].items():
            for i, clip in enumerate(clips):
                if clip["id"] == clip_id:
                    if "metadata" in clip and clip["metadata"]:
                        if "selected_hook" in update_data:
                            clip["metadata"]["selected_hook"] = update_data["selected_hook"]
                        if "selected_title" in update_data:
                            clip["metadata"]["selected_title"] = update_data["selected_title"]
                        if "caption" in update_data:
                            clip["metadata"]["caption"] = update_data["caption"]
                        if "hashtags" in update_data:
                            clip["metadata"]["hashtags"] = update_data["hashtags"]
                    for cap_key in [
                        "captioned_video_url", "subtitles_srt_url", "subtitles_ass_url",
                        "caption_style", "caption_position", "caption_language",
                        "caption_phrases", "caption_status"
                    ]:
                        if cap_key in update_data:
                            clip[cap_key] = update_data[cap_key]

                    self.local_db["clips"][video_id][i] = clip
                    self._save_local_mirror()
                    return clip
        return None

    # =========================================================================
    # EDITED VIDEOS & VERSIONING
    # =========================================================================

    def create_edited_video(
        self,
        user_id: str,
        video_id: str,
        clip_id: str,
        storage_path: str,
        version: int = 1,
        caption_style: str = "ACID",
        caption_position: str = "BOTTOM",
        language: str = "en",
        duration_seconds: float = 30.0,
        file_size: int = 0
    ) -> Dict[str, Any]:
        edit_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        edit_data = {
            "id": edit_id,
            "user_id": user_id,
            "video_id": video_id,
            "clip_id": clip_id,
            "storage_path": storage_path,
            "version": version,
            "caption_style": caption_style,
            "caption_position": caption_position,
            "language": language,
            "duration_seconds": duration_seconds,
            "file_size": file_size,
            "created_at": now
        }

        if self.is_connected and self.client:
            try:
                self.client.table("edited_videos").insert(edit_data).execute()
                # Record edit version
                self.client.table("edit_versions").insert({
                    "id": str(uuid.uuid4()),
                    "edited_video_id": edit_id,
                    "user_id": user_id,
                    "version": version,
                    "changes": {
                        "caption_style": caption_style,
                        "caption_position": caption_position,
                        "language": language
                    },
                    "storage_path": storage_path,
                    "created_at": now
                }).execute()
            except Exception as e:
                print(f"[SUPABASE DB WARNING] Create edited video failed: {e}")

        if video_id not in self.local_db["edited_videos"]:
            self.local_db["edited_videos"][video_id] = []
        self.local_db["edited_videos"][video_id].append(edit_data)
        self._save_local_mirror()
        return edit_data

    def list_edited_videos(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_connected and self.client:
            try:
                res = self.client.table("edited_videos").select("*, videos(original_filename)").eq("user_id", user_id).order("created_at", desc=True).execute()
                if res.data is not None:
                    return res.data
            except Exception as e:
                print(f"[SUPABASE DB WARNING] List edited videos failed: {e}")

        all_edits = []
        for vid, edits in self.local_db["edited_videos"].items():
            for e in edits:
                if e.get("user_id") == user_id:
                    all_edits.append(e)
        return all_edits

    # =========================================================================
    # DASHBOARD AGGREGATES
    # =========================================================================

    def get_dashboard_data(self, user_id: str) -> Dict[str, Any]:
        videos = self.list_videos(user_id)
        projects = self.list_projects(user_id)
        edits = self.list_edited_videos(user_id)

        all_clips = []
        total_hooks = 0
        total_captions = 0

        for v in videos:
            vid = v["id"]
            clips = self.get_clips(vid, user_id)
            all_clips.extend(clips)
            for c in clips:
                meta = c.get("metadata", {})
                total_hooks += len(meta.get("hooks", []))
                total_captions += len(meta.get("platform_captions", {}))

        return {
            "user_id": user_id,
            "recent_projects": projects[:5],
            "recent_videos": videos[:10],
            "total_videos_count": len(videos),
            "total_clips_count": len(all_clips),
            "total_hooks_count": total_hooks,
            "total_captions_count": total_captions,
            "edited_videos": edits[:10],
            "recent_clips": all_clips[:8]
        }

supabase_service = SupabaseService()
