import os
import re
import shutil
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
    total_cs = max(0, int(round(seconds * 100)))
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
        Extracts words strictly within the clip interval and normalizes timestamps relative to clip_start (0.0s).
        Filters out trailing partial words from previous sentences that started before clip_start.
        """
        clip_words = []
        clip_duration = max(0.5, clip_end - clip_start)

        for seg in transcript_segments:
            seg_start = float(seg.get("start", 0.0))
            seg_end = float(seg.get("end", 0.0))

            # Skip segments with no overlap
            if seg_end < clip_start - 0.1 or seg_start > clip_end + 0.1:
                continue

            words = seg.get("words", [])
            if words:
                for w in words:
                    w_text = str(w.get("word", "")).strip()
                    if not w_text:
                        continue
                        
                    w_start = float(w.get("start", 0.0))
                    w_end = float(w.get("end", w_start + 0.25))
                    w_mid = (w_start + w_end) / 2.0

                    # Word boundary filter:
                    # Exclude words that clearly belong to the previous sentence (started >0.08s before clip_start)
                    if w_start < clip_start - 0.08 and w_end < clip_start + 0.15:
                        continue
                    if w_start > clip_end + 0.15:
                        continue

                    # Check if word falls in clip window
                    if (w_end >= clip_start and w_start <= clip_end) or (clip_start <= w_mid <= clip_end):
                        rel_start = max(0.0, round(w_start - clip_start, 2))
                        rel_end = min(clip_duration, max(rel_start + 0.08, round(w_end - clip_start, 2)))
                        if rel_end > rel_start:
                            clip_words.append({
                                "word": w_text,
                                "start": rel_start,
                                "end": rel_end,
                                "probability": float(w.get("probability", 0.95))
                            })
            else:
                # Segment-level fallback: interpolate text into words with accurate relative timing
                text = str(seg.get("text", "")).strip()
                tokens = text.split()
                if tokens:
                    s_rel_start = max(0.0, seg_start - clip_start)
                    s_rel_end = min(clip_duration, seg_end - clip_start)
                    dur = max(0.3, s_rel_end - s_rel_start)
                    dt = dur / len(tokens)
                    for i, tok in enumerate(tokens):
                        w_s = max(0.0, round(s_rel_start + i * dt, 2))
                        w_e = min(clip_duration, round(s_rel_start + (i + 1) * dt, 2))
                        if w_e > w_s and w_s < clip_duration:
                            clip_words.append({
                                "word": tok.strip(),
                                "start": w_s,
                                "end": w_e,
                                "probability": 0.95
                            })

        # Sort words chronologically
        clip_words.sort(key=lambda x: (x["start"], x["end"]))
        
        # Eliminate any micro-negative durations or duplicate starts
        sanitized = []
        for w in clip_words:
            if not w["word"]:
                continue
            if sanitized and w["start"] < sanitized[-1]["start"]:
                w["start"] = sanitized[-1]["start"]
            if w["end"] <= w["start"]:
                w["end"] = round(w["start"] + 0.15, 2)
            sanitized.append(w)

        return sanitized

    @staticmethod
    def chunk_words_into_phrases(
        words: List[Dict[str, Any]],
        max_words_per_phrase: int = 4,
        max_phrase_duration: float = 2.0
    ) -> List[Dict[str, Any]]:
        """
        Chunks words into punchy 2-5 word short-form caption lines optimized for TikTok/Reels/Shorts.
        Enforces strictly monotonic, non-overlapping time intervals.
        """
        if not words:
            return []

        raw_phrases = []
        current_words = []

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
                if next_w["start"] - w["end"] >= 0.35:
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
                # Minimum duration of 0.6s for readability
                if p_end - p_start < 0.6:
                    p_end = round(p_start + 0.6, 2)

                p_text = " ".join([cw["word"] for cw in current_words])
                raw_phrases.append({
                    "start": p_start,
                    "end": p_end,
                    "text": p_text,
                    "words": list(current_words)
                })
                current_words = []

        if not raw_phrases:
            return []

        # Enforce strict non-overlapping intervals and smooth transitions
        final_phrases = []
        for i, p in enumerate(raw_phrases):
            p_start = p["start"]
            p_end = p["end"]

            if i + 1 < len(raw_phrases):
                next_start = raw_phrases[i + 1]["start"]
                # If current phrase ends after next phrase begins, clip it
                if p_end > next_start:
                    p_end = max(round(p_start + 0.3, 2), next_start)
                # If tiny gap (<0.2s), bridge it so subtitles don't flash off and on
                elif next_start - p_end < 0.2:
                    p_end = next_start

            # Make sure start < end
            if p_end <= p_start:
                p_end = round(p_start + 0.4, 2)

            # Adjust word timestamps within phrase boundaries
            adjusted_words = []
            for w in p["words"]:
                w_s = max(p_start, min(p_end - 0.05, w["start"]))
                w_e = min(p_end, max(w_s + 0.05, w["end"]))
                adjusted_words.append({
                    "word": w["word"],
                    "start": round(w_s, 2),
                    "end": round(w_e, 2),
                    "probability": w.get("probability", 0.95)
                })

            final_phrases.append({
                "index": i + 1,
                "start": round(p_start, 2),
                "end": round(p_end, 2),
                "text": p["text"],
                "words": adjusted_words
            })

        return final_phrases

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
        safe-area margins, and continuous flicker-free active-word karaoke highlighting.
        """
        output_ass_path.parent.mkdir(parents=True, exist_ok=True)
        
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

        # Styles configuration (colors in ASS format: &HAABBGGRR)
        style_upper = style.upper()
        if style_upper == "BOLD":
            font_name = "Impact"
            font_size = 72
            primary_color = "&H00FFFFFF" # White
            outline_color = "&H00000000" # Black
            outline_size = 5.0
            shadow_size = 2.0
            active_color = "&H00FFFFFF"
            highlight_color_tag = r"{\c&HFFFFFF&}"
            base_color_tag = r"{\c&HFFFFFF&}"
        elif style_upper == "MINIMAL":
            font_name = "Arial"
            font_size = 56
            primary_color = "&H00FFFFFF"
            outline_color = "&H00000000"
            outline_size = 2.5
            shadow_size = 1.5
            active_color = "&H0023E8D2"  # Acid Yellow-Green
            highlight_color_tag = r"{\c&H23E8D2&}"
            base_color_tag = r"{\c&HFFFFFF&}"
        elif style_upper == "CLASSIC":
            font_name = "Arial Black"
            font_size = 64
            primary_color = "&H0000E6FF" # Yellow in ASS BGR
            outline_color = "&H00000000"
            outline_size = 4.0
            shadow_size = 2.0
            active_color = "&H00FFFFFF"
            highlight_color_tag = r"{\c&H00E6FF&}"
            base_color_tag = r"{\c&H00E6FF&}"
        else: # ACID Default (Signature COOK Acid Yellow)
            font_name = "Impact"
            font_size = 66
            primary_color = "&H00F8F4E8" # Warm cream white (&H00E8F4F8 in BGR)
            outline_color = "&H00000000" # Solid black outline
            outline_size = 4.5
            shadow_size = 2.5
            active_color = "&H0023E8D2"  # #D2E823 (Acid Yellow-Green in ASS BGR)
            highlight_color_tag = r"{\c&H23E8D2&}"
            base_color_tag = r"{\c&HE8F4F8&}"

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

            # If active-word karaoke is enabled and we have multiple words with timestamps
            if enable_active_highlight and style_upper in ["ACID", "MINIMAL"] and len(p_words) > 1:
                # Create continuous contiguous slices across [p_start, p_end] so phrase NEVER flickers
                for w_idx, active_w in enumerate(p_words):
                    # Slice start: first word starts at p_start, otherwise at active_w start
                    slice_start = p_start if w_idx == 0 else active_w["start"]
                    
                    # Slice end: last word ends at p_end, otherwise at next word's start
                    if w_idx == len(p_words) - 1:
                        slice_end = p_end
                    else:
                        slice_end = max(slice_start + 0.1, p_words[w_idx + 1]["start"])

                    # Ensure slice duration is valid
                    if slice_end <= slice_start:
                        slice_end = slice_start + 0.15

                    ass_tokens = []
                    for idx, w in enumerate(p_words):
                        clean_word = w["word"].upper()
                        if idx == w_idx:
                            # Active word in highlight color, then restore base color
                            ass_tokens.append(f"{highlight_color_tag}{clean_word}{base_color_tag}")
                        else:
                            ass_tokens.append(clean_word)

                    line_text = " ".join(ass_tokens)
                    start_str = format_timestamp_ass(slice_start)
                    end_str = format_timestamp_ass(slice_end)
                    dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},CookCaptionStyle,,0,0,0,,{line_text}")
            else:
                # Single continuous phrase display
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
        timeout: int = 180
    ) -> bool:
        """
        Burns styled ASS subtitles onto 9:16 vertical video with FFmpeg.
        Preserves video stream quality and copies audio stream verbatim.
        Properly escapes Windows paths for FFmpeg filtergraphs.
        """
        output_captioned_clip.parent.mkdir(parents=True, exist_ok=True)
        
        if not input_vertical_clip.exists():
            raise FileNotFoundError(f"Input video clip '{input_vertical_clip}' does not exist.")
        if not ass_subtitle_path.exists():
            shutil.copyfile(input_vertical_clip, output_captioned_clip)
            return True

        # Format subtitle path safely for FFmpeg filtergraph (escape colon on Windows)
        # e.g., C\:/path/to/file.ass
        abs_ass = str(ass_subtitle_path.resolve()).replace("\\", "/")
        escaped_ass = abs_ass.replace(":", "\\:")
        
        # Try relative path first if feasible
        try:
            rel_ass = ass_subtitle_path.relative_to(Path.cwd()).as_posix().replace(":", "\\:")
            filter_ass_path = rel_ass
        except Exception:
            filter_ass_path = escaped_ass
        
        args = [
            "-i", str(input_vertical_clip),
            "-vf", f"ass='{filter_ass_path}'",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-threads", "2"
        ]
        
        info = get_video_info(input_vertical_clip)
        if info.get("has_audio", False):
            args += ["-c:a", "copy"]
        else:
            args += ["-an"]
            
        args.append(str(output_captioned_clip))
        
        try:
            res = run_ffmpeg(args, timeout=timeout)
            if res.returncode == 0 and output_captioned_clip.exists() and output_captioned_clip.stat().st_size > 1000:
                return True
        except Exception as e:
            print(f"[BURN CAPTIONS] FFmpeg ass burning attempt 1 failed ({e}), trying subtitles filter...")

        # Fallback: try subtitles filter with absolute escaped path
        try:
            args_sub = [
                "-i", str(input_vertical_clip),
                "-vf", f"subtitles='{escaped_ass}'",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-crf", "22",
                "-pix_fmt", "yuv420p",
                "-threads", "2"
            ]
            if info.get("has_audio", False):
                args_sub += ["-c:a", "copy"]
            else:
                args_sub += ["-an"]
            args_sub.append(str(output_captioned_clip))
            
            res2 = run_ffmpeg(args_sub, timeout=timeout)
            if res2.returncode == 0 and output_captioned_clip.exists() and output_captioned_clip.stat().st_size > 1000:
                return True
        except Exception as e2:
            print(f"[BURN CAPTIONS] Subtitles filter fallback failed: {e2}")

        # Final safe fallback: copy uncaptioned vertical clip so user always has a playable video
        try:
            shutil.copyfile(input_vertical_clip, output_captioned_clip)
            return output_captioned_clip.exists() and output_captioned_clip.stat().st_size > 0
        except Exception as copy_err:
            print(f"[BURN CAPTIONS] Critical copy fallback failed: {copy_err}")
            return False

caption_service = CaptionService()
