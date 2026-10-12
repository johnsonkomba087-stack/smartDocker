from typing import List, Dict
from .analyzer import analyze_resume


def rank_resumes(resumes: List[Dict], job_description: str) -> List[Dict]:
    """
    Analyze and rank multiple resumes.
    
    Args:
        resumes: List of dicts with keys: filename, text
        job_description: The job description text
    
    Returns:
        Sorted list of analysis results (highest score first) with rank added.
    """
    results = []

    for resume in resumes:
        analysis = analyze_resume(
            resume_text=resume["text"],
            job_description=job_description,
            filename=resume["filename"]
        )
        results.append(analysis)

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    # Add rank
    for idx, item in enumerate(results, start=1):
        item["rank"] = idx

    return results