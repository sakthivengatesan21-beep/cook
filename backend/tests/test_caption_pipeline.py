import pytest
import os
import sys
from pathlib import Path

# Add parent directory to sys.path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.models.schemas import (
    StructuredVisualContext,
    VisualAction,
    ConfidenceBreakdown,
    CaptionCandidate,
    CaptionValidationResult,
    MultimodalCaptionResponse
)
from app.services.caption_generator import caption_generator
from app.services.caption_validator import caption_validator
from app.services.caption_ranker import caption_ranker


# =============================================================================
# TEST SUITE 1: Cooking Video Grounding (Dosa on Tawa)
# =============================================================================
def test_cooking_dosa_grounding_and_hallucination_rejection():
    """
    Test 1: Given a video showing spreading batter on a hot pan (dosa),
    the pipeline must generate cooking/breakfast captions and strictly reject
    hallucinated entities like 'pasta', 'pizza', 'sushi', or 'cake'.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Cooking crispy dosa on a flat pan",
        objects=["dosa batter", "hot tawa pan", "ladle", "gas stove", "oil drizzle", "plate"],
        environment="kitchen",
        people_count=1,
        actions=[
            VisualAction(action="Pouring white batter onto hot tawa", confidence=0.95),
            VisualAction(action="Spreading batter in smooth circular motion", confidence=0.96),
            VisualAction(action="Flipping golden crispy crepe", confidence=0.94)
        ],
        visual_summary="A creator spreads batter smoothly on a hot tawa in the kitchen, crafting a golden crispy dosa.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.96,
            objects=0.95,
            environment=0.98,
            spoken_context=0.90,
            overall=0.95
        ),
        frames_analyzed=8
    )
    transcript = "Good morning everyone! Making a quick breakfast today before heading out."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=30.0,
        title_context="breakfast_cooking.mp4"
    )

    assert len(candidates) >= 5, "Must generate at least 5 distinct styles"
    
    # Verify styles
    styles = {c.style for c in candidates}
    assert {"natural", "funny", "storytelling", "short", "professional"}.issubset(styles)

    # Test hallucination rejection on injected fake candidates
    fake_pasta_candidate = CaptionCandidate(
        text="Making creamy garlic pasta for dinner tonight 🍝",
        style="natural",
        style_label="Natural",
        accuracy_score=0.95,
        visual_relevance=0.90,
        transcript_relevance=0.85,
        naturalness=0.90,
        engagement=0.88,
        confidence=0.90,
        final_score=0.0
    )
    fake_gaming_candidate = CaptionCandidate(
        text="Clutching this 1v5 in Fortnite with insane headshots 🔥",
        style="funny",
        style_label="Funny",
        accuracy_score=0.95,
        visual_relevance=0.90,
        transcript_relevance=0.85,
        naturalness=0.90,
        engagement=0.88,
        confidence=0.90,
        final_score=0.0
    )

    # Validate candidates
    validated = caption_validator.validate_and_filter_candidates(
        candidates=[*candidates, fake_pasta_candidate, fake_gaming_candidate],
        visual_context=v_ctx,
        transcript=transcript
    )

    # Validate fake candidates were flagged/rejected
    pasta_val = [c for c in validated if "pasta" in c.text.lower()][0]
    gaming_val = [c for c in validated if "fortnite" in c.text.lower()][0]

    assert "pasta" in pasta_val.unsupported_terms or not pasta_val.is_supported or pasta_val.accuracy_score < 0.70
    assert "fortnite" in gaming_val.unsupported_terms or not gaming_val.is_supported or gaming_val.accuracy_score < 0.70

    # Rank candidates
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)
    
    # The recommended caption must NOT be pasta or fortnite
    assert "pasta" not in rec_cap.lower()
    assert "fortnite" not in rec_cap.lower()
    assert ranked[0].is_supported is True
    assert ranked[0].final_score > 0.80


# =============================================================================
# TEST SUITE 2: Travel & Landscape Video
# =============================================================================
def test_travel_hiking_landscape_grounding():
    """
    Test 2: Video showing scenic mountain hike and sunrise summit.
    Must generate travel adventure captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Hiking on a scenic mountain ridge at sunrise",
        objects=["hiking backpack", "mountain peaks", "trail", "clouds", "sunrise horizon"],
        environment="mountains / outdoor nature",
        people_count=1,
        actions=[
            VisualAction(action="Walking along scenic mountain crest", confidence=0.96),
            VisualAction(action="Looking out at the golden sunrise horizon", confidence=0.97)
        ],
        visual_summary="A hiker stands on a high mountain summit overlooking rolling cloud cover and sunrise.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.97,
            objects=0.94,
            environment=0.99,
            spoken_context=0.88,
            overall=0.95
        ),
        frames_analyzed=8
    )
    transcript = "Look at this breathtaking view from the summit. Worth every single step."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=45.0,
        title_context="mountain_hike.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    assert any(term in rec_cap.lower() for term in ["view", "mountain", "step", "summit", "hiking", "sunrise", "worth", "nature", "scenic"])
    assert debug["supported_count"] >= 4


