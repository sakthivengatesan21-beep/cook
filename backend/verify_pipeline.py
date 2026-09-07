import os
import sys
from pathlib import Path
from app.services.captions import caption_service
from app.services.video_engine import create_clip, get_video_info
from app.ai.clip_detector import _generate_10_smart_hooks, _generate_platform_remixes

print("--- TEST 1: Word & Phrase Extraction ---")
mock_segments = [
    {
        "start": 0.0, "end": 4.2,
        "text": "Your brain is the most powerful weapon in the world.",
        "words": [
            {"word": "Your", "start": 0.0, "end": 0.3},
            {"word": "brain", "start": 0.3, "end": 0.8},
            {"word": "is", "start": 0.8, "end": 1.0},
            {"word": "the", "start": 1.0, "end": 1.2},
            {"word": "most", "start": 1.2, "end": 1.5},
            {"word": "powerful", "start": 1.5, "end": 2.1},
            {"word": "weapon", "start": 2.1, "end": 2.6},
            {"word": "in", "start": 2.6, "end": 2.8},
            {"word": "the", "start": 2.8, "end": 3.0},
            {"word": "world.", "start": 3.0, "end": 3.8}
        ]
    },
    {
        "start": 4.5, "end": 8.0,
        "text": "Once you put away your phones and focus.",
        "words": [
            {"word": "Once", "start": 4.5, "end": 4.8},
            {"word": "you", "start": 4.8, "end": 5.0},
            {"word": "put", "start": 5.0, "end": 5.3},
            {"word": "away", "start": 5.3, "end": 5.7},
            {"word": "your", "start": 5.7, "end": 6.0},
            {"word": "phones", "start": 6.0, "end": 6.5},
            {"word": "and", "start": 6.5, "end": 6.8},
            {"word": "focus.", "start": 6.8, "end": 7.5}
        ]
    }
]

words = caption_service.extract_clip_words(mock_segments, 0.0, 8.0)
print(f"Extracted {len(words)} words")
phrases = caption_service.chunk_words_into_phrases(words)
print(f"Generated {len(phrases)} phrases:")
for p in phrases:
    print(f"  [{p['start']}s -> {p['end']}s]: \"{p['text']}\" ({len(p['words'])} words)")

# Verify non-overlapping
for i in range(len(phrases) - 1):
    assert phrases[i]["end"] <= phrases[i+1]["start"] + 0.01, f"Overlap between phrase {i} and {i+1}!"
print("[PASS] Verified non-overlapping phrase timings.")

print("\n--- TEST 2: ASS File Generation ---")
ass_path = Path("outputs/verify_test.ass")
caption_service.generate_ass_file(phrases, ass_path, style="ACID", enable_active_highlight=True)
assert ass_path.exists() and ass_path.stat().st_size > 0
print("[PASS] Verified ASS file generated successfully.")

print("\n--- TEST 3: Smart Hooks & Platform Copy ---")
sample_t = "Your brain is the most powerful weapon in the world. Once you put away your phones and focus."
hooks = _generate_10_smart_hooks(sample_t, "Mental Focus")
assert len(hooks) == 10
print(f"Hook 1 ({hooks[0].type}): \"{hooks[0].text}\"")
print(f"Hook 2 ({hooks[1].type}): \"{hooks[1].text}\"")
print(f"Hook 3 ({hooks[2].type}): \"{hooks[2].text}\"")

remixes = _generate_platform_remixes(hooks[0].text, "Mental Focus", sample_t, ["#Mindset", "#Focus"])
print("[PASS] Generated remixes for platforms:", list(remixes.keys()))
print("\nALL VERIFICATION CHECKS PASSED!")
