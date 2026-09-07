import re
from typing import Dict, Any, List, Set, Optional, Tuple
from app.models.schemas import StructuredVisualContext, CaptionCandidate, CaptionValidationResult

# Common stop words & stylistic words that don't represent concrete factual claims
COMMON_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "because", "as", "what",
    "when", "where", "how", "all", "any", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "can", "will", "just", "should",
    "now", "is", "are", "was", "were", "be", "been", "being", "have", "has",
    "had", "do", "does", "did", "doing", "at", "by", "for", "from", "in",
    "into", "of", "off", "on", "onto", "out", "over", "to", "up", "with",
    "about", "against", "between", "through", "during", "before", "after",
    "above", "below", "pov", "trying", "secret", "routine", "done", "right",
    "simple", "day", "morning", "night", "vibes", "mood", "moment", "time",
    "making", "creating", "cooking", "playing", "working", "building", "sharing",
    "step", "steps", "guide", "tips", "tricks", "hack", "hacks", "life",
    "always", "never", "best", "great", "quick", "easy", "perfect", "clean",
    "smooth", "pro", "level", "flow", "session", "process", "behind", "scenes",
    "streamlining", "technique", "techniques", "experience", "journey", "ready",
    "starting", "today", "tomorrow", "this", "that", "these", "those", "my",
    "your", "our", "their", "his", "her", "its", "i", "you", "we", "they",
    "it", "me", "us", "them", "here", "there", "every", "zero", "rush",
    "focus", "action", "setup", "update", "part", "first", "next", "final"
}

# Known conflicting entity domain clusters (if video is in domain A, terms in domain B without visual/audio proof are hallucinations)
DOMAIN_CONFLICTS = {
    "cooking": {
        "dishes": {"dosa", "pasta", "pizza", "sushi", "cake", "cookie", "cookies", "curry", "rice", "biryani", "noodles", "pancake", "pancakes", "burger", "sandwich", "steak", "taco", "tacos", "soup", "salad", "bread", "toast", "omelette", "eggs"},
        "gaming": {"fortnite", "minecraft", "valorant", "warzone", "apex", "roblox", "elden ring", "gta", "fifa", "clutch", "headshot", "respawn"},
        "automotive": {"bmw", "mercedes", "ferrari", "tesla", "porsche", "lamborghini", "exhaust", "turbo", "drift", "engine swap"}
    },
    "gaming": {
        "cooking": {"dosa", "pasta", "pizza", "sushi", "cake", "curry", "stir fry", "batter", "recipe", "ingredients", "tasting"},
        "fitness": {"deadlift", "squat", "bench press", "bicep curl", "dumbbell", "barbell", "treadmill"}
    }
}

