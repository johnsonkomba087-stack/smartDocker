"""
Optional semantic embeddings using sentence-transformers.
Falls back to TF-IDF when not available or disabled.
"""
from typing import Optional
from .config import get_settings

settings = get_settings()
_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model
    if not settings.USE_EMBEDDINGS:
        return None
    try:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
        return _model
    except Exception:
        return None


def semantic_similarity(text_a: str, text_b: str) -> Optional[float]:
    """
    Compute cosine similarity using sentence embeddings.
    Returns None if embeddings are unavailable.
    """
    model = _load_model()
    if model is None:
        return None
    try:
        from sklearn.metrics.pairwise import cosine_similarity
        import numpy as np

        embeddings = model.encode([text_a[:2000], text_b[:2000]])
        sim = cosine_similarity(
            embeddings[0].reshape(1, -1),
            embeddings[1].reshape(1, -1)
        )[0][0]
        return float(sim)
    except Exception:
        return None