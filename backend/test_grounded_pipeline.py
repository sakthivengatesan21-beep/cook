import asyncio
import os
import sys
import json
import time
import subprocess
from pathlib import Path

# Ensure UTF-8 output on Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import UPLOADS_DIR, OUTPUTS_DIR, DATA_DIR, FFMPEG_EXE
from app.services.storage import storage
from app.services.video_engine import generate_sample_demo_video, get_video_info, run_ffmpeg
from app.api.routes import run_video_pipeline

def synthesize_speech_wav(text: str, output_wav_path: Path):
    """
    Synthesizes speech on Windows using System.Speech.Synthesis.SpeechSynthesizer.
    """
    output_wav_path.parent.mkdir(parents=True, exist_ok=True)
    ps_script = f"""
    Add-Type -AssemblyName System.Speech
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SetOutputToWaveFile('{str(output_wav_path)}')
    $synth.Speak(@'
{text}
'@)
    $synth.Dispose()
    """
    cmd = ["powershell", "-NoProfile", "-Command", ps_script]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0 or not output_wav_path.exists() or os.path.getsize(output_wav_path) == 0:
        raise RuntimeError(f"Speech synthesis failed: {res.stderr}")

def create_test_video(video_id: str, filename: str, speech_text: str, duration_sec: int = 35) -> Path:
    """
    Creates a valid test MP4 video with synthesized speech audio.
    """
    wav_path = DATA_DIR / f"{video_id}_temp_speech.wav"
    synthesize_speech_wav(speech_text, wav_path)
    
    # Check wav duration
    info = get_video_info(wav_path)
    wav_duration = max(duration_sec, int(info["duration"]) + 2)
    
    output_mp4 = UPLOADS_DIR / f"{video_id}.mp4"
    generate_sample_demo_video(output_mp4, duration_sec=wav_duration, with_audio=True, custom_audio_path=wav_path)
    
    v_info = get_video_info(output_mp4)
    video_record = {
        "id": video_id,
        "filename": filename,
        "storage_url": str(output_mp4),
        "duration": round(v_info["duration"], 2),
        "file_size": os.path.getsize(output_mp4),
        "has_audio": True,
        "audio_codec": v_info.get("audio_codec"),
        "video_codec": v_info.get("video_codec"),
        "width": v_info.get("width"),
        "height": v_info.get("height"),
        "status": "uploaded",
        "stage": "UPLOADED",
        "status_message": "Test video ready for cooking.",
        "progress": 10,
        "created_at": "2026-09-06T00:00:00Z"
    }
    storage.save_video(video_record)
    return output_mp4

def create_silent_video(video_id: str, filename: str, duration_sec: int = 20) -> Path:
    """
    Creates a video with no speech (pure silent audio) to test failure handling.
    """
    output_mp4 = UPLOADS_DIR / f"{video_id}.mp4"
    # Create silent wav
    wav_path = DATA_DIR / f"{video_id}_silent.wav"
    run_ffmpeg([
        "-f", "lavfi",
        "-i", f"anullsrc=r=16000:cl=mono",
        "-t", str(duration_sec),
        "-acodec", "pcm_s16le",
        str(wav_path)
    ], timeout=30)
    
    generate_sample_demo_video(output_mp4, duration_sec=duration_sec, with_audio=True, custom_audio_path=wav_path)
    
    v_info = get_video_info(output_mp4)
    video_record = {
        "id": video_id,
        "filename": filename,
        "storage_url": str(output_mp4),
        "duration": round(v_info["duration"], 2),
        "file_size": os.path.getsize(output_mp4),
        "has_audio": True,
        "audio_codec": v_info.get("audio_codec"),
        "video_codec": v_info.get("video_codec"),
        "width": v_info.get("width"),
        "height": v_info.get("height"),
        "status": "uploaded",
        "stage": "UPLOADED",
        "status_message": "Silent test video ready.",
        "progress": 10,
        "created_at": "2026-09-06T00:00:00Z"
    }
    storage.save_video(video_record)
    return output_mp4

