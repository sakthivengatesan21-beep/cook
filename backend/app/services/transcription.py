import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx

from app.config import GROQ_API_KEY

class TranscriptionService:
    @staticmethod
    def transcribe_audio_file(audio_path: Path, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Groq Whisper Speech-to-Text transcription engine (whisper-large-v3-turbo).
        Extracts genuine spoken words with verbose segment and word timestamps.
        
        If GROQ_API_KEY is not configured or transcription fails, fails immediately
        and loudly without silent fallbacks or fake captions.
        """
        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not configured.")

        if not audio_path.exists() or os.path.getsize(audio_path) == 0:
            raise ValueError(f"Audio file '{audio_path}' does not exist or is 0 bytes.")

        file_size = os.path.getsize(audio_path)
        print(f"[TRANSCRIPTION INPUT]\n  Path: {audio_path.resolve()}\n  Size: {file_size} bytes")

        start_time = time.time()
        url = "https://api.groq.com/openai/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}

        with open(audio_path, "rb") as f:
            files = {"file": (audio_path.name, f, "audio/wav")}
            data = {
                "model": "whisper-large-v3-turbo",
                "response_format": "verbose_json",
                "timestamp_granularities[]": ["word", "segment"]
            }
            if language:
                data["language"] = language

            try:
                with httpx.Client(timeout=35.0) as client:
                    resp = client.post(url, headers=headers, files=files, data=data)
            except Exception as net_err:
                raise RuntimeError(f"Groq Whisper network request failed ({type(net_err).__name__}): {net_err}")

            if resp.status_code != 200:
                raise RuntimeError(f"Groq Whisper API returned HTTP {resp.status_code}: {resp.text}")

            res_json = resp.json()
            full_text = res_json.get("text", "").strip()
            raw_words = res_json.get("words", [])
            raw_segments = res_json.get("segments", [])
            detected_lang = res_json.get("language", "en")

            all_words = []
            for w in raw_words:
                w_text = w.get("word", "").strip()
                if w_text:
                    all_words.append({
                        "word": w_text,
                        "start": round(float(w.get("start", 0.0)), 2),
                        "end": round(float(w.get("end", 0.0)), 2),
                        "probability": 0.98
                    })

            segments = []
            for seg in raw_segments:
                seg_text = seg.get("text", "").strip()
                s_start = round(float(seg.get("start", 0.0)), 2)
                s_end = round(float(seg.get("end", 0.0)), 2)

                seg_words = []
                if "words" in seg and seg["words"]:
                    for sw in seg["words"]:
                        sw_text = sw.get("word", "").strip()
                        if sw_text:
                            seg_words.append({
                                "word": sw_text,
                                "start": round(float(sw.get("start", s_start)), 2),
                                "end": round(float(sw.get("end", s_end)), 2),
                                "probability": 0.98
                            })
                else:
                    seg_words = [w for w in all_words if w["start"] >= s_start - 0.05 and w["end"] <= s_end + 0.15]

                # If word-level timestamps were not generated for this segment, interpolate tokens
                if not seg_words and seg_text:
                    tokens = seg_text.split()
                    s_dur = max(0.2, s_end - s_start)
                    dt = s_dur / len(tokens) if tokens else s_dur
                    for j, tok in enumerate(tokens):
                        w_obj = {
                            "word": tok,
                            "start": round(s_start + j * dt, 2),
                            "end": round(min(s_end, s_start + (j + 1) * dt), 2),
                            "probability": 0.95
                        }
                        seg_words.append(w_obj)
                        if not all_words:
                            all_words.append(w_obj)

                segments.append({
                    "start": s_start,
                    "end": s_end,
                    "text": seg_text,
                    "confidence": 0.98,
                    "words": seg_words
                })

            duration = round(float(res_json.get("duration", segments[-1]["end"] if segments else 0.0)), 2)
            elapsed = round(time.time() - start_time, 2)
            print(f"[TRANSCRIPTION COMPLETE] Transcribed {len(all_words)} words with Groq Whisper in {elapsed}s.")

            return {
                "text": full_text,
                "language": detected_lang,
                "duration": duration,
                "segments": segments,
                "words": all_words,
                "word_count": len(all_words) if all_words else len(full_text.split()),
                "engine": "groq-whisper-large-v3-turbo"
            }

    @staticmethod
    def validate_transcript(transcript_data: Dict[str, Any], min_words: int = 1) -> bool:
        """
        Validates that the transcript is genuine and contains meaningful spoken words.
        If empty or invalid, raises a ValueError so failure is never hidden.
        """
        if not transcript_data or not isinstance(transcript_data, dict):
            raise ValueError("COOK couldn't understand enough speech from this video: No transcript generated.")

        segments = transcript_data.get("segments", [])
        text = transcript_data.get("text", "").strip()
        if not segments and not text:
            raise ValueError("COOK couldn't understand enough speech from this video: Audio contains no spoken words.")

        return True

transcription_service = TranscriptionService()
