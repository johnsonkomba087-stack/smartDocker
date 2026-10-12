from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
import io

from ..core.parser import extract_text
from ..core.ranker import rank_resumes
from ..core.export import create_excel_report
from ..models.schemas import BatchResponse, BatchResultItem

router = APIRouter(prefix="/api", tags=["Batch Analysis"])


async def _parse_resumes(resumes: List[UploadFile]) -> list:
    """Shared helper to parse uploaded resumes."""
    parsed = []
    for resume in resumes:
        if not resume.filename:
            continue
        filename = resume.filename.lower()
        if not (filename.endswith(".pdf") or filename.endswith(".docx")):
            continue
        try:
            file_bytes = await resume.read()
            if len(file_bytes) == 0:
                continue
            text = extract_text(resume.filename, file_bytes)
            if len(text.strip()) >= 50:
                parsed.append({"filename": resume.filename, "text": text})
        except Exception:
            continue
    return parsed


@router.post("/batch", response_model=BatchResponse)
async def analyze_batch_resumes(
    job_description: str = Form(..., min_length=20),
    resumes: List[UploadFile] = File(...),
):
    """
    Analyze and rank multiple resumes against a job description.
    Accepts multiple PDF or DOCX files (max 50).
    """
    if not resumes:
        raise HTTPException(status_code=400, detail="No resumes uploaded")
    if len(resumes) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 resumes allowed per batch")

    parsed_resumes = await _parse_resumes(resumes)

    if not parsed_resumes:
        raise HTTPException(
            status_code=400,
            detail="No valid resumes could be processed. Please upload PDF or DOCX files.",
        )

    ranked = rank_resumes(parsed_resumes, job_description)

    results = [
        BatchResultItem(
            rank=item["rank"],
            filename=item["filename"],
            score=item["score"],
            matched_skills=item["skill_match"]["matched_skills"],
            missing_skills=item["skill_match"]["missing_skills"],
        )
        for item in ranked
    ]

    return BatchResponse(
        total_resumes=len(results),
        results=results,
        job_description_preview=job_description[:300] + ("..." if len(job_description) > 300 else ""),
    )


@router.post("/batch/export")
async def export_batch_excel(
    job_description: str = Form(..., min_length=20),
    resumes: List[UploadFile] = File(...),
):
    """
    Analyze, rank, and download results as a styled Excel file.
    """
    if not resumes:
        raise HTTPException(status_code=400, detail="No resumes uploaded")
    if len(resumes) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 resumes allowed per batch")

    parsed_resumes = await _parse_resumes(resumes)

    if not parsed_resumes:
        raise HTTPException(
            status_code=400,
            detail="No valid resumes could be processed. Please upload PDF or DOCX files.",
        )

    ranked = rank_resumes(parsed_resumes, job_description)
    excel_bytes = create_excel_report(ranked, job_description)

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=ranked_resumes.xlsx"},
    )