class CaptionValidator:
    """
    Validates caption factual grounding against multimodal visual evidence and transcript.
    Eliminates hallucinations (e.g., claiming pasta when making dosa, or gaming terms in cooking videos).
    """

    def __init__(self):
        pass

    def extract_entity_tokens(self, text: str) -> Set[str]:
        """
        Tokenizes text and extracts significant entities/nouns, stripping punctuation and emojis.
        """
        # Clean text of emojis and symbols
        clean = re.sub(r'[^\w\s]', ' ', text.lower())
        words = clean.split()
        return {w for w in words if len(w) > 2 and w not in COMMON_STOPWORDS}

    def build_grounded_knowledge_base(
        self,
        visual_context: StructuredVisualContext,
        transcript: str
    ) -> Dict[str, Any]:
        """
        Aggregates all verifiable objects, actions, environments, and speech tokens.
        """
        grounded_terms: Set[str] = set()
        grounded_phrases: Set[str] = set()

        # 1. Main activity
        if visual_context.main_activity:
            grounded_phrases.add(visual_context.main_activity.lower())
            for t in self.extract_entity_tokens(visual_context.main_activity):
                grounded_terms.add(t)

        # 2. Objects
        for obj in visual_context.objects:
            grounded_phrases.add(obj.lower())
            for t in self.extract_entity_tokens(obj):
                grounded_terms.add(t)

        # 3. Environment
        if visual_context.environment:
            grounded_phrases.add(visual_context.environment.lower())
            for t in self.extract_entity_tokens(visual_context.environment):
                grounded_terms.add(t)

        # 4. Actions
        for act in visual_context.actions:
            grounded_phrases.add(act.action.lower())
            for t in self.extract_entity_tokens(act.action):
                grounded_terms.add(t)

        # 5. Specific details
        for det in visual_context.specific_details:
            name = str(det.get("name", "")).lower()
            val = str(det.get("value", "")).lower()
            if name:
                grounded_phrases.add(name)
                for t in self.extract_entity_tokens(name):
                    grounded_terms.add(t)
            if val:
                grounded_phrases.add(val)
                for t in self.extract_entity_tokens(val):
                    grounded_terms.add(t)

        # 6. Visual summary
        if visual_context.visual_summary:
            for t in self.extract_entity_tokens(visual_context.visual_summary):
                grounded_terms.add(t)

        # 7. Transcript (Spoken audio)
        if transcript:
            clean_trans = transcript.lower()
            grounded_phrases.add(clean_trans)
            for t in self.extract_entity_tokens(clean_trans):
                grounded_terms.add(t)

        return {
            "terms": grounded_terms,
            "phrases": grounded_phrases,
            "main_activity": (visual_context.main_activity or "").lower(),
            "raw_text": f"{visual_context.main_activity} {' '.join(visual_context.objects)} {visual_context.environment} {visual_context.visual_summary} {transcript}".lower()
        }

    def validate_candidate(
        self,
        candidate: CaptionCandidate,
        visual_context: StructuredVisualContext,
        transcript: str
    ) -> CaptionValidationResult:
        """
        Validates a single candidate caption against visual context and transcript.
        Detects specific entity hallucinations (e.g., 'pasta' in a 'dosa' video).
        """
        kb = self.build_grounded_knowledge_base(visual_context, transcript)
        cand_tokens = self.extract_entity_tokens(candidate.text)
        
        unsupported: List[str] = []
        grounded_facts: List[str] = []

        cand_text_lower = candidate.text.lower()
        raw_kb_text = kb["raw_text"]

        # Check domain conflicts and ungrounded concrete entities
        for domain, sub_conflicts in DOMAIN_CONFLICTS.items():
            for category_name, entity_set in sub_conflicts.items():
                for entity in entity_set:
                    # If entity is in candidate text
                    if re.search(r'\b' + re.escape(entity) + r'\b', cand_text_lower):
                        # Is it grounded in raw KB?
                        if entity not in raw_kb_text and not any(entity in p for p in kb["phrases"]):
                            unsupported.append(entity)
                        else:
                            grounded_facts.append(entity)

        # Record grounded words from KB
        for tok in cand_tokens:
            if tok in kb["terms"] or any(tok in p for p in kb["phrases"]) or tok in raw_kb_text:
                grounded_facts.append(tok)

        # Deduplicate
        unsupported = list(set(unsupported))
        grounded_facts = list(set(grounded_facts))

        # Scoring
        base_accuracy = candidate.accuracy_score or 0.95
        penalty = len(unsupported) * 0.40
        final_accuracy = max(0.0, min(1.0, base_accuracy - penalty))

        is_valid = len(unsupported) == 0 or (len(unsupported) == 1 and final_accuracy >= 0.70)
        
        status = "PASSED"
        if not is_valid or len(unsupported) >= 2:
            status = "REJECTED"
        elif len(unsupported) == 1:
            status = "FLAGGED"

        return CaptionValidationResult(
            is_valid=is_valid,
            accuracy_score=round(final_accuracy, 3),
            unsupported_terms=unsupported,
            grounded_facts=grounded_facts,
            validation_status=status
        )

    def validate_and_filter_candidates(
        self,
        candidates: List[CaptionCandidate],
        visual_context: StructuredVisualContext,
        transcript: str
    ) -> List[CaptionCandidate]:
        """
        Validates all candidate captions, updates their factual accuracy and unsupported terms,
        and ensures any ungrounded candidates are marked accordingly.
        """
        validated: List[CaptionCandidate] = []
        for cand in candidates:
            res = self.validate_candidate(cand, visual_context, transcript)
            
            updated_cand = cand.model_copy(update={
                "accuracy_score": res.accuracy_score,
                "unsupported_terms": res.unsupported_terms,
                "is_supported": res.is_valid and res.validation_status != "REJECTED",
                "confidence": min(cand.confidence, res.accuracy_score)
            })
            validated.append(updated_cand)

        return validated

caption_validator = CaptionValidator()
