import os
import sys
import unittest
import asyncio
from pathlib import Path

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.services.supabase_service import supabase_service
from app.auth.middleware import get_current_user

class TestSupabaseIntegration(unittest.TestCase):
    def setUp(self):
        self.user_a = {
            "id": "11111111-1111-1111-1111-111111111111",
            "email": "user_a@cook.ai",
            "full_name": "User Alpha",
            "avatar_url": "https://cook.ai/avatar_a.png"
        }
        self.user_b = {
            "id": "22222222-2222-2222-2222-222222222222",
            "email": "user_b@cook.ai",
            "full_name": "User Beta",
            "avatar_url": "https://cook.ai/avatar_b.png"
        }

    def test_01_profile_creation(self):
        p_a = supabase_service.get_or_create_profile(
            self.user_a["id"], self.user_a["email"], self.user_a["full_name"], self.user_a["avatar_url"]
        )
        self.assertEqual(p_a["id"], self.user_a["id"])
        self.assertEqual(p_a["email"], self.user_a["email"])
        print("[TEST PASS] Profile creation and retrieval verified.")

    def test_02_video_creation_and_user_isolation(self):
        # User A creates a video
        v_a = supabase_service.create_video({
            "id": "vid_user_a_001",
            "user_id": self.user_a["id"],
            "original_filename": "alpha_talk.mp4",
            "storage_path": f"{self.user_a['id']}/vid_user_a_001/original.mp4",
            "duration_seconds": 45.0,
            "file_size": 1024000,
            "status": "uploaded"
        })
        self.assertEqual(v_a["id"], "vid_user_a_001")

        # User B creates a video
        v_b = supabase_service.create_video({
            "id": "vid_user_b_001",
            "user_id": self.user_b["id"],
            "original_filename": "beta_talk.mp4",
            "storage_path": f"{self.user_b['id']}/vid_user_b_001/original.mp4",
            "duration_seconds": 60.0,
            "file_size": 2048000,
            "status": "uploaded"
        })
        self.assertEqual(v_b["id"], "vid_user_b_001")

        # Isolation check: User A list contains only A's videos
        a_videos = supabase_service.list_videos(self.user_a["id"])
        a_ids = [v["id"] for v in a_videos]
        self.assertIn("vid_user_a_001", a_ids)
        self.assertNotIn("vid_user_b_001", a_ids)

        # Isolation check: User B cannot get User A's video directly
        self.assertIsNone(supabase_service.get_video("vid_user_a_001", user_id=self.user_b["id"]))
        self.assertIsNotNone(supabase_service.get_video("vid_user_a_001", user_id=self.user_a["id"]))
        print("[TEST PASS] Multi-user data isolation verified: User B cannot access User A's videos.")

    def test_03_processing_job_and_transcript_persistence(self):
        job = supabase_service.create_processing_job("vid_user_a_001", self.user_a["id"])
        self.assertEqual(job["video_id"], "vid_user_a_001")
        self.assertEqual(job["status"], "QUEUED")

        # Save transcript
        t_data = {
            "id": "tr_vid_user_a_001",
            "video_id": "vid_user_a_001",
            "user_id": self.user_a["id"],
            "text": "The single most important lesson in high retention short form content is pacing.",
            "language": "en",
            "word_count": 13,
            "segments": [
                {"start": 0.0, "end": 4.5, "text": "The single most important lesson in high retention short form content is pacing."}
            ]
        }
        supabase_service.save_transcript(t_data)
        fetched_t = supabase_service.get_transcript("vid_user_a_001")
        self.assertIsNotNone(fetched_t)
        self.assertEqual(fetched_t["word_count"], 13)
        print("[TEST PASS] Processing job and relational transcript persistence verified.")

    def test_04_moments_and_clips_persistence(self):
        moments = [{
            "id": "mom_001",
            "start_time": 0.0,
            "end_time": 4.5,
            "topic": "High Retention Pacing",
            "reason": "Clear spoken hook with instant idea density.",
            "score": 96,
            "transcript": "The single most important lesson in high retention short form content is pacing."
        }]
        supabase_service.save_moments("vid_user_a_001", self.user_a["id"], moments)

        clips = [{
            "id": "clip_user_a_1",
            "video_id": "vid_user_a_001",
            "clip_number": 1,
            "start_time": 0.0,
            "end_time": 4.5,
            "duration": 4.5,
            "vertical_video_url": "/outputs/clip_user_a_1_vertical.mp4",
            "captioned_video_url": "/outputs/clip_user_a_1_captioned.mp4",
            "status": "ready",
            "hook": "The real reason why high retention short form content is pacing...",
            "topic": "High Retention Pacing",
            "score": 96,
            "hook_score": 98,
            "information_score": 95,
            "emotion_score": 90,
            "curiosity_score": 96,
            "shareability_score": 94,
            "standalone_value": 95,
            "metadata": {
                "hooks": ["The real reason why high retention short form content is pacing..."],
                "selected_hook": "The real reason why high retention short form content is pacing...",
                "titles": ["Mastering Short-Form Video Pacing"],
                "selected_title": "Mastering Short-Form Video Pacing",
                "caption": "Pacing is everything in short-form video. Here is why.",
                "platform_captions": {"instagram": "Pacing is everything in short-form video."},
                "hashtags": ["#ShortForm", "#Retention"]
            }
        }]
        supabase_service.save_clips("vid_user_a_001", self.user_a["id"], clips)

        fetched_clips = supabase_service.get_clips("vid_user_a_001")
        self.assertEqual(len(fetched_clips), 1)
        self.assertEqual(fetched_clips[0]["id"], "clip_user_a_1")
        print("[TEST PASS] Moments, clips, and rich metadata persistence verified.")

    def test_05_edited_video_versioning(self):
        edit = supabase_service.create_edited_video(
            user_id=self.user_a["id"],
            video_id="vid_user_a_001",
            clip_id="clip_user_a_1",
            storage_path=f"{self.user_a['id']}/vid_user_a_001/clip_user_a_1/v1.mp4",
            version=1,
            caption_style="ACID",
            caption_position="BOTTOM",
            language="en",
            duration_seconds=4.5,
            file_size=512000
        )
        self.assertEqual(edit["version"], 1)
        
        edits_list = supabase_service.list_edited_videos(self.user_a["id"])
        self.assertTrue(any(e["clip_id"] == "clip_user_a_1" for e in edits_list))
        print("[TEST PASS] Versioned edited video persistence and history tracking verified.")

    def test_06_dashboard_aggregates(self):
        dash = supabase_service.get_dashboard_data(self.user_a["id"])
        self.assertGreaterEqual(dash["total_videos_count"], 1)
        self.assertGreaterEqual(dash["total_clips_count"], 1)
        self.assertGreaterEqual(dash["total_hooks_count"], 1)
        print(f"[TEST PASS] Dashboard data aggregation verified: {dash['total_videos_count']} videos, {dash['total_clips_count']} clips.")

    def test_07_cascading_delete(self):
        success = supabase_service.delete_video("vid_user_a_001", self.user_a["id"])
        self.assertTrue(success)
        self.assertIsNone(supabase_service.get_video("vid_user_a_001"))
        self.assertEqual(len(supabase_service.get_clips("vid_user_a_001")), 0)
        print("[TEST PASS] Cascading deletion of video, clips, and associated metadata verified.")

if __name__ == "__main__":
    unittest.main()
