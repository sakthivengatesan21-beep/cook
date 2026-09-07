from typing import Dict, Any, List, Optional, Tuple
from app.models.schemas import CaptionCandidate, StructuredVisualContext

class CaptionRanker:
    """
    Ranks caption candidates using a multi-factor weighted scoring model:
    - Factual Accuracy: 0.50
    - Visual Relevance: 0.20
    - Transcript Relevance: 0.15
    - Naturalness & Flow: 0.10
    - Engagement / Hook: 0.05
    """

    WEIGHTS = {
        "accuracy": 0.50,
        "visual": 0.20,
        "transcript": 0.15,
        "naturalness": 0.10,
        "engagement": 0.05
    }

    def compute_candidate_score(
        self,
        candidate: CaptionCandidate,
        style_preference: Optional[str] = None
    ) -> float:
        """
        Calculates weighted composite score for a caption candidate.
        """
        score = (
            self.WEIGHTS["accuracy"] * candidate.accuracy_score +
            self.WEIGHTS["visual"] * candidate.visual_relevance +
            self.WEIGHTS["transcript"] * candidate.transcript_relevance +
            self.WEIGHTS["naturalness"] * candidate.naturalness +
            self.WEIGHTS["engagement"] * candidate.engagement
        )

        # Style preference bonus
        if style_preference and candidate.style.lower() == style_preference.lower() and candidate.is_supported:
            score += 0.08

        # Heavy penalty for unsupported terms or rejected status
        if not candidate.is_supported or len(candidate.unsupported_terms) > 0:
            score -= (0.35 + 0.15 * len(candidate.unsupported_terms))

        return max(0.0, min(1.0, round(score, 3)))

    def rank_candidates(
        self,
        candidates: List[CaptionCandidate],
        visual_context: StructuredVisualContext,
        style_preference: Optional[str] = None
    ) -> Tuple[List[CaptionCandidate], str, str, Dict[str, Any]]:
        """
        Scores and ranks all candidates, selecting the top recommended caption and style.
        Returns (ranked_candidates, recommended_caption, recommended_style, debug_signals).
        """
        if not candidates:
            return [], "", "natural", {"error": "No candidates provided"}

        scored_candidates: List[CaptionCandidate] = []
        for cand in candidates:
            final_score = self.compute_candidate_score(cand, style_preference)
            scored_cand = cand.model_copy(update={"final_score": final_score})
            scored_candidates.append(scored_cand)

        # Sort descending by final score
        scored_candidates.sort(key=lambda c: c.final_score, reverse=True)

        top_candidate = scored_candidates[0]
        recommended_caption = top_candidate.text
        recommended_style = top_candidate.style

        supported_count = sum(1 for c in scored_candidates if c.is_supported)
        rejected_count = len(scored_candidates) - supported_count

        debug_signals = {
            "weights": self.WEIGHTS,
            "top_candidate_score": top_candidate.final_score,
            "top_candidate_accuracy": top_candidate.accuracy_score,
            "visual_confidence": visual_context.confidence_breakdown.overall,
            "frames_analyzed": visual_context.frames_analyzed,
            "supported_count": supported_count,
            "rejected_count": rejected_count,
            "selected_style": recommended_style
        }

        return scored_candidates, recommended_caption, recommended_style, debug_signals

caption_ranker = CaptionRanker()
