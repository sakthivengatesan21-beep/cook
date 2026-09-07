import os
import re
import base64
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from app.config import FFMPEG_EXE, OUTPUTS_DIR
from app.models.schemas import VisualFrame
from app.services.video_engine import get_video_info, run_ffmpeg

class VideoProcessor:
    """
    Handles video inspection, adaptive timeline frame extraction, and multimodal preprocessing.
    """

    @staticmethod
    def get_timeline_metadata(video_path: Path) -> Dict[str, Any]:
        """
        Inspects video and extracts precise duration, dimensions, fps, and stream details.
        """
        info = get_video_info(video_path)
        duration = float(info.get("duration", 0.0))
        width = int(info.get("width", 0))
        height = int(info.get("height", 0))
        
        # Calculate aspect ratio
        if width > 0 and height > 0:
            ratio = width / height
            if ratio > 1.3:
                aspect_ratio = "16:9"
            elif ratio < 0.75:
                aspect_ratio = "9:16"
            else:
                aspect_ratio = "1:1"
        else:
            aspect_ratio = "9:16"

        return {
            "duration": duration,
            "width": width,
            "height": height,
            "aspect_ratio": aspect_ratio,
            "has_audio": info.get("has_audio", False),
            "video_codec": info.get("video_codec", "h264"),
            "file_size_mb": round(os.path.getsize(video_path) / (1024 * 1024), 2) if video_path.exists() else 0.0
        }

    @staticmethod
    def compute_adaptive_sample_timestamps(duration: float, target_count: int = 8) -> List[float]:
        """
        Computes adaptive timeline timestamps ensuring beginning, middle, and climax moments are sampled.
        """
        if duration <= 0:
            return [0.0]

        # Short videos (< 15s)
        if duration <= 15.0:
            step = max(1.0, duration / min(target_count, 6))
            timestamps = [round(i * step, 2) for i in range(int(duration // step) + 1)]
            if not timestamps:
                timestamps = [0.0, round(duration / 2, 2)]
            return sorted(list(set([t for t in timestamps if t < duration])))

        # Standard videos (15s to 90s)
        if duration <= 90.0:
            percentages = [0.05, 0.18, 0.32, 0.48, 0.65, 0.80, 0.94]
            timestamps = [round(duration * p, 2) for p in percentages]
            return timestamps

        # Long videos (> 90s)
        count = max(8, min(14, target_count))
        step = duration / (count + 1)
        timestamps = [round(step * (i + 1), 2) for i in range(count)]
        return [round(duration * 0.03, 2)] + timestamps + [round(duration * 0.97, 2)]

    @staticmethod
    def extract_adaptive_frames(
        video_path: Path,
        output_dir: Optional[Path] = None,
        target_count: int = 8,
        max_dimension: int = 768,
        include_base64: bool = True
    ) -> List[VisualFrame]:
        """
        Extracts representative timeline frames from the video using FFmpeg.
        Scales frames for efficient multimodal vision understanding.
        """
        if not video_path.exists():
            raise FileNotFoundError(f"Video file '{video_path}' does not exist.")

        if output_dir is None:
            output_dir = OUTPUTS_DIR / f"frames_{video_path.stem}"
        output_dir.mkdir(parents=True, exist_ok=True)

        meta = VideoProcessor.get_timeline_metadata(video_path)
        duration = meta["duration"]
        timestamps = VideoProcessor.compute_adaptive_sample_timestamps(duration, target_count=target_count)

        frames: List[VisualFrame] = []
        
        for idx, ts in enumerate(timestamps):
            frame_filename = f"frame_{idx:03d}_{int(ts*100):05d}ms.jpg"
            frame_path = output_dir / frame_filename

            # Extract frame with fast FFmpeg seek and bicubic scale
            args = [
                "-ss", f"{ts:.3f}",
                "-i", str(video_path),
                "-vframes", "1",
                "-vf", f"scale='min({max_dimension},iw)':'min({max_dimension},ih)':force_original_aspect_ratio=decrease",
                "-q:v", "3",
                str(frame_path)
            ]

            try:
                res = run_ffmpeg(args, timeout=20)
                if res.returncode == 0 and frame_path.exists() and frame_path.stat().st_size > 500:
                    b64_str = None
                    if include_base64:
                        with open(frame_path, "rb") as img_f:
                            b64_str = base64.b64encode(img_f.read()).decode("utf-8")

                    frames.append(VisualFrame(
                        timestamp=round(ts, 2),
                        frame_path=str(frame_path),
                        frame_index=idx,
                        base64_data=b64_str
                    ))
            except Exception as e:
                print(f"[VIDEO PROCESSOR] Frame extraction at {ts}s warning: {e}")

        # Fallback if no frames were extracted (e.g. corrupt header)
        if not frames:
            fallback_frame = output_dir / "frame_fallback.jpg"
            args_fallback = [
                "-i", str(video_path),
                "-vframes", "1",
                "-q:v", "4",
                str(fallback_frame)
            ]
            try:
                run_ffmpeg(args_fallback, timeout=20)
                if fallback_frame.exists():
                    with open(fallback_frame, "rb") as img_f:
                        b64_str = base64.b64encode(img_f.read()).decode("utf-8")
                    frames.append(VisualFrame(
                        timestamp=0.0,
                        frame_path=str(fallback_frame),
                        frame_index=0,
                        base64_data=b64_str
                    ))
            except Exception:
                pass

        return frames

    @staticmethod
    def cleanup_temp_frames(frames: List[VisualFrame]) -> None:
        """
        Safely deletes extracted temporary frame files after vision analysis.
        """
        for f in frames:
            try:
                p = Path(f.frame_path)
                if p.exists() and "frames_" in str(p.parent):
                    p.unlink(missing_ok=True)
            except Exception:
                pass

video_processor = VideoProcessor()