# =============================================================================
# TEST SUITE 3: Gaming FPS Video
# =============================================================================
def test_gaming_fps_clutch_grounding():
    """
    Test 3: Video showing intense first-person shooter gameplay and elimination banner.
    Must generate gaming/clutch captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Playing tactical FPS video game on PC",
        objects=["game HUD", "weapon crosshair", "health bar", "elimination banner", "radar map"],
        environment="gaming setup / virtual arena",
        people_count=1,
        actions=[
            VisualAction(action="Aiming down sights through doorway", confidence=0.95),
            VisualAction(action="Securing final elimination for round win", confidence=0.96)
        ],
        visual_summary="Player clutches final 1v1 round in tactical shooter game with precise aim.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.96,
            objects=0.95,
            environment=0.95,
            spoken_context=0.92,
            overall=0.95
        ),
        frames_analyzed=8
    )
    transcript = "One enemy left, let's lock in and get this round win."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=25.0,
        title_context="fps_clutch.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx, style_preference="funny")

    assert any(term in rec_cap.lower() for term in ["game", "round", "win", "enemy", "clutch", "lock in", "aim", "pov", "play"])


# =============================================================================
# TEST SUITE 4: Fashion / Streetwear Outfit Video
# =============================================================================
def test_fashion_streetwear_grounding():
    """
    Test 4: Video showing mirror selfie streetwear outfit transition.
    Must generate fashion / styling captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Showcasing streetwear outfit styling in mirror",
        objects=["mirror", "oversized hoodie", "cargo pants", "sneakers", "jewelry chain"],
        environment="bedroom / dressing area",
        people_count=1,
        actions=[
            VisualAction(action="Stepping back to display full silhouette", confidence=0.94),
            VisualAction(action="Close-up on sneaker details and accessories", confidence=0.95)
        ],
        visual_summary="Creator displays modern layered autumn streetwear outfit in front of full-length mirror.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.94,
            objects=0.93,
            environment=0.95,
            spoken_context=0.88,
            overall=0.93
        ),
        frames_analyzed=8
    )
    transcript = "Trying out this new layered fit for the weekend."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=20.0,
        title_context="ootd_fit.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    assert any(term in rec_cap.lower() for term in ["fit", "outfit", "style", "layer", "styling", "look", "weekend", "wear"])


