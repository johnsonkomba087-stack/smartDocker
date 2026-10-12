from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from ..core.parser import extract_text
from ..core.analyzer import analyze_resume
from ..core.llm import generate_llm_feedback
from ..models.schemas import AnalyzeResponse

router = APIRouter(prefix="/api", tags=["Single Analysis"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_single_resume(
    job_description: str = Form(..., min_length=20),
    resume: UploadFile = File(...),
    include_llm_feedback: bool = Form(False),
):
    """
    Analyze a single resume against a job description.
    Optionally include LLM-powered detailed feedback.
    Accepts PDF or DOCX.
    """
    if not resume.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    filename = resume.filename.lower()
    if not (filename.endswith(".pdf") or filename.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Only PDF and DOCX are allowed.",
        )

    try:
        file_bytes = await resume.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        resume_text = extract_text(resume.filename, file_bytes)

        if len(resume_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract enough text from the resume. Please check the file.",
            )

        result = analyze_resume(resume_text, job_description, resume.filename)

        # Optional LLM feedback
        if include_llm_feedback:
            llm_text = await generate_llm_feedback(
                resume_text=resume_text,
                job_description=job_description,
                score=result["score"],
                matched_skills=result["skill_match"]["matched_skills"],
                missing_skills=result["skill_match"]["missing_skills"],
            )
            result["llm_feedback"] = llm_text

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing resume: {str(e)}")
