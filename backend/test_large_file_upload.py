"""
Test large video upload (118 MB) and storage verification.
"""

import sys
import time
import json
import urllib.request
from pathlib import Path

BACKEND_URL = "http://127.0.0.1:8000"
LARGE_VIDEO_PATH = Path(r"C:\Users\sakth\.gemini\antigravity-ide\scratch\cook\backend\uploads\vid_61dae0e2a75e.mp4")

def run_large_upload_test():
    print("\n" + "="*70)
    print(" COOK LARGE FILE (118 MB) UPLOAD & STORAGE VERIFICATION")
    print("="*70)
    
    if not LARGE_VIDEO_PATH.exists():
        print(f"Error: Large video not found at {LARGE_VIDEO_PATH}")
        sys.exit(1)

    file_size = LARGE_VIDEO_PATH.stat().st_size
    print(f"Uploading large file {LARGE_VIDEO_PATH.name} ({file_size / (1024*1024):.2f} MB)...")
    
    boundary = "----WebKitFormBoundaryCookLargeTestBoundaryXYZ"
    with open(LARGE_VIDEO_PATH, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="goggins_118mb_test.mp4"\r\n'
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

    with urllib.request.urlopen(req) as res:
        upload_data = json.loads(res.read().decode())
        print("\n[LARGE UPLOAD SUCCESS]")
        print(json.dumps(upload_data, indent=2))

    video_id = upload_data["video_id"]
    storage_path = upload_data["storage_path"]
    
    # Check debug endpoint
    debug_req = urllib.request.Request(
        f"{BACKEND_URL}/api/videos/{video_id}/storage-debug",
        headers={"Authorization": "Bearer cook_token_00000000-0000-0000-0000-000000000001"}
    )
    with urllib.request.urlopen(debug_req) as res:
        debug_data = json.loads(res.read().decode())
        print("\n[STORAGE DEBUG VERIFIED]")
        print(json.dumps(debug_data, indent=2))
        assert debug_data["object_exists"] is True
        assert debug_data["file_size"] == file_size
        print(f"\n[PASS] 118 MB video successfully verified in storage at '{storage_path}'!")

if __name__ == "__main__":
    run_large_upload_test()
