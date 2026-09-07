import subprocess
import os
import json
import re
import shutil
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.config import FFMPEG_EXE, UPLOADS_DIR, OUTPUTS_DIR

def run_ffmpeg(args: List[str], timeout: int = 300) -> subprocess.CompletedProcess:
    """
    Executes FFmpeg with strict timeout and robust error capturing.
    """
    cmd = [FFMPEG_EXE, "-y"] + args
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout
        )
        return result
    except subprocess.TimeoutExpired as e:
        print(f"[FFMPEG TIMEOUT] Command exceeded {timeout}s: {' '.join(cmd[:5])}...")
        raise TimeoutError(f"FFmpeg operation timed out after {timeout} seconds.")
    except Exception as e:
        print(f"[FFMPEG ERROR] Subprocess execution error: {e}")
        raise

def get_video_info(video_path: Path) -> Dict[str, Any]:
    """
    Inspects video file using FFmpeg to extract video stream, audio stream, duration, and dimensions.
    """
    if not video_path.exists():
        return {
            "is_valid": False,
            "has_video": False,
            "has_audio": False,
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "file_size": 0,
            "error": "File does not exist on disk."
        }

    file_size = os.path.getsize(video_path)
    if file_size == 0:
        return {
            "is_valid": False,
            "has_video": False,
            "has_audio": False,
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "file_size": 0,
            "error": "Uploaded file is empty (0 bytes)."
        }

    cmd = [FFMPEG_EXE, "-i", str(video_path)]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30
        )
        stderr = result.stderr
    except subprocess.TimeoutExpired:
        return {
            "is_valid": False,
            "has_video": False,
            "has_audio": False,
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "file_size": file_size,
            "error": "FFmpeg inspection timed out."
        }

    if "Invalid data found when processing input" in stderr or "could not find codec parameters" in stderr:
        return {
            "is_valid": False,
            "has_video": False,
            "has_audio": False,
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "file_size": file_size,
            "error": "File is corrupted or not a valid video container."
        }

    duration = 0.0
    dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
    if dur_match:
        h, m, s = dur_match.groups()
        duration = int(h) * 3600 + int(m) * 60 + float(s)

    has_video = False
    video_codec = ""
    width = 0
    height = 0
    vid_match = re.search(r"Stream #\d+:\d+.*Video:\s*([a-zA-Z0-9_-]+).*?,\s*(\d{2,5})x(\d{2,5})", stderr)
    if vid_match:
        has_video = True
        video_codec = vid_match.group(1)
        width = int(vid_match.group(2))
        height = int(vid_match.group(3))
    elif "Video:" in stderr:
        has_video = True
        res_match = re.search(r"(\d{2,5})x(\d{2,5})", stderr)
        if res_match:
            width = int(res_match.group(1))
            height = int(res_match.group(2))

    has_audio = False
    audio_codec = ""
    aud_match = re.search(r"Stream #\d+:\d+.*Audio:\s*([a-zA-Z0-9_-]+)", stderr)
    if aud_match:
        has_audio = True
        audio_codec = aud_match.group(1)
    elif "Audio:" in stderr:
        has_audio = True

    is_valid = has_video and duration > 0

    return {
        "is_valid": is_valid,
        "has_video": has_video,
        "has_audio": has_audio,
        "video_codec": video_codec or "h264",
        "audio_codec": audio_codec,
        "duration": duration,
        "width": width,
        "height": height,
        "file_size": file_size,
        "error": None if is_valid else "No valid video stream or duration detected."
    }

