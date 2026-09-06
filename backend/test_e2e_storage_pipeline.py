"""
Comprehensive End-to-End Test for COOK Upload, Canonical Storage, and Processing Pipeline.
"""

import sys
import time
import json
import urllib.request
import urllib.parse
from pathlib import Path

BACKEND_URL = "http://127.0.0.1:8000"
TEST_VIDEO_PATH = Path(r"C:\Users\sakth\.gemini\antigravity-ide\scratch\cook\backend\uploads\vid_test_ai_01.mp4")

def run_test():
    print("\n" + "="*70)
    print(" COOK END-TO-END STORAGE & PROCESSING VERIFICATION")
    print("="*70)
    
    if not TEST_VIDEO_PATH.exists():
        print(f"Error: Test video not found at {TEST_VIDEO_PATH}")
        sys.exit(1)

    # 1. Upload video using multipart form-data
    print(f"\n[TEST 1] Uploading test video ({TEST_VIDEO_PATH.stat().st_size} bytes)...")
    
    boundary = "----WebKitFormBoundaryCookTestBoundary7MA4YWxkTrZu0gW"
    with open(TEST_VIDEO_PATH, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{TEST_VIDEO_PATH.name}"\r\n'
        f"Content-Type: video/mp4\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BACKEND_URL}/api/upload",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Authorization": "Bearer cook_token_00000000-0000-0000-0000-000000000001"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as res:
            upload_data = json.loads(res.read().decode())
            print("[TEST 1 SUCCESS] Upload response received:")
            print(json.dumps(upload_data, indent=2))
    except urllib.error.HTTPError as e:
        print(f"[TEST 1 FAILED] Upload HTTP Error: {e.code} - {e.read().decode()}")
        sys.exit(1)

    video_id = upload_data["video_id"]
    storage_path = upload_data["storage_path"]
    bucket = upload_data["storage_bucket"]

    # 2. Test Storage Debug Endpoint
    print(f"\n[TEST 2] Checking Storage Debug Endpoint for {video_id}...")
    debug_req = urllib.request.Request(
        f"{BACKEND_URL}/api/videos/{video_id}/storage-debug",
        headers={"Authorization": "Bearer cook_token_00000000-0000-0000-0000-000000000001"}
    )
    with urllib.request.urlopen(debug_req) as res:
        debug_data = json.loads(res.read().decode())
        print("[TEST 2 SUCCESS] Storage Debug Response:")
        print(json.dumps(debug_data, indent=2))
        assert debug_data["object_exists"] is True, "Storage object does NOT exist in storage!"
        assert debug_data["database_record_exists"] is True, "Database record does NOT exist!"
        assert debug_data["storage_path"] == storage_path, "Storage paths do not match!"

    # 3. Trigger Processing Pipeline
    print(f"\n[TEST 3] Starting Video Processing for {video_id}...")
    proc_req = urllib.request.Request(
        f"{BACKEND_URL}/api/process/{video_id}",
        data=b"",
        headers={"Authorization": "Bearer cook_token_00000000-0000-0000-0000-000000000001"},
        method="POST"
    )
    with urllib.request.urlopen(proc_req) as res:
        proc_data = json.loads(res.read().decode())
        print("[TEST 3 SUCCESS] Processing triggered:")
        print(json.dumps(proc_data, indent=2))

    # 4. Poll status until complete or failed
    print(f"\n[TEST 4] Polling status for {video_id}...")
    max_wait = 180
    start_time = time.time()
    last_stage = ""

    while time.time() - start_time < max_wait:
        status_req = urllib.request.Request(f"{BACKEND_URL}/api/process/{video_id}/status")
        with urllib.request.urlopen(status_req) as res:
            status_data = json.loads(res.read().decode())
            stage = status_data.get("stage", status_data.get("status"))
            progress = status_data.get("progress", 0)
            msg = status_data.get("status_message", "")
            
            if stage != last_stage:
                print(f"  -> Stage: {stage:<20} | Progress: {progress}% | Msg: {msg}")
                last_stage = stage

            if status_data.get("status") == "completed":
                print(f"\n[TEST 4 SUCCESS] Processing COMPLETED in {time.time() - start_time:.2f}s!")
                print(f"Total Clips Generated: {status_data.get('clips_count')}")
                print(f"Transcript Words: {status_data.get('transcript_word_count')}")
                break
            elif status_data.get("status") == "failed":
                print(f"\n[TEST 4 FAILED] Pipeline failed: {status_data.get('error_message')}")
                sys.exit(1)
        
        time.sleep(2)
    else:
        print(f"\n[TEST 4 TIMEOUT] Pipeline did not complete within {max_wait}s.")
        sys.exit(1)

    print("\n" + "="*70)
    print(" ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("="*70)

if __name__ == "__main__":
    run_test()
