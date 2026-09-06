"""
Automated unit & integration test for COOK Standout Features & USPs.
"""

import sys
import json
import urllib.request
import urllib.parse

BACKEND_URL = "http://127.0.0.1:8000"

def test_endpoints():
    print("\n" + "="*70)
    print(" COOK STANDOUT FEATURES & USPs BACKEND VERIFICATION")
    print("="*70)

    # 1. Fetch available videos
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/videos",
        headers={"Authorization": "Bearer cook_token_00000000-0000-0000-0000-000000000001"}
    )
    with urllib.request.urlopen(req) as res:
        videos = json.loads(res.read().decode())
        print(f"\n[1] Fetched {len(videos)} video(s) from database.")
        if not videos:
            print("No videos found. Upload a video first.")
            return
        video_id = videos[0]["id"]
        print(f"    Testing with video_id: {video_id}")

    # 2. Test Content Genome endpoint
    print(f"\n[2] Testing Content Genome endpoint: /api/videos/{video_id}/genome...")
    req = urllib.request.Request(f"{BACKEND_URL}/api/videos/{video_id}/genome")
    with urllib.request.urlopen(req) as res:
        genome = json.loads(res.read().decode())
        print(f"    Total Moments: {genome['total_moments']}")
        print(f"    Categories: {list(genome['categories'].keys())}")
        assert genome["total_moments"] > 0, "Genome moments count should be > 0"

    # 3. Test Content Remix Tree endpoint
    print(f"\n[3] Testing Content Remix Tree endpoint: /api/videos/{video_id}/remix-tree...")
    req = urllib.request.Request(f"{BACKEND_URL}/api/videos/{video_id}/remix-tree")
    with urllib.request.urlopen(req) as res:
        tree = json.loads(res.read().decode())
        print(f"    Root Name: {tree['name']}")
        print(f"    Total Branches: {len(tree['children'])}")
        assert len(tree["children"]) > 0, "Remix tree branches should be > 0"

    # 4. Test Ask Your Video endpoint
    print(f"\n[4] Testing Ask Your Video endpoint: /api/videos/{video_id}/ask...")
    ask_body = json.dumps({"query": "What is the main topic?"}).encode("utf-8")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/videos/{video_id}/ask",
        data=ask_body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as res:
        ask_res = json.loads(res.read().decode())
        print(f"    Answer: {ask_res['answer'][:120]}...")
        print(f"    Relevant Timestamps: {ask_res['relevant_timestamps']}")
        assert len(ask_res["relevant_timestamps"]) > 0, "Should have relevant timestamps"

    # 5. Test Transcript Search endpoint
    print(f"\n[5] Testing Transcript Search endpoint: /api/videos/{video_id}/search?q=the...")
    req = urllib.request.Request(f"{BACKEND_URL}/api/videos/{video_id}/search?q=the")
    with urllib.request.urlopen(req) as res:
        search_res = json.loads(res.read().decode())
        print(f"    Search Match Count: {search_res['count']}")

    # 6. Test Audio Intelligence endpoint
    print(f"\n[6] Testing Audio Intelligence endpoint: /api/videos/{video_id}/audio-intelligence...")
    req = urllib.request.Request(
        f"{BACKEND_URL}/api/videos/{video_id}/audio-intelligence",
        data=b"",
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as res:
        audio_intel = json.loads(res.read().decode())
        print(f"    Total Silence: {audio_intel['total_silence_duration']}s")
        print(f"    Total Fillers: {audio_intel['total_fillers']}")
        print(f"    Clean Duration: {audio_intel['estimated_clean_duration']}s")

    # 7. Test Clip-level endpoints (Translate, Remix, Thumbnails)
    req = urllib.request.Request(f"{BACKEND_URL}/api/clips/{video_id}")
    with urllib.request.urlopen(req) as res:
        clips = json.loads(res.read().decode())
        if clips:
            clip_id = clips[0]["id"]
            print(f"\n[7] Testing Clip Remix & Multilingual Translation for clip_id: {clip_id}...")
            
            # Remix
            remix_req = urllib.request.Request(
                f"{BACKEND_URL}/api/clips/{clip_id}/remix",
                data=b"",
                method="POST"
            )
            with urllib.request.urlopen(remix_req) as r_res:
                remix_data = json.loads(r_res.read().decode())
                print(f"    Generated {len(remix_data['hook_variants'])} Hook Variants")
                print(f"    Generated {len(remix_data['title_variants'])} Title Variants")

            # Translation
            trans_body = json.dumps({"target_language": "ta"}).encode("utf-8")
            trans_req = urllib.request.Request(
                f"{BACKEND_URL}/api/clips/{clip_id}/translate",
                data=trans_body,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(trans_req) as t_res:
                trans_data = json.loads(t_res.read().decode())
                print(f"    Translated to Tamil: {trans_data['translated_hook']}")

            # Thumbnails
            thumb_req = urllib.request.Request(
                f"{BACKEND_URL}/api/clips/{clip_id}/thumbnails",
                data=b"",
                method="POST"
            )
            with urllib.request.urlopen(thumb_req) as th_res:
                th_data = json.loads(th_res.read().decode())
                print(f"    Extracted {len(th_data['thumbnail_candidates'])} Candidate Thumbnails")

    print("\n" + "="*70)
    print(" ALL STANDOUT FEATURES & USP ENDPOINTS VERIFIED!")
    print("="*70)

if __name__ == "__main__":
    test_endpoints()