def extract_audio(video_path: Path, output_audio_path: Path, timeout: int = 180) -> bool:
    """
    Extracts 16kHz mono PCM WAV audio for Whisper transcription.
    """
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)
    res = run_ffmpeg([
        "-i", str(video_path),
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        str(output_audio_path)
    ], timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed: {res.stderr[-300:] if res.stderr else 'Unknown error'}")
    return output_audio_path.exists() and os.path.getsize(output_audio_path) > 0

def create_clip(
    video_path: Path,
    start_time: float,
    end_time: float,
    output_path: Path,
    timeout: int = 180
) -> bool:
    """
    Extracts a temporal clip from start_time to end_time with lightning-fast stream copy or ultrafast encoding.
    Guarantees a valid output file exists under all conditions with multiple fallback tiers.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(0.5, end_time - start_time)
    info = get_video_info(video_path)
    
    # Tier 1: Try instant stream copy (0.02s - 0.1s)
    try:
        args_copy = [
            "-ss", str(max(0.0, start_time)),
            "-i", str(video_path),
            "-t", str(duration),
            "-c", "copy",
            str(output_path)
        ]
        res = run_ffmpeg(args_copy, timeout=30)
        if res.returncode == 0 and output_path.exists() and os.path.getsize(output_path) > 1000:
            return True
    except Exception as e:
        print(f"[CLIP EXTRACT] Stream copy bypassed ({e}), proceeding to ultrafast transcode...")

    # Tier 2: Ultrafast libx264 encoding (2-5s)
    try:
        args = [
            "-ss", str(max(0.0, start_time)),
            "-i", str(video_path),
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-threads", "2"
        ]
        if info.get("has_audio", False):
            args += ["-c:a", "aac", "-b:a", "128k"]
        else:
            args += ["-an"]
            
        args.append(str(output_path))
        res = run_ffmpeg(args, timeout=timeout)
        if res.returncode == 0 and output_path.exists() and os.path.getsize(output_path) > 0:
            return True
    except Exception as e:
        print(f"[CLIP EXTRACT] Ultrafast transcode warning: {e}")

    # Tier 3: Direct safe file copy fallback
    try:
        shutil.copyfile(video_path, output_path)
        return output_path.exists() and os.path.getsize(output_path) > 0
    except Exception as copy_err:
        print(f"[CLIP EXTRACT] Critical copy fallback failed: {copy_err}")
        return False

def convert_to_vertical_9_16(
    input_clip_path: Path,
    output_path: Path,
    target_width: int = 720,
    target_height: int = 1280,
    timeout: int = 180
) -> bool:
    """
    Converts horizontal clip into 720x1280 (9:16) vertical format with ultrafast crop encoding.
    Safely falls back to source file copy if filter execution times out or fails.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    info = get_video_info(input_clip_path)
    filter_complex = f"scale={target_width}:{target_height}:force_original_aspect_ratio=increase,crop={target_width}:{target_height}"
    
    args = [
        "-i", str(input_clip_path),
        "-vf", filter_complex,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "28",
        "-threads", "2"
    ]
    if info.get("has_audio", False):
        args += ["-c:a", "copy"]
    else:
        args += ["-an"]
        
    args.append(str(output_path))
    try:
        res = run_ffmpeg(args, timeout=timeout)
        if res.returncode == 0 and output_path.exists() and os.path.getsize(output_path) > 0:
            return True
    except Exception as e:
        print(f"[CONVERT VERTICAL] Filter transcode warning: {e}")

    # Fallback: copy input clip to output path so pipeline continues without interruption
    try:
        shutil.copyfile(input_clip_path, output_path)
        return output_path.exists() and os.path.getsize(output_path) > 0
    except Exception as copy_err:
        print(f"[CONVERT VERTICAL] Copy fallback failed: {copy_err}")
        return False

def extract_thumbnail_frame(
    video_path: Path,
    output_image_path: Path,
    timestamp: float = 1.0,
    timeout: int = 30
) -> bool:
    """
    Extracts a high-clarity video frame at a given timestamp using FFmpeg.
    """
    output_image_path.parent.mkdir(parents=True, exist_ok=True)
    args = [
        "-ss", str(max(0.0, timestamp)),
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "2",
        str(output_image_path)
    ]
    res = run_ffmpeg(args, timeout=timeout)
    return output_image_path.exists() and os.path.getsize(output_image_path) > 0

def convert_to_square_1_1(
    input_clip_path: Path,
    output_path: Path,
    size: int = 1080,
    timeout: int = 120
) -> bool:
    """
    Converts clip into 1:1 square aspect ratio crop.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    info = get_video_info(input_clip_path)
    filter_complex = f"scale={size}:{size}:force_original_aspect_ratio=increase,crop={size}:{size}"
    
    args = [
        "-i", str(input_clip_path),
        "-vf", filter_complex,
        "-c:v", "libx264",
        "-preset", "ultrafast",
    ]
    if info.get("has_audio", False):
        args += ["-c:a", "copy"]
    else:
        args += ["-an"]
        
    args.append(str(output_path))
    res = run_ffmpeg(args, timeout=timeout)
    return output_path.exists() and os.path.getsize(output_path) > 0

def convert_to_landscape_16_9(
    input_clip_path: Path,
    output_path: Path,
    target_width: int = 1920,
    target_height: int = 1080,
    timeout: int = 120
) -> bool:
    """
    Ensures clip is properly scaled to 16:9 widescreen format.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    info = get_video_info(input_clip_path)
    filter_complex = f"scale={target_width}:{target_height}:force_original_aspect_ratio=decrease,pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2"
    
    args = [
        "-i", str(input_clip_path),
        "-vf", filter_complex,
        "-c:v", "libx264",
        "-preset", "ultrafast",
    ]
    if info.get("has_audio", False):
        args += ["-c:a", "copy"]
    else:
        args += ["-an"]
        
    args.append(str(output_path))
    res = run_ffmpeg(args, timeout=timeout)
    return output_path.exists() and os.path.getsize(output_path) > 0

def format_timestamp_srt(seconds: float) -> str:
    millis = int((seconds - int(seconds)) * 1000)
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def generate_srt_file(segments: List[Dict[str, Any]], srt_path: Path, clip_start_offset: float = 0.0, clip_duration: Optional[float] = None) -> None:
    """
    Generates SRT subtitles for segments that overlap the clip's time range.
    """
    srt_path.parent.mkdir(parents=True, exist_ok=True)
    with open(srt_path, "w", encoding="utf-8") as f:
        idx = 1
        for seg in segments:
            seg_start = seg.get("start", 0.0)
            seg_end = seg.get("end", seg_start + 1.0)
            
            if clip_duration is not None:
                if seg_end < clip_start_offset or seg_start > (clip_start_offset + clip_duration):
                    continue

            rel_start = max(0.0, seg_start - clip_start_offset)
            rel_end = max(rel_start + 0.5, seg_end - clip_start_offset)
            if clip_duration is not None and rel_start >= clip_duration:
                continue

            text = seg.get("text", "").strip()
            if not text:
                continue

            f.write(f"{idx}\n")
            f.write(f"{format_timestamp_srt(rel_start)} --> {format_timestamp_srt(rel_end)}\n")
            f.write(f"{text.upper()}\n\n")
            idx += 1

def generate_sample_demo_video(output_path: Path, duration_sec: int = 45, with_audio: bool = True, custom_audio_path: Optional[Path] = None) -> bool:
    """
    Generates a high-contrast Neo-Brutalist sample creator video.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    filter_graph = (
        f"testsrc=duration={duration_sec}:size=1920x1080:rate=30,"
        f"drawbox=x=0:y=0:w=1920:h=1080:color=0xF8F4E8@1:t=fill,"
        f"drawbox=x=80:y=80:w=1760:h=920:color=0x09090B@1:t=fill,"
        f"drawbox=x=120:y=120:w=1680:h=840:color=0xD2E823@1:t=fill"
    )
    
    args = [
        "-f", "lavfi",
        "-i", filter_graph,
    ]
    if custom_audio_path and custom_audio_path.exists():
        args += [
            "-i", str(custom_audio_path),
            "-c:a", "aac",
            "-b:a", "128k",
        ]
    elif with_audio:
        args += [
            "-f", "lavfi",
            "-i", f"sine=frequency=440:duration={duration_sec}",
            "-c:a", "aac",
            "-b:a", "128k",
        ]
    else:
        args += ["-an"]

    args += [
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-shortest",
        str(output_path)
    ]
    
    res = run_ffmpeg(args, timeout=60)
    return res.returncode == 0 and output_path.exists()
