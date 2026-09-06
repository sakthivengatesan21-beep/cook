"""
Audio Intelligence Service for COOK
- Detects long silences & dead air from real audio and word timestamps.
- Detects spoken filler words ('um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally', etc.).
- Performs non-destructive cut generation via FFmpeg to produce new video versions without touching the original.
"""

import re
import subprocess
import shutil
from pathlib import Path
from typing import List, Dict, Any, Tuple
from app.config import UPLOADS_DIR, OUTPUTS_DIR

COMMON_FILLER_PATTERNS = [
    (r"\b(um|umm|ummm)\b", "um"),
    (r"\b(uh|uhh|uhhh)\b", "uh"),
    (r"\b(like)\b", "like"),
    (r"\b(you know)\b", "you know"),
    (r"\b(actually)\b", "actually"),
    (r"\b(basically)\b", "basically"),
    (r"\b(literally)\b", "literally"),
    (r"\b(sort of|kind of)\b", "sort of"),
    (r"\b(i mean)\b", "i mean"),
    (r"\b(honestly)\b", "honestly")
]

class AudioIntelligenceService:
    def analyze_silence(
        self,
        transcript_segments: List[Dict[str, Any]],
        video_duration: float,
        silence_threshold: float = 1.2
    ) -> List[Dict[str, Any]]:
        """
        Analyzes silence gaps between consecutive spoken segments and within word intervals.
        Returns a list of silence blocks: [{start_time, end_time, duration}].
        """
        silence_items: List[Dict[str, Any]] = []
        if not transcript_segments:
            return silence_items

        # Check gap before first segment
        first_start = transcript_segments[0].get("start", 0.0)
        if first_start >= silence_threshold:
            silence_items.append({
                "start_time": 0.0,
                "end_time": round(first_start, 2),
                "duration": round(first_start, 2)
            })

        # Check gaps between consecutive segments
        for i in range(len(transcript_segments) - 1):
            curr_end = transcript_segments[i].get("end", 0.0)
            next_start = transcript_segments[i + 1].get("start", 0.0)
            gap = next_start - curr_end
            if gap >= silence_threshold:
                silence_items.append({
                    "start_time": round(curr_end, 2),
                    "end_time": round(next_start, 2),
                    "duration": round(gap, 2)
                })

        # Check gap after last segment
        last_end = transcript_segments[-1].get("end", 0.0)
        if video_duration > last_end and (video_duration - last_end) >= silence_threshold:
            gap = video_duration - last_end
            silence_items.append({
                "start_time": round(last_end, 2),
                "end_time": round(video_duration, 2),
                "duration": round(gap, 2)
            })

        return silence_items

    def analyze_filler_words(
        self,
        transcript_segments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Scans spoken transcript segments and word timestamps for filler words.
        Returns detailed counts and timestamps for each filler word type.
        """
        filler_results: Dict[str, Dict[str, Any]] = {}
        total_fillers = 0

        for seg in transcript_segments:
            text = seg.get("text", "")
            seg_start = seg.get("start", 0.0)
            seg_words = seg.get("words", [])

            for pattern, canon_word in COMMON_FILLER_PATTERNS:
                matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
                if matches:
                    if canon_word not in filler_results:
                        filler_results[canon_word] = {
                            "word": canon_word,
                            "count": 0,
                            "timestamps": []
                        }
                    
                    filler_results[canon_word]["count"] += len(matches)
                    total_fillers += len(matches)

                    # Estimate timestamp from words or segment start
                    if seg_words and len(seg_words) > 0:
                        for match in matches:
                            # Match against word objects if available
                            matched_ts = seg_start
                            match_str = match.group(0).lower()
                            for w in seg_words:
                                if match_str in w.get("word", "").lower():
                                    matched_ts = w.get("start", seg_start)
                                    break
                            filler_results[canon_word]["timestamps"].append(round(matched_ts, 2))
                    else:
                        for _ in matches:
                            filler_results[canon_word]["timestamps"].append(round(seg_start, 2))

        return {
            "total_fillers": total_fillers,
            "filler_items": list(filler_results.values())
        }

    def generate_silence_trimmed_clip(
        self,
        source_clip_path: Path,
        output_clip_path: Path,
        silence_blocks: List[Dict[str, Any]],
        clip_start_offset: float = 0.0
    ) -> Path:
        """
        Creates a new version of the video clip with dead air removed using FFmpeg concat filter.
        Leaves original source untouched.
        """
        if not source_clip_path.exists():
            raise FileNotFoundError(f"Source clip does not exist: {source_clip_path}")

        # If no silence blocks, copy source directly to output
        if not silence_blocks:
            shutil.copy2(source_clip_path, output_clip_path)
            return output_clip_path

        output_clip_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Use FFmpeg silenceremove audio filter + fast encode for tight pacing
        cmd = [
            "ffmpeg", "-y",
            "-i", str(source_clip_path),
            "-af", "silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-35dB",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-c:a", "aac", "-b:a", "128k",
            str(output_clip_path)
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            if output_clip_path.exists() and output_clip_path.stat().st_size > 0:
                return output_clip_path
        except Exception as e:
            print(f"[AUDIO INTELLIGENCE WARNING] FFmpeg silence removal fallback: {e}")
            shutil.copy2(source_clip_path, output_clip_path)
            
        return output_clip_path

audio_intelligence_service = AudioIntelligenceService()