# =============================================================================
# TEST SUITE 5: Talking-Head Podcast Video
# =============================================================================
def test_talking_head_podcast_grounding():
    """
    Test 5: Talking-head podcast with studio mic and actionable wisdom.
    Must generate insight / thought-provoking captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Speaking into studio microphone during podcast recording",
        objects=["shure sm7b microphone", "headphones", "studio sound panels", "ring light"],
        environment="recording studio",
        people_count=1,
        actions=[
            VisualAction(action="Speaking passionately with hand gestures", confidence=0.95),
            VisualAction(action="Emphasizing key career advice", confidence=0.94)
        ],
        visual_summary="Host speaks directly into studio microphone explaining career mindset strategies.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.95,
            objects=0.96,
            environment=0.98,
            spoken_context=0.96,
            overall=0.96
        ),
        frames_analyzed=8
    )
    transcript = "The biggest mistake people make in their 20s is waiting for the perfect time. The truth is there is never a perfect time."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=40.0,
        title_context="podcast_mindset.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx, style_preference="storytelling")

    assert any(term in rec_cap.lower() for term in ["time", "mistake", "truth", "perfect", "start", "lesson", "20s", "advice", "mindset", "never"])


# =============================================================================
# TEST SUITE 6: Product Showcase / Tech Unboxing
# =============================================================================
def test_product_tech_unboxing_grounding():
    """
    Test 6: Unboxing a new tech gadget from minimalist box.
    Must generate tech showcase captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Unboxing minimalist flagship smartphone package",
        objects=["matte black retail box", "smartphone device", "braided usb-c cable", "desk mat"],
        environment="clean tech studio desk",
        people_count=1,
        actions=[
            VisualAction(action="Peeling protective film from device screen", confidence=0.98),
            VisualAction(action="Inspecting sleek matte titanium frame", confidence=0.95)
        ],
        visual_summary="Hands unbox a sleek new matte smartphone on a clean minimalist studio desk.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.96,
            objects=0.96,
            environment=0.97,
            spoken_context=0.90,
            overall=0.96
        ),
        frames_analyzed=8
    )
    transcript = "The build quality on this new device is incredible right out of the box."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=30.0,
        title_context="unboxing_review.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    assert any(term in rec_cap.lower() for term in ["unbox", "box", "device", "quality", "clean", "phone", "design", "tech", "matte", "setup"])


# =============================================================================
# TEST SUITE 7: Tutorial / Coding Video
# =============================================================================
def test_tutorial_coding_grounding():
    """
    Test 7: Coding tutorial on dark mode IDE.
    Must generate programming / software development captions.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Writing Python function in code editor with dark theme",
        objects=["code editor ide", "syntax highlighted code", "terminal window", "mechanical keyboard"],
        environment="workspace desk",
        people_count=1,
        actions=[
            VisualAction(action="Typing clean recursive function definition", confidence=0.96),
            VisualAction(action="Running unit test suite in terminal", confidence=0.95)
        ],
        visual_summary="Developer writes and executes recursive algorithms in Python inside dark-mode IDE.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.96,
            objects=0.97,
            environment=0.95,
            spoken_context=0.92,
            overall=0.95
        ),
        frames_analyzed=8
    )
    transcript = "Here is the cleanest way to write a recursive helper function in Python."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=35.0,
        title_context="python_tips.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx, style_preference="professional")

    assert any(term in rec_cap.lower() for term in ["python", "code", "function", "clean", "developer", "tips", "helper", "write", "logic", "programming"])


# =============================================================================
# TEST SUITE 8: Silent Video (No Speech Audio)
# =============================================================================
def test_silent_video_graceful_handling():
    """
    Test 8: Video with no speech / empty transcript (e.g. sunset timelapse).
    Pipeline must generate visually grounded captions without crashing or hallucinating dialogue.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Time-lapse of city skyline sunset transition to night lights",
        objects=["city skyscrapers", "evening sky", "glowing streetlights", "car light trails"],
        environment="urban rooftop overlooking city",
        people_count=0,
        actions=[
            VisualAction(action="Sun sinking below the horizon", confidence=0.98),
            VisualAction(action="City illumination turning on across skyline", confidence=0.97)
        ],
        visual_summary="Stunning time-lapse transition from golden sunset to sparkling city lights over skyline.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.98,
            objects=0.95,
            environment=0.99,
            spoken_context=0.0,  # No speech
            overall=0.94
        ),
        frames_analyzed=8
    )
    transcript = ""  # Silent video

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=15.0,
        title_context="city_timelapse.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    assert len(ranked) >= 5
    assert any(term in rec_cap.lower() for term in ["city", "sunset", "skyline", "night", "lights", "sky", "view", "moment", "vibes"])


