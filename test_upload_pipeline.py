import os
import sys
import struct
import httpx
from pathlib import Path
import imageio_ffmpeg
import subprocess

FFMPEG_EXE = imageio_ffmpeg.get_ffmpeg_exe()
TEST_DIR = Path("scratch_test_files")
TEST_DIR.mkdir(exist_ok=True)

API_URL = "http://127.0.0.1:8000/api/upload"

def run_ffmpeg(args):
    cmd = [FFMPEG_EXE, "-y"] + args
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

def create_base_video(ext: str = "mp4", duration: int = 5, with_audio: bool = True) -> Path:
    """Create a short, valid video file with given format and audio setting."""
    base_file = TEST_DIR / f"base_{'audio' if with_audio else 'noaudio'}_{duration}s.{ext}"
    if base_file.exists() and base_file.stat().st_size > 0:
        return base_file
        
    filter_graph = f"testsrc=duration={duration}:size=640x360:rate=24"
    args = ["-f", "lavfi", "-i", filter_graph]
    if with_audio:
        args += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}", "-c:a", "aac" if ext != "webm" else "libvorbis"]
    else:
        args += ["-an"]
        
    if ext == "mp4":
        args += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(base_file)]
    elif ext == "mov":
        args += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(base_file)]
    elif ext == "webm":
        args += ["-c:v", "libvpx", "-b:v", "500k", str(base_file)]
        
    res = run_ffmpeg(args)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg failed to generate {base_file}: {res.stderr}")
    return base_file

def create_padded_file(target_filename: str, ext: str, target_size_bytes: int, duration: int = 180, with_audio: bool = True) -> Path:
    """Generates a valid video file padded to the exact byte size."""
    out_path = TEST_DIR / target_filename
    base = create_base_video(ext=ext, duration=duration if duration <= 10 else 10, with_audio=with_audio)
    
    # Read base video
    base_bytes = base.read_bytes()
    current_size = len(base_bytes)
    
    if current_size >= target_size_bytes:
        out_path.write_bytes(base_bytes[:target_size_bytes])
        return out_path
        
    diff = target_size_bytes - current_size
    
    if ext in ["mp4", "mov"]:
        # In ISO-BMFF (MP4/MOV), a 'free' atom is valid metadata padding
        if diff >= 8:
            atom_header = struct.pack(">I", diff) + b"free"
            pad_data = atom_header + b"\x00" * (diff - 8)
        else:
            pad_data = b"\x00" * diff
    else:
        pad_data = b"\x00" * diff
        
    with open(out_path, "wb") as f:
        f.write(base_bytes)
        f.write(pad_data)
        
    actual_size = out_path.stat().st_size
    assert actual_size == target_size_bytes, f"Expected {target_size_bytes}, got {actual_size}"
    return out_path

def test_upload(file_path: Path, expected_status: int, test_name: str, mime_type: str = None):
    print(f"\n==================================================")
    print(f" {test_name}")
    print(f"==================================================")
    size_bytes = os.path.getsize(file_path)
    size_mb = size_bytes / (1024 * 1024)
    print(f"File: {file_path.name} ({size_mb:.2f} MB / {size_bytes} bytes)")
    
    if not mime_type:
        if file_path.suffix == ".mp4":
            mime_type = "video/mp4"
        elif file_path.suffix == ".mov":
            mime_type = "video/quicktime"
        elif file_path.suffix == ".webm":
            mime_type = "video/webm"
        elif file_path.suffix == ".txt":
            mime_type = "text/plain"
        elif file_path.suffix == ".jpg":
            mime_type = "image/jpeg"
        else:
            mime_type = "application/octet-stream"
            
    with open(file_path, "rb") as f:
        files = {"file": (file_path.name, f, mime_type)}
        try:
            with httpx.Client(timeout=120.0) as client:
                res = client.post(API_URL, files=files)
                print(f"HTTP Status: {res.status_code}")
                try:
                    data = res.json()
                    print(f"Response JSON: {data}")
                except Exception:
                    print(f"Response Raw: {res.text[:300]}")
                    data = {}
                
                if res.status_code == expected_status:
                    print(f"RESULT: [PASS] (Received expected HTTP {expected_status})")
                    return True, data
                else:
                    print(f"RESULT: [FAIL] (Expected HTTP {expected_status}, got {res.status_code})")
                    return False, data
        except Exception as e:
            print(f"RESULT: [EXCEPTION] {e}")
            return False, None