async def main():
    print("================================================================================")
    print("        COOK PIPELINE TEST: 3 DISTINCT TOPIC VIDEOS + 1 SILENT VIDEO")
    print("================================================================================")

    # VIDEO A: AI & Programming
    speech_ai = (
        "Building autonomous AI agents requires specialized tool definitions and memory systems to prevent hallucinations in production. "
        "The first step is restricting the agent context window so it only receives relevant tool schemas. "
        "Step two is implementing robust error handling for API timeouts and token limits. "
        "When we switched to deterministic state machines, our AI agent accuracy jumped from sixty percent to ninety-five percent."
    )
    
    # VIDEO B: Fitness & Nutrition
    speech_fitness = (
        "Progressive overload is the single most important principle for building lean muscle mass naturally. "
        "You must track your lifting volume every single week and increase resistance gradually. "
        "Combine your heavy compound lifts with one gram of protein per pound of body weight each day. "
        "If you do not prioritize eight hours of deep sleep, your muscle protein synthesis drops by half."
    )

    # VIDEO C: Travel & Story
    speech_travel = (
        "Backpacking across Southeast Asia on a shoestring budget taught me how to travel the world for under thirty dollars a day. "
        "In Tokyo and Bangkok, the absolute best street food is found in hidden alleyways far away from tourist traps. "
        "Always book local hostels with high community ratings to meet fellow solo travelers and share travel expenses. "
        "This backpacking journey completely changed my perspective on minimalism and freedom."
    )

    # 1. Generate test fixtures
    print("\n[STEP 1] Generating test fixtures with genuine synthetic speech...")
    vid_ai = create_test_video("vid_test_ai_01", "AI_Agents_Deep_Dive.mp4", speech_ai)
    vid_fit = create_test_video("vid_test_fit_01", "Hypertrophy_And_Protein_Guide.mp4", speech_fitness)
    vid_trav = create_test_video("vid_test_trav_01", "Solo_Backpacking_Tokyo_Bangkok.mp4", speech_travel)
    vid_silent = create_silent_video("vid_test_silent_01", "Silent_Nature_Clip.mp4")
    print("[OK] All 4 test video containers created successfully.")

    # 2. Run Pipeline on Video A (AI)
    print("\n--------------------------------------------------------------------------------")
    print("[TEST 1/4] Processing Video A: AI / Software Engineering...")
    t0 = time.time()
    await run_video_pipeline("vid_test_ai_01")
    t_ai = round(time.time() - t0, 2)
    
    res_ai = storage.get_video("vid_test_ai_01")
    clips_ai = storage.get_clips("vid_test_ai_01")
    transcript_ai = storage.get_transcript("vid_test_ai_01")
    
    assert res_ai["status"] == "completed", f"Video A did not complete: {res_ai}"
    assert res_ai["progress"] == 100, f"Video A progress not 100%: {res_ai['progress']}"
    assert len(clips_ai) > 0, "Video A produced 0 clips"
    assert "agent" in transcript_ai["text"].lower() or "ai" in transcript_ai["text"].lower(), f"Transcript missing AI keywords: {transcript_ai['text']}"
    
    # Grounding check on AI Video
    ai_hooks_text = " ".join([c["hook"] for c in clips_ai]).lower()
    print(f"[PASS] Video A completed in {t_ai}s | Clips: {len(clips_ai)} | Words: {transcript_ai['word_count']}")
    print(f"  Sample AI Hook: \"{clips_ai[0]['hook']}\"")
    print(f"  Sample AI Topic: \"{clips_ai[0]['topic']}\"")
    assert "protein" not in ai_hooks_text and "tokyo" not in ai_hooks_text, "Contamination: AI video contains fitness or travel terms!"
    assert "6 hours editing" not in ai_hooks_text, "Fake fallback hook detected in AI video!"

    # 3. Run Pipeline on Video B (Fitness)
    print("\n--------------------------------------------------------------------------------")
    print("[TEST 2/4] Processing Video B: Fitness / Hypertrophy...")
    t0 = time.time()
    await run_video_pipeline("vid_test_fit_01")
    t_fit = round(time.time() - t0, 2)
    
    res_fit = storage.get_video("vid_test_fit_01")
    clips_fit = storage.get_clips("vid_test_fit_01")
    transcript_fit = storage.get_transcript("vid_test_fit_01")
    
    assert res_fit["status"] == "completed", f"Video B did not complete: {res_fit}"
    assert res_fit["progress"] == 100, f"Video B progress not 100%: {res_fit['progress']}"
    assert len(clips_fit) > 0, "Video B produced 0 clips"
    assert "muscle" in transcript_fit["text"].lower() or "overload" in transcript_fit["text"].lower() or "protein" in transcript_fit["text"].lower()
    
    # Grounding check on Fitness Video
    fit_hooks_text = " ".join([c["hook"] for c in clips_fit]).lower()
    print(f"[PASS] Video B completed in {t_fit}s | Clips: {len(clips_fit)} | Words: {transcript_fit['word_count']}")
    print(f"  Sample Fitness Hook: \"{clips_fit[0]['hook']}\"")
    print(f"  Sample Fitness Topic: \"{clips_fit[0]['topic']}\"")
    assert "agent" not in fit_hooks_text and "tokyo" not in fit_hooks_text, "Contamination: Fitness video contains AI or travel terms!"
    assert "6 hours editing" not in fit_hooks_text, "Fake fallback hook detected in Fitness video!"

    # 4. Run Pipeline on Video C (Travel)
    print("\n--------------------------------------------------------------------------------")
    print("[TEST 3/4] Processing Video C: Travel / Backpacking...")
    t0 = time.time()
    await run_video_pipeline("vid_test_trav_01")
    t_trav = round(time.time() - t0, 2)
    
    res_trav = storage.get_video("vid_test_trav_01")
    clips_trav = storage.get_clips("vid_test_trav_01")
    transcript_trav = storage.get_transcript("vid_test_trav_01")
    
    assert res_trav["status"] == "completed", f"Video C did not complete: {res_trav}"
    assert res_trav["progress"] == 100, f"Video C progress not 100%: {res_trav['progress']}"
    assert len(clips_trav) > 0, "Video C produced 0 clips"
    assert "backpacking" in transcript_trav["text"].lower() or "tokyo" in transcript_trav["text"].lower() or "travel" in transcript_trav["text"].lower()
    
    # Grounding check on Travel Video
    trav_hooks_text = " ".join([c["hook"] for c in clips_trav]).lower()
    print(f"[PASS] Video C completed in {t_trav}s | Clips: {len(clips_trav)} | Words: {transcript_trav['word_count']}")
    print(f"  Sample Travel Hook: \"{clips_trav[0]['hook']}\"")
    print(f"  Sample Travel Topic: \"{clips_trav[0]['topic']}\"")
    assert "agent" not in trav_hooks_text and "protein" not in trav_hooks_text, "Contamination: Travel video contains AI or fitness terms!"
    assert "6 hours editing" not in trav_hooks_text, "Fake fallback hook detected in Travel video!"

    # 5. Run Pipeline on Video D (Silent / Empty Speech)
    print("\n--------------------------------------------------------------------------------")
    print("[TEST 4/4] Processing Video D: Silent Audio Video (Strict Validation & Failure Test)...")
    t0 = time.time()
    await run_video_pipeline("vid_test_silent_01")
    t_silent = round(time.time() - t0, 2)
    
    res_silent = storage.get_video("vid_test_silent_01")
    clips_silent = storage.get_clips("vid_test_silent_01")
    
    assert res_silent["status"] == "failed", f"Silent video should fail, but got: {res_silent['status']}"
    assert len(clips_silent) == 0, f"Silent video should generate 0 clips, but got: {len(clips_silent)}"
    print(f"[PASS] Video D correctly failed in {t_silent}s | Status: {res_silent['status']} | Error: \"{res_silent.get('error_message')}\"")
    print("  NO fake fallback hooks were generated for silent video!")

    print("\n================================================================================")
    print("                      ALL 4 PIPELINE TESTS PASSED 100%!")
    print("================================================================================")
    print("SUMMARY:")
    print(f"  - AI Video: {t_ai}s -> Status: {res_ai['status']} (100%), {len(clips_ai)} clips, Grounded in AI speech.")
    print(f"  - Fitness Video: {t_fit}s -> Status: {res_fit['status']} (100%), {len(clips_fit)} clips, Grounded in Fitness speech.")
    print(f"  - Travel Video: {t_trav}s -> Status: {res_trav['status']} (100%), {len(clips_trav)} clips, Grounded in Travel speech.")
    print(f"  - Silent Video: {t_silent}s -> Status: {res_silent['status']} (FAILED with clear error).")
    print("  - Zero cross-contamination.")
    print("  - Zero generic hardcoded fallback hooks.")
    print("  - Zero 55% stalls.")
    print("================================================================================")

if __name__ == "__main__":
    asyncio.run(main())