# =============================================================================
# TEST SUITE 9: Misleading Speech vs. Visual Priority
# =============================================================================
def test_visual_evidence_priority_over_misleading_speech():
    """
    Test 9: Speaker in a gym lifting weights makes an offhand joke about pizza.
    Visual evidence must dominate so the caption describes gym workout / lifting,
    and rejects pizza as the main activity.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Performing barbell back squats at fitness gym",
        objects=["olympic barbell", "weight plates", "squat rack", "gym chalk", "weightlifting belt"],
        environment="fitness gym weight room",
        people_count=1,
        actions=[
            VisualAction(action="Unracking heavy barbell onto shoulders", confidence=0.97),
            VisualAction(action="Performing full depth squat repetition", confidence=0.96)
        ],
        visual_summary="Athlete performs heavy barbell squats with solid technique inside gym squat rack.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.97,
            objects=0.96,
            environment=0.98,
            spoken_context=0.50,
            overall=0.95
        ),
        frames_analyzed=8
    )
    transcript = "Honestly guys I really just love eating deep dish pizza with extra cheese on weekends."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=30.0,
        title_context="leg_day.mp4"
    )
    
    # Injected hallucinated candidate focusing purely on speech
    hallucinated_pizza_cand = CaptionCandidate(
        text="The ultimate guide to making the crispiest deep dish pizza crust 🍕",
        style="natural",
        style_label="Natural",
        accuracy_score=0.95,
        visual_relevance=0.20,
        transcript_relevance=0.95,
        naturalness=0.90,
        engagement=0.88,
        confidence=0.90,
        final_score=0.0
    )

    validated = caption_validator.validate_and_filter_candidates(
        candidates=[*candidates, hallucinated_pizza_cand],
        visual_context=v_ctx,
        transcript=transcript
    )
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    # Top recommended caption MUST be gym/squats/workout, NOT pizza recipe
    assert "pizza" not in rec_cap.lower()
    assert any(term in rec_cap.lower() for term in ["squat", "barbell", "gym", "workout", "leg", "weight", "rep", "fitness", "heavy"])


# =============================================================================
# TEST SUITE 10: Low Confidence / Ambiguous Video (Safe Generalization)
# =============================================================================
def test_low_confidence_safe_generalization():
    """
    Test 10: Low visual confidence (0.65) with ambiguous food plate.
    The system should output broad accurate descriptions rather than hallucinating
    specific regional dish names.
    """
    v_ctx = StructuredVisualContext(
        main_activity="Eating a homemade meal at dining table",
        objects=["plate", "bowl", "fork", "table"],
        environment="dining room / home",
        people_count=1,
        actions=[
            VisualAction(action="Eating meal with fork", confidence=0.70)
        ],
        visual_summary="A person sits at a home dining table enjoying a prepared meal from a plate.",
        confidence_breakdown=ConfidenceBreakdown(
            main_activity=0.68,
            objects=0.65,
            environment=0.70,
            spoken_context=0.60,
            overall=0.66
        ),
        frames_analyzed=4
    )
    transcript = "Quick lunch before the next meeting."

    candidates = caption_generator.generate_captions(
        visual_context=v_ctx,
        transcript=transcript,
        duration=15.0,
        title_context="lunch.mp4"
    )
    validated = caption_validator.validate_and_filter_candidates(candidates, v_ctx, transcript)
    ranked, rec_cap, rec_style, debug = caption_ranker.rank_candidates(validated, v_ctx)

    # In low-confidence mode, ensure no unsupported exotic dishes are in top recommendation
    for exotic_dish in ["kerala fish moilee", "coq au vin", "beef wellington", "ratatouille", "sushi omakase"]:
        assert exotic_dish not in rec_cap.lower()
    
    assert any(term in rec_cap.lower() for term in ["lunch", "meal", "quick", "food", "day", "routine", "table", "eat", "homemade"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
