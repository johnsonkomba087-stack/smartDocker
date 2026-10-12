from pydantic import BaseModel, Field
from typing import List, Optional, Dict


class AnalyzeRequest(BaseModel):
    job_description: str = Field(..., min_length=20, description="The job description text")


class SkillMatch(BaseModel):
    matched_skills: List[str]
    missing_skills: List[str]
    match_percentage: float


class ScoreBreakdown(BaseModel):
    skill_match: float
    semantic_similarity: float
    experience_quality: float


class AnalyzeResponse(BaseModel):
    filename: str
    score: float = Field(..., ge=0, le=100)
    skill_match: SkillMatch
    strengths: List[str]
    improvements: List[str]
    summary: str
    score_breakdown: Optional[ScoreBreakdown] = None
    llm_feedback: Optional[str] = None


class BatchResultItem(BaseModel):
    rank: int
    filename: str
    score: float
    matched_skills: List[str]
    missing_skills: List[str]


class BatchResponse(BaseModel):
    total_resumes: int
    results: List[BatchResultItem]
    job_description_preview: str
