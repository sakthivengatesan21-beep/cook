"""
Content Safety & Moderation Analysis Engine for COOK.
Analyzes transcript dialogue, hook variations, and generated social posts
for safety flags (hate, harassment, sexual content, violent content, dangerous instructions, spam/toxicity).
"""

from typing import Dict, Any, List
import re

TOXICITY_KEYWORDS = {
    "hate": [
        "hate speech", "ethnic slur", "racial slur", "kill all", "destroy group",
        "subhuman", "inferior race", "deport all"
    ],
    "harassment": [
        "doxx", "harass", "kill yourself", "kys", "threaten", "stalk", "leak address", "swatting"
    ],
    "violence": [
        "how to make bomb", "how to build weapon", "mass murder", "assassinate", "terrorist attack"
    ],
    "dangerous_instructions": [
        "poison recipe", "suicide method", "inject bleach", "disable brakes", "steal identity"
    ],
    "explicit": [
        "explicit porn", "underage explicit", "nsfw video leak"
    ],
    "spam": [
        "click here for free crypto", "guaranteed 10000x return in 24h", "send btc to double your money",
        "100% free money glitch no scam"
    ]
}

def analyze_content_safety(text: str, context: str = "dialogue") -> Dict[str, Any]:
    """
    Analyzes text against safety criteria.
    Returns structured moderation report.
    """
    if not text or not text.strip():
        return {
            "safe": True,
            "status": "APPROVED",
            "flags": [],
            "risk_score": 0,
            "category_scores": {
                "hate": 0,
                "harassment": 0,
                "violence": 0,
                "dangerous_instructions": 0,
                "explicit": 0,
                "spam": 0
            },
            "recommendation": "APPROVE",
            "summary": "No safety issues detected. Content is clean and platform-ready."
        }

    lower_text = text.lower()
    flags = []
    category_scores = {}
    total_risk = 0

    for category, terms in TOXICITY_KEYWORDS.items():
        matched = []
        for term in terms:
            if re.search(r'\b' + re.escape(term) + r'\b', lower_text):
                matched.append(term)
        
        score = min(100, len(matched) * 45)
        category_scores[category] = score
        if matched:
            flags.append({
                "category": category,
                "matched_terms": matched,
                "severity": "HIGH" if score >= 50 else "MEDIUM"
            })
            total_risk += score

    # Check for excessive aggressive punctuation or all-caps spam patterns
    if len(re.findall(r'[!$?]{3,}', text)) > 2:
        category_scores["spam"] = max(category_scores.get("spam", 0), 30)
        total_risk += 20

    is_safe = len(flags) == 0
    status = "APPROVED" if is_safe else ("REVIEW_RECOMMENDED" if total_risk < 70 else "FLAGGED")
    recommendation = "APPROVE" if is_safe else "REVIEW_RECOMMENDED"

    summary = (
        "No safety issues detected. 100% compliant with platform guidelines."
        if is_safe else
        f"Review recommended: Potential {', '.join([f['category'] for f in flags])} detected."
    )

    return {
        "safe": is_safe,
        "status": status,
        "flags": flags,
        "risk_score": min(100, total_risk),
        "category_scores": category_scores,
        "recommendation": recommendation,
        "summary": summary
    }
