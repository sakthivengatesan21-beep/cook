import os
import re
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.config import FFMPEG_EXE, OUTPUTS_DIR
from app.services.video_engine import run_ffmpeg, get_video_info, format_timestamp_srt

def format_timestamp_ass(seconds: float) -> str:
    """
    Formats seconds into ASS timestamp format: H:MM:SS.cs (centiseconds).
    Example: 0:01:23.45
    """
    total_cs = int(round(seconds * 100))
    cs = total_cs % 100
    total_secs = total_cs // 100
    secs = total_secs % 60
    total_mins = total_secs // 60
    mins = total_mins % 60
    hours = total_mins // 60
    return f"{hours}:{mins:02d}:{secs:02d}.{cs:02d}"

class CaptionService:
    @staticmethod
    def extract_clip_words(
        transcript_segments: List[Dict[str, Any]],
        clip_start: float,
        clip_end: float
    ) -> List[Dict[str, Any]]:
        """
        Extracts words within the clip interval and normalizes timestamps relative to clip_start (0.0s).
        """
        clip_words = []
        clip_duration = clip_end - clip_start

        for seg in transcript_segments:
            seg_start = seg.get("start", 0.0)
            seg_end = seg.get("end", 0.0)

            # Check overlap with clip window
            if seg_end < clip_start or seg_start > clip_end:
                continue

            words = seg.get("words", [])
            if words:
                for w in words:
                    w_start = w.get("start", 0.0)
                    w_end = w.get("end", w_start + 0.3)
                    if w_end >= clip_start and w_start <= clip_end:
                        rel_start = max(0.0, w_start - clip_start)
                        rel_end = min(clip_duration, w_end - clip_start)
                        if rel_end > rel_start:
                            clip_words.append({
                                "word": w.get("word", "").strip(),
                                "start": round(rel_start, 2),
                                "end": round(rel_end, 2),
                                "probability": w.get("probability", 0.95)
                            })
            else:
                # Fallback: interpolate segment text into words
                text = seg.get("text", "").strip()
                tokens = text.split()
                if tokens:
                    s_rel_start = max(0.0, seg_start - clip_start)
                    s_rel_end = min(clip_duration, seg_end - clip_start)
                    dur = max(0.2, s_rel_end - s_rel_start)
                    dt = dur / len(tokens)
                    for i, tok in enumerate(tokens):
                        w_s = s_rel_start + i * dt
                        w_e = s_rel_start + (i + 1) * dt
                        if w_e > 0.0 and w_s < clip_duration:
                            clip_words.append({
                                "word": tok.strip(),
                                "start": round(w_s, 2),
                                "end": round(w_e, 2),
                                "probability": 0.95
                            })

        # Sort words chronologically
        clip_words.sort(key=lambda x: x["start"])
        return clip_words

    @staticmethod
    def chunk_words_into_phrases(
        words: List[Dict[str, Any]],
        max_words_per_phrase: int = 4,
        max_phrase_duration: float = 2.2
    ) -> List[Dict[str, Any]]:
        """
        Chunks words into punchy 2-5 word short-form caption lines optimized for TikTok/Reels/Shorts.
        """
        if not words:
            return []

        phrases = []
        current_words = []
        phrase_idx = 1

        for idx, w in enumerate(words):
            current_words.append(w)
            
            # Check natural break conditions
            word_text = w["word"]
            has_punct = word_text.endswith((".", "!", "?", ",", ";", ":", "—", "-"))
            dur = current_words[-1]["end"] - current_words[0]["start"]
            
            # Time gap to next word
            next_has_gap = False
            if idx + 1 < len(words):
                next_w = words[idx + 1]
                if next_w["start"] - w["end"] > 0.4:
                    next_has_gap = True

            should_break = (
                len(current_words) >= max_words_per_phrase or
                dur >= max_phrase_duration or
                has_punct or
                next_has_gap or
                idx == len(words) - 1
            )

            if should_break and current_words:
                p_start = current_words[0]["start"]
                p_end = current_words[-1]["end"]
                # Ensure minimum visible duration of 0.8s for readability
                if p_end - p_start < 0.8:
                    p_end = p_start + 0.8

                p_text = " ".join([cw["word"] for cw in current_words])
                phrases.append({
                    "index": phrase_idx,
                    "start": round(p_start, 2),
                    "end": round(p_end, 2),
                    "text": p_text,
                    "words": list(current_words)
                })
                phrase_idx += 1
                current_words = []

        return phrases

    @staticmethod
    def generate_ass_file(
        phrases: List[Dict[str, Any]],
        output_ass_path: Path,
        style: str = "ACID",
        position: str = "BOTTOM",
        enable_active_highlight: bool = True
    ) -> Path:
        """
        Generates ASS (Advanced SubStation Alpha) subtitle file with custom typography,
        safe-area margins, and optional active-word highlighting.
        """
        output_ass_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Determine alignment & margins based on position
        # ASS Alignment: 2 = Bottom Center, 5 = Center, 8 = Top Center
        pos_upper = position.upper()
        if pos_upper == "TOP":
            alignment = 8
            margin_v = 180  # Safe from top header/notch
        elif pos_upper == "CENTER":
            alignment = 5
            margin_v = 0
        else: # BOTTOM default
            alignment = 2
            margin_v = 240  # Safe from TikTok/Reels bottom captions & audio title UI

        # Styles configuration
        style_upper = style.upper()
        if style_upper == "BOLD":
            font_name = "Impact"
            font_size = 72
            primary_color = "&H00FFFFFF" # White
            outline_color = "&H00000000" # Black
            outline_size = 5
            shadow_size = 2
            active_color = "&H00FFFFFF"
        elif style_upper == "MINIMAL":
            font_name = "Arial"
            font_size = 56
            primary_color = "&H00FFFFFF"
            outline_color = "&H00000000"
            outline_size = 2
            shadow_size = 2
            active_color = "&H00D2E823"
        elif style_upper == "CLASSIC":
            font_name = "Arial Black"
            font_size = 64
            primary_color = "&H0000E6FF" # Yellow in ASS BGR
            outline_color = "&H00000000"
            outline_size = 4
            shadow_size = 2
            active_color = "&H00FFFFFF"
        else: # ACID Default (Signature COOK Acid Yellow)
            font_name = "Impact"
            font_size = 66
            primary_color = "&H00F8F4E8" # Warm cream white
            outline_color = "&H00000000" # Solid black outline
            outline_size = 4.5
            shadow_size = 2.5
            active_color = "&H0023E8D2"  # #D2E823 (Acid Yellow-Green in ASS BGR)

        ass_header = f"""[Script Info]
Title: COOK Short-Form Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CookCaptionStyle,{font_name},{font_size},{primary_color},&H000000FF,{outline_color},&H80000000,-1,0,0,0,100,100,1.5,0,1,{outline_size},{shadow_size},{alignment},60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

        dialogue_lines = []
        
        for p in phrases:
            p_words = p.get("words", [])
            p_start = p["start"]
            p_end = p["end"]

            # If active-word highlighting is enabled and we have word timestamps
            if enable_active_highlight and style_upper == "ACID" and len(p_words) > 1:
                # Generate granular word highlight events for each word in the phrase
                for w_idx, active_w in enumerate(p_words):
                    w_start = active_w["start"]
                    w_end = active_w["end"]
                    
                    # Bound highlight window
                    if w_idx == len(p_words) - 1:
                        w_end = p_end

                    ass_tokens = []
                    for idx, w in enumerate(p_words):
                        clean_word = w["word"].upper()
                        if idx == w_idx:
                            # Highlight active word in Acid Yellow
                            ass_tokens.append(r"{\c&H23E8D2&}" + clean_word + r"{\c&HFFFFFF&}")
                        else:
                            ass_tokens.append(clean_word)

                    line_text = " ".join(ass_tokens)
                    start_str = format_timestamp_ass(w_start)
                    end_str = format_timestamp_ass(w_end)
                    dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},CookCaptionStyle,,0,0,0,,{line_text}")
            else:
                # Static phrase line
                start_str = format_timestamp_ass(p_start)
                end_str = format_timestamp_ass(p_end)
                clean_text = p["text"].upper()
                dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},CookCaptionStyle,,0,0,0,,{clean_text}")

        full_content = ass_header + "\n".join(dialogue_lines) + "\n"
        with open(output_ass_path, "w", encoding="utf-8") as f:
            f.write(full_content)

        return output_ass_path

    @staticmethod
    def generate_srt_file(
        phrases: List[Dict[str, Any]],
        output_srt_path: Path
    ) -> Path:
        """
        Generates standard SRT subtitle file for the clip phrases.
        """
        output_srt_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_srt_path, "w", encoding="utf-8") as f:
            for idx, p in enumerate(phrases):
                f.write(f"{idx + 1}\n")
                f.write(f"{format_timestamp_srt(p['start'])} --> {format_timestamp_srt(p['end'])}\n")
                f.write(f"{p['text'].upper()}\n\n")
        return output_srt_path

    @staticmethod
    def burn_captions_to_video(
        input_vertical_clip: Path,
        ass_subtitle_path: Path,
        output_captioned_clip: Path,
        timeout: int = 120
    ) -> bool:
        """
        Burns styled ASS subtitles onto 9:16 vertical video with FFmpeg.
        Preserves video stream quality and copies audio stream verbatim.
        """
        output_captioned_clip.parent.mkdir(parents=True, exist_ok=True)
        
        if not input_vertical_clip.exists():
            raise FileNotFoundError(f"Input video clip '{input_vertical_clip}' does not exist.")
        if not ass_subtitle_path.exists():
            raise FileNotFoundError(f"Subtitle file '{ass_subtitle_path}' does not exist.")

        # In FFmpeg -vf ass=path, use relative posix path to avoid Windows drive-letter colon parsing bugs
        try:
            posix_ass = ass_subtitle_path.relative_to(Path.cwd()).as_posix()
        except Exception:
            posix_ass = f"outputs/{ass_subtitle_path.name}"
        
        args = [
            "-i", str(input_vertical_clip),
            "-vf", f"ass={posix_ass}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-pix_fmt", "yuv420p"
        ]
        
        info = get_video_info(input_vertical_clip)
        if info.get("has_audio", False):
            args += ["-c:a", "copy"]
        else:
            args += ["-an"]
            
        args.append(str(output_captioned_clip))
        
        res = run_ffmpeg(args, timeout=timeout)
        if res.returncode != 0 or not output_captioned_clip.exists():
            raise RuntimeError(f"FFmpeg caption burning failed: {res.stderr[-400:] if res.stderr else 'Unknown error'}")

        # Validate final captioned video
        out_info = get_video_info(output_captioned_clip)
        if not out_info["is_valid"] or out_info["file_size"] == 0:
            raise RuntimeError(f"Burned video validation failed: {out_info.get('error')}")

        return True

caption_service = CaptionService()