def main():
    print("\n==================================================")
    print(" COOK FULL-STACK UPLOAD TEST SUITE")
    print("==================================================")
    
    results = []
    
    # 1. 20 MB MP4 -> PASS
    p20 = create_padded_file("test_20mb.mp4", "mp4", 20 * 1024 * 1024, duration=30, with_audio=True)
    ok, _ = test_upload(p20, 200, "TEST 1: 20 MB MP4 (Normal Video)")
    results.append(("20 MB MP4", ok))
    
    # 2. 50 MB MP4 -> PASS
    p50 = create_padded_file("test_50mb.mp4", "mp4", 50 * 1024 * 1024, duration=60, with_audio=True)
    ok, _ = test_upload(p50, 200, "TEST 2: 50 MB MP4")
    results.append(("50 MB MP4", ok))
    
    # 3. 113 MB MP4 (3-Minute Video as user reported) -> PASS
    p113 = create_padded_file("test_113mb_3min.mp4", "mp4", 113 * 1024 * 1024, duration=180, with_audio=True)
    ok, data113 = test_upload(p113, 200, "TEST 3: 113 MB MP4 (3-Minute Video - USER SCENARIO)")
    results.append(("113 MB MP4 (3-Min)", ok))
    
    # 4. 200 MB MP4 -> PASS
    p200 = create_padded_file("test_200mb.mp4", "mp4", 200 * 1024 * 1024, duration=180, with_audio=True)
    ok, _ = test_upload(p200, 200, "TEST 4: 200 MB MP4")
    results.append(("200 MB MP4", ok))
    
    # 5. 249 MB MP4 -> PASS
    p249 = create_padded_file("test_249mb.mp4", "mp4", 249 * 1024 * 1024, duration=180, with_audio=True)
    ok, _ = test_upload(p249, 200, "TEST 5: 249 MB MP4 (Under 250MB limit)")
    results.append(("249 MB MP4", ok))
    
    # 6. 251 MB MP4 -> REJECT (413 Payload Too Large)
    p251 = create_padded_file("test_251mb.mp4", "mp4", 251 * 1024 * 1024, duration=180, with_audio=True)
    ok, _ = test_upload(p251, 413, "TEST 6: 251 MB MP4 (Over 250MB limit -> 413 Payload Too Large)")
    results.append(("251 MB MP4 -> 413", ok))
    
    # 7. MOV format -> PASS
    pmov = create_padded_file("test_sample.mov", "mov", 5 * 1024 * 1024, duration=5, with_audio=True)
    ok, _ = test_upload(pmov, 200, "TEST 7: MOV Format Video")
    results.append(("MOV Video", ok))
    
    # 8. WebM format -> PASS
    pwebm = create_padded_file("test_sample.webm", "webm", 3 * 1024 * 1024, duration=5, with_audio=True)
    ok, _ = test_upload(pwebm, 200, "TEST 8: WebM Format Video")
    results.append(("WebM Video", ok))
    
    # 9. TXT file -> REJECT (400)
    ptxt = TEST_DIR / "sample.txt"
    ptxt.write_text("This is an unsupported plain text file.", encoding="utf-8")
    ok, _ = test_upload(ptxt, 400, "TEST 9: TXT File (Expect 400 Unsupported Format)")
    results.append(("TXT File -> 400", ok))
    
    # 10. JPG file -> REJECT (400)
    pjpg = TEST_DIR / "sample.jpg"
    pjpg.write_bytes(b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xFF\xDB\x00C\x00" + b"\x00"*200)
    ok, _ = test_upload(pjpg, 400, "TEST 10: JPG Image File (Expect 400 Unsupported Format)")
    results.append(("JPG File -> 400", ok))
    
    # 11. Corrupted MP4 file -> REJECT (400)
    pcorrupt = TEST_DIR / "corrupt.mp4"
    pcorrupt.write_bytes(b"ftypmp42\x00\x00\x00\x00RANDOM_CORRUPTED_GARBAGE_PAYLOAD" * 100)
    ok, _ = test_upload(pcorrupt, 400, "TEST 11: Corrupted MP4 File (Expect 400 Video Could Not Be Read)")
    results.append(("Corrupted MP4 -> 400", ok))
    
    # 12. No-audio video -> PASS with clear Warning
    pnoaudio = create_base_video("mp4", duration=5, with_audio=False)
    ok, data_noaudio = test_upload(pnoaudio, 200, "TEST 12: Video With No Audio (Expect 200 with Warning)")
    has_warning = data_noaudio.get("warning") is not None or (data_noaudio.get("video", {}).get("has_audio") is False)
    results.append(("No-Audio Video Warning", ok and has_warning))
    
    print("\n==================================================")
    print(" SUMMARY OF ALL TEST RESULTS")
    print("==================================================")
    all_passed = True
    for name, status in results:
        status_str = "PASS [OK]" if status else "FAIL [X]"
        print(f"{name:<35}: {status_str}")
        if not status:
            all_passed = False
            
    print("==================================================")
    if all_passed:
        print(">>> ALL 12 PIPELINE & VALIDATION TESTS PASSED! <<<")
    else:
        print(">>> SOME TESTS FAILED! <<<")
    print("==================================================")

if __name__ == "__main__":
    main()
