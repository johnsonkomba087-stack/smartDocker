"""
Admission Filter Mode
Upload applicant documents + set minimum criteria → auto filter qualified vs rejected.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
from pydantic import BaseModel, Field

from ..core.parser import extract_text
from ..core.analyzer import analyze_resume, extract_skills, extract_experience_signals

router = APIRouter(prefix="/api/admission", tags=["Admission Filter"])


class AdmissionCriteria(BaseModel):
    min_score: float = Field(50.0, ge=0, le=100)
    required_skills: List[str] = []
    min_education: str = "none"  # none | bachelor | master | phd
    require_quantified: bool = False


class AdmissionResultItem(BaseModel):
    filename: str
    score: float
    status: str  # "qualified" | "rejected"
    reasons: List[str]
    matched_skills: List[str]
    missing_required_skills: List[str]


class AdmissionResponse(BaseModel):
    total: int
    qualified_count: int
    rejected_count: int
    qualified: List[AdmissionResultItem]
    rejected: List[AdmissionResultItem]


EDU_LEVELS = {"none": 0, "bachelor": 0.5, "master": 0.75, "phd": 1.0}


@router.post("/filter", response_model=AdmissionResponse)
async def filter_applicants(
    job_description: str = Form(..., min_length=10),
    min_score: float = Form(50.0),
    required_skills: str = Form(""),  # comma-separated
    min_education: str = Form("none"),
    require_quantified: bool = Form(False),
    resumes: List[UploadFile] = File(...),
):
    """
    Filter applicants against admission / hiring criteria.
    Returns qualified and rejected lists with reasons.
    """
    if not resumes:
        raise HTTPException(status_code=400, detail="No documents uploaded")
    if len(resumes) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 documents allowed")

    req_skills = [s.strip().lower() for s in required_skills.split(",") if s.strip()]
    min_edu_val = EDU_LEVELS.get(min_education.lower(), 0)

    qualified = []
    rejected = []

    for resume in resumes:
        if not resume.filename:
            continue
        fname = resume.filename.lower()
        if not (fname.endswith(".pdf") or fname.endswith(".docx")):
            continue

        try:
            file_bytes = await resume.read()
            if len(file_bytes) == 0:
                continue
            text = extract_text(resume.filename, file_bytes)
            if len(text.strip()) < 30:
                continue

            analysis = analyze_resume(text, job_description, resume.filename)
            signals = extract_experience_signals(text)
            resume_skills = set(analysis["skill_match"]["matched_skills"] + 
                               analysis["skill_match"]["missing_skills"])
            # Better: extract from resume directly
            from ..core.analyzer import extract_skills as ext
            resume_skills = set(ext(text))

            reasons = []
            status = "qualified"

            # Score check
            if analysis["score"] < min_score:
                status = "rejected"
                reasons.append(f"Score {analysis['score']} below minimum {min_score}")

            # Required skills check
            missing_req = [s for s in req_skills if s not in resume_skills]
            if missing_req:
                status = "rejected"
                reasons.append(f"Missing required skills: {', '.join(missing_req)}")

            # Education check
            if signals["education_level"] < min_edu_val:
                status = "rejected"
                reasons.append(f"Education level below required ({min_education})")

            # Quantified achievements
            if require_quantified and signals["has_quantified_achievements"] < 1.0:
                status = "rejected"
                reasons.append("No quantified achievements found")

            if status == "qualified":
                reasons.append("Meets all criteria")

            item = AdmissionResultItem(
                filename=resume.filename,
                score=analysis["score"],
                status=status,
                reasons=reasons,
                matched_skills=analysis["skill_match"]["matched_skills"],
                missing_required_skills=missing_req,
            )

            if status == "qualified":
                qualified.append(item)
            else:
                rejected.append(item)

        except Exception:
            continue

    # Sort both by score desc
    qualified.sort(key=lambda x: x.score, reverse=True)
    rejected.sort(key=lambda x: x.score, reverse=True)

    return AdmissionResponse(
        total=len(qualified) + len(rejected),
        qualified_count=len(qualified),
        rejected_count=len(rejected),
        qualified=qualified,
        rejected=rejected,
    )