"""
Safe cleanup script to identify and clean database records whose storage objects are missing.
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.services.supabase_service import supabase_service, get_original_video_storage_path
from app.services.storage import storage
from app.config import BUCKET_ORIGINALS

def audit_and_cleanup_records(dry_run: bool = False):
    print("\n" + "="*70)
    print(" COOK DATABASE & STORAGE AUDIT")
    print("="*70)
    
    # 1. Fetch all videos from local DB and Supabase
    all_videos = {}
    
    # From Supabase/local mirror
    sb_videos = supabase_service.local_db.get("videos", {})
    for vid, rec in sb_videos.items():
        all_videos[vid] = rec
        
    # From storage service videos.json
    try:
        st_videos = storage.list_videos()
        for v in st_videos:
            vid = v.get("id")
            if vid and vid not in all_videos:
                all_videos[vid] = v
    except Exception:
        pass

    if not all_videos:
        print("No video records found in database.")
        return

    print(f"Auditing {len(all_videos)} video record(s)...\n")
    print(f"{'VIDEO ID':<22} | {'OBJECT EXISTS':<14} | {'STORAGE PATH'}")
    print("-" * 70)

    orphaned_ids = []
    valid_ids = []

    for vid, v in all_videos.items():
        uid = v.get("user_id", "00000000-0000-0000-0000-000000000001")
        ext = Path(v.get("original_filename", v.get("filename", "video.mp4"))).suffix.lower() or ".mp4"
        storage_path = v.get("storage_path") or get_original_video_storage_path(uid, vid, ext)
        bucket = v.get("storage_bucket") or BUCKET_ORIGINALS
        
        exists, size = supabase_service.check_storage_object_exists(bucket, storage_path)
        
        status_str = f"YES ({size} B)" if exists else "NO (MISSING)"
        print(f"{vid:<22} | {status_str:<14} | {storage_path}")
        
        if not exists:
            orphaned_ids.append((vid, storage_path))
        else:
            valid_ids.append((vid, storage_path))

    print("-" * 70)
    print(f"Summary: {len(valid_ids)} valid, {len(orphaned_ids)} orphaned/broken records.\n")

    if orphaned_ids:
        print(f"Found {len(orphaned_ids)} orphaned records:")
        for vid, sp in orphaned_ids:
            print(f"  - {vid} -> {sp}")
            
        if not dry_run:
            print("\nCleaning confirmed orphaned records...")
            for vid, _ in orphaned_ids:
                supabase_service.delete_video(vid)
                storage.delete_video(vid)
                print(f"  [CLEANED] Removed orphan record {vid} from database.")
            print("Cleanup complete.")
        else:
            print("\nDry-run mode: no records deleted.")

if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    audit_and_cleanup_records(dry_run=dry_run)
