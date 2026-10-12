"""
Optional LLM-powered feedback.
Supports Groq (cloud) and Ollama (local).
Falls back gracefully when no provider is configured.
"""
from typing import Optional, Dict, List
import httpx
from .config import get_settings

settings = get_settings()


async def generate_llm_feedback(
    resume_text: str,
    job_description: str,
    score: float,
    matched_skills: List[str],
    missing_skills: List[str],
) -> Optional[str]:
    """
    Generate rich, personalized feedback using an LLM.
    Returns None if LLM is not configured or fails.
    """
    if settings.LLM_PROVIDER == "none" or not settings.LLM_PROVIDER:
        return None

    prompt = f"""You are an expert technical recruiter and career coach.
Analyze this resume against the job description and give concise, actionable feedback.

Job Description:
{job_description[:1500]}

Resume:
{resume_text[:2000]}

Current Score: {score}/100
Matched Skills: {', '.join(matched_skills[:10]) or 'None'}
Missing Skills: {', '.join(missing_skills[:10]) or 'None'}

Provide:
1. Overall assessment (2-3 sentences)
2. Top 3 strengths
3. Top 3 concrete improvement suggestions
4. One sentence on interview readiness

Keep the total response under 250 words. Be direct and practical."""

    try:
        if settings.LLM_PROVIDER == "groq":
            return await _call_groq(prompt)
        elif settings.LLM_PROVIDER == "ollama":
            return await _call_ollama(prompt)
    except Exception:
        return None
    return None


async def _call_groq(prompt: str) -> Optional[str]:
    if not settings.GROQ_API_KEY:
        return None
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.LLM_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.4,
                "max_tokens": 500,
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    return None


async def _call_ollama(prompt: str) -> Optional[str]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={
                "model": settings.LLM_MODEL,
                "prompt": prompt,
                "stream": False,
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("response", "").strip()
    return None