import os
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from app.config import FFMPEG_EXE, OUTPUTS_DIR, GEMINI_API_KEY, OPENAI_API_KEY
from app.services.video_engine import extract_audio, get_video_info

# Initialize faster-whisper singleton model lazily to optimize memory
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print("[TRANSCRIPTION] Loading faster-whisper 'base' model on CPU (compute_type=int8)...")
            _whisper_model = WhisperModel("base", device="cpu", compute_type="int8")
            print("[TRANSCRIPTION] faster-whisper model loaded successfully.")
        except Exception as e:
            print(f"[TRANSCRIPTION WARNING] Could not initialize faster-whisper: {e}")
            _whisper_model = None
    return _whisper_model

class TranscriptionService:
    @staticmethod
    def transcribe_audio_file(audio_path: Path, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribes a 16kHz WAV audio file with word-level timestamps.
        Returns a structured dictionary with:
        - text: Full raw transcript string
        - language: Detected or specified language (e.g., 'en', 'ta', 'es', etc.)
        - duration: Total audio duration in seconds
        - segments: List of { start: float, end: float, text: str, confidence: float, words: List[{word, start, end}] }
        - words: Flattened list of all timestamped words
        - word_count: Total meaningful words
        """
        if not audio_path.exists() or os.path.getsize(audio_path) == 0:
            raise ValueError(f"Audio file '{audio_path}' does not exist or is 0 bytes.")

        start_time = time.time()
        model = get_whisper_model()

        if model is not None:
            try:
                print(f"[TRANSCRIPTION] Transcribing audio with word timestamps: {audio_path.name}")
                segments_iter, info = model.transcribe(
                    str(audio_path),
                    beam_size=1, # Fast greedy decoding for high throughput
                    language=language,
                    vad_filter=True,
                    vad_parameters=dict(min_silence_duration_ms=400),
                    word_timestamps=True # Enable word-level timestamps for dynamic short-form captions
                )

                segments = []
                all_words = []
                full_text_parts = []

                for seg in segments_iter:
                    clean_text = seg.text.strip()
                    if clean_text:
                        seg_words = []
                        if hasattr(seg, 'words') and seg.words:
                            for w in seg.words:
                                clean_w = w.word.strip()
                                if clean_w:
                                    w_obj = {
                                        "word": clean_w,
                                        "start": round(w.start, 2),
                                        "end": round(w.end, 2),
                                        "probability": round(w.probability, 2) if hasattr(w, 'probability') else 0.95
                                    }
                                    seg_words.append(w_obj)
                                    all_words.append(w_obj)
                        else:
                            # Fallback interpolation if word timestamps not emitted for a segment
                            raw_tokens = clean_text.split()
                            if raw_tokens:
                                dt = (seg.end - seg.start) / len(raw_tokens)
                                for i, tok in enumerate(raw_tokens):
                                    w_obj = {
                                        "word": tok,
                                        "start": round(seg.start + i * dt, 2),
                                        "end": round(seg.start + (i + 1) * dt, 2),
                                        "probability": 0.95
                                    }
                                    seg_words.append(w_obj)
                                    all_words.append(w_obj)

                        segments.append({
                            "start": round(seg.start, 2),
                            "end": round(seg.end, 2),
                            "text": clean_text,
                            "confidence": round(seg.avg_logprob, 3) if hasattr(seg, 'avg_logprob') else 0.95,
                            "words": seg_words
                        })
                        full_text_parts.append(clean_text)

                full_text = " ".join(full_text_parts).strip()
                detected_lang = info.language if hasattr(info, 'language') else "en"
                duration = round(info.duration if hasattr(info, 'duration') else 0.0, 2)
                elapsed = round(time.time() - start_time, 2)

                print(f"[TRANSCRIPTION COMPLETE] {len(segments)} segments ({len(all_words)} words) extracted in {elapsed}s. Language: {detected_lang}")

                return {
                    "text": full_text,
                    "language": detected_lang,
                    "duration": duration,
                    "segments": segments,
                    "words": all_words,
                    "word_count": len(all_words) if all_words else len(full_text.split()),
                    "engine": "faster-whisper-base-word-timestamps"
                }
            except Exception as e:
                print(f"[TRANSCRIPTION ERROR] Local faster-whisper failed: {e}")
                raise

        # OpenAI Whisper API fallback
        if OPENAI_API_KEY:
            try:
                print("[TRANSCRIPTION] Attempting OpenAI Whisper API transcription fallback...")
                headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
                with open(audio_path, "rb") as f:
                    files = {"file": (audio_path.name, f, "audio/wav")}
                    data = {"model": "whisper-1", "response_format": "verbose_json", "timestamp_granularities[]": ["word", "segment"]}
                    with httpx.Client(timeout=120.0) as client:
                        resp = client.post("https://api.openai.com/v1/audio/transcriptions", headers=headers, files=files, data=data)
                        if resp.status_code == 200:
                            res_json = resp.json()
                            segments = []
                            all_words = []
                            for w in res_json.get("words", []):
                                all_words.append({
                                    "word": w.get("word", "").strip(),
                                    "start": round(w.get("start", 0.0), 2),
                                    "end": round(w.get("end", 0.0), 2),
                                    "probability": 0.95
                                })
                            for seg in res_json.get("segments", []):
                                seg_text = seg.get("text", "").strip()
                                s_start = round(seg.get("start", 0.0), 2)
                                s_end = round(seg.get("end", 0.0), 2)
                                matching_w = [w for w in all_words if w["start"] >= s_start and w["end"] <= (s_end + 0.2)]
                                segments.append({
                                    "start": s_start,
                                    "end": s_end,
                                    "text": seg_text,
                                    "confidence": 0.95,
                                    "words": matching_w
                                })
                            full_text = res_json.get("text", "").strip()
                            return {
                                "text": full_text,
                                "language": res_json.get("language", "en"),
                                "duration": round(res_json.get("duration", 0.0), 2),
                                "segments": segments,
                                "words": all_words,
                                "word_count": len(all_words) if all_words else len(full_text.split()),
                                "engine": "openai-whisper-1"
                            }
            except Exception as e:
                print(f"[TRANSCRIPTION ERROR] OpenAI Whisper API fallback failed: {e}")

        raise RuntimeError("Speech transcription engine unavailable. Please check system Whisper configuration.")

    @staticmethod
    def validate_transcript(transcript_data: Dict[str, Any], min_words: int = 5) -> bool:
        """
        Validates that the transcript is genuine and contains meaningful spoken words.
        Raises ValueError with an explicit user-friendly message if invalid.
        """
        if not transcript_data or not isinstance(transcript_data, dict):
            raise ValueError("COOK couldn't understand enough speech from this video: No transcript generated.")

        text = transcript_data.get("text", "").strip()
        segments = transcript_data.get("segments", [])

        if not text or len(segments) == 0:
            raise ValueError("COOK couldn't understand enough speech from this video: Audio contains no spoken words.")

        meaningful_words = [w for w in re.findall(r"\b\w+\b", text) if len(w) > 1]
        if len(meaningful_words) < min_words:
            raise ValueError(f"COOK couldn't understand enough speech from this video: Found only {len(meaningful_words)} words (minimum required: {min_words}).")

        for i, seg in enumerate(segments):
            start = seg.get("start", 0.0)
            end = seg.get("end", 0.0)
            if start < 0 or end <= start:
                raise ValueError(f"Invalid timestamp alignment in transcript segment #{i+1}: start={start}s, end={end}s.")

        return True

transcription_service = TranscriptionService()
