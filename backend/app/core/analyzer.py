from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
from typing import List, Dict, Set
from collections import defaultdict


# Expanded skills taxonomy with aliases
SKILL_TAXONOMY = {
    # Programming Languages
    "python": ["python", "python3", "py"],
    "java": ["java", "jdk", "jre"],
    "javascript": ["javascript", "js", "ecmascript"],
    "typescript": ["typescript", "ts"],
    "c++": ["c++", "cpp", "cplusplus"],
    "c#": ["c#", "csharp", "c sharp"],
    "go": ["go", "golang"],
    "rust": ["rust"],
    "php": ["php"],
    "ruby": ["ruby", "rb"],
    "swift": ["swift"],
    "kotlin": ["kotlin"],
    "scala": ["scala"],
    "r": ["r language", "r programming"],
    # Web & Frontend
    "react": ["react", "reactjs", "react.js"],
    "next.js": ["next.js", "nextjs", "next"],
    "angular": ["angular", "angularjs"],
    "vue": ["vue", "vuejs", "vue.js"],
    "html": ["html", "html5"],
    "css": ["css", "css3"],
    "tailwind": ["tailwind", "tailwindcss", "tailwind css"],
    "bootstrap": ["bootstrap"],
    "sass": ["sass", "scss"],
    "jquery": ["jquery"],
    # Backend & Frameworks
    "node.js": ["node.js", "nodejs", "node"],
    "django": ["django"],
    "flask": ["flask"],
    "fastapi": ["fastapi", "fast api"],
    "spring": ["spring", "spring boot", "springboot"],
    "express": ["express", "expressjs", "express.js"],
    "laravel": ["laravel"],
    "rails": ["rails", "ruby on rails"],
    "nestjs": ["nestjs", "nest.js"],
    # Databases
    "sql": ["sql"],
    "mysql": ["mysql"],
    "postgresql": ["postgresql", "postgres", "psql"],
    "mongodb": ["mongodb", "mongo"],
    "redis": ["redis"],
    "sqlite": ["sqlite"],
    "oracle": ["oracle", "oracle db"],
    "dynamodb": ["dynamodb", "dynamo db"],
    "elasticsearch": ["elasticsearch", "elastic search"],
    "cassandra": ["cassandra"],
    # Cloud & DevOps
    "aws": ["aws", "amazon web services", "ec2", "s3", "lambda"],
    "azure": ["azure", "microsoft azure"],
    "gcp": ["gcp", "google cloud", "google cloud platform"],
    "docker": ["docker", "dockerfile", "containerization"],
    "kubernetes": ["kubernetes", "k8s"],
    "jenkins": ["jenkins"],
    "ci/cd": ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
    "terraform": ["terraform"],
    "ansible": ["ansible"],
    "github actions": ["github actions", "gh actions"],
    "gitlab ci": ["gitlab ci", "gitlab-ci"],
    # Data & AI
    "machine learning": ["machine learning", "ml", "machinelearning"],
    "deep learning": ["deep learning", "dl", "deeplearning"],
    "tensorflow": ["tensorflow", "tf"],
    "pytorch": ["pytorch", "torch"],
    "pandas": ["pandas"],
    "numpy": ["numpy"],
    "scikit-learn": ["scikit-learn", "sklearn", "scikit learn"],
    "data analysis": ["data analysis", "data analytics"],
    "data science": ["data science", "datascience"],
    "nlp": ["nlp", "natural language processing"],
    "computer vision": ["computer vision", "cv", "opencv"],
    "llm": ["llm", "large language model", "large language models"],
    "langchain": ["langchain"],
    "huggingface": ["huggingface", "hugging face", "transformers"],
    "spark": ["spark", "apache spark", "pyspark"],
    # Tools & Others
    "git": ["git"],
    "github": ["github"],
    "gitlab": ["gitlab"],
    "jira": ["jira"],
    "agile": ["agile"],
    "scrum": ["scrum"],
    "rest api": ["rest api", "restful", "rest apis", "restful api"],
    "graphql": ["graphql"],
    "microservices": ["microservices", "micro services"],
    "linux": ["linux", "unix"],
    "bash": ["bash", "shell scripting", "shell script"],
    "selenium": ["selenium"],
    "pytest": ["pytest"],
    "unit testing": ["unit testing", "unit test", "unit tests"],
    "postman": ["postman"],
    "figma": ["figma"],
    "kafka": ["kafka", "apache kafka"],
    "rabbitmq": ["rabbitmq"],
    # Soft Skills
    "leadership": ["leadership", "team lead", "tech lead"],
    "communication": ["communication", "verbal communication", "written communication"],
    "teamwork": ["teamwork", "team player", "collaboration"],
    "problem solving": ["problem solving", "problem-solving", "analytical"],
    "project management": ["project management", "project manager", "pmp"],
    "critical thinking": ["critical thinking"],
    "collaboration": ["collaboration", "cross-functional"],
}


def clean_text(text: str) -> str:
    """Normalize text for matching."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s\+\#\.\-/]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_skills(text: str) -> List[str]:
    """
    Extract skills using taxonomy with alias support.
    Returns canonical skill names.
    """
    cleaned = clean_text(text)
    found: Set[str] = set()

    for canonical, aliases in SKILL_TAXONOMY.items():
        for alias in aliases:
            # Use word boundary for short aliases, flexible for multi-word
            if " " in alias or len(alias) > 4:
                pattern = re.escape(alias)
            else:
                pattern = r"\b" + re.escape(alias) + r"\b"
            if re.search(pattern, cleaned):
                found.add(canonical)
                break

    return sorted(list(found))


def calculate_similarity(resume_text: str, job_description: str) -> float:
    """
    Semantic similarity (0-1).
    Prefers sentence-transformers embeddings when enabled,
    otherwise falls back to TF-IDF cosine similarity.
    """
    if not resume_text.strip() or not job_description.strip():
        return 0.0

    # Try embeddings first
    try:
        from .embeddings import semantic_similarity
        emb_sim = semantic_similarity(resume_text, job_description)
        if emb_sim is not None:
            return emb_sim
    except Exception:
        pass

    # Fallback: TF-IDF
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=8000,
        sublinear_tf=True,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform([job_description, resume_text])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        return float(similarity)
    except Exception:
        return 0.0


def extract_experience_signals(text: str) -> Dict[str, float]:
    """Heuristic signals for experience level and quality."""
    cleaned = clean_text(text)
    signals = {
        "years_mentioned": 0.0,
        "has_quantified_achievements": 0.0,
        "has_leadership": 0.0,
        "education_level": 0.0,
    }

    # Years of experience
    years = re.findall(r"(\d+)\+?\s*(?:years?|yrs?)", cleaned)
    if years:
        max_years = max(int(y) for y in years)
        signals["years_mentioned"] = min(max_years / 10.0, 1.0)  # cap at 10 years → 1.0

    # Quantified achievements (numbers + % or metrics)
    if re.search(r"\d+%|\d+x|increased|reduced|improved|grew|saved|\$\d+", cleaned):
        signals["has_quantified_achievements"] = 1.0

    # Leadership signals
    if re.search(r"\b(led|managed|mentored|supervised|team lead|tech lead|head of)\b", cleaned):
        signals["has_leadership"] = 1.0

    # Education
    if re.search(r"\b(phd|doctorate|ph\.d)\b", cleaned):
        signals["education_level"] = 1.0
    elif re.search(r"\b(master|msc|m\.sc|mba|m\.eng)\b", cleaned):
        signals["education_level"] = 0.75
    elif re.search(r"\b(bachelor|bsc|b\.sc|b\.eng|b\.tech|undergraduate)\b", cleaned):
        signals["education_level"] = 0.5

    return signals


def analyze_resume(resume_text: str, job_description: str, filename: str = "resume") -> Dict:
    """
    Improved multi-signal analysis of a resume against a job description.
    Score breakdown:
      - 45% Skill match
      - 35% TF-IDF semantic similarity
      - 20% Experience / quality signals
    """
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(job_description)

    matched = sorted(list(set(resume_skills) & set(jd_skills)))
    missing = sorted(list(set(jd_skills) - set(resume_skills)))

    # Skill match percentage
    skill_match_pct = (len(matched) / len(jd_skills) * 100) if jd_skills else 50.0

    # TF-IDF similarity
    similarity = calculate_similarity(resume_text, job_description)

    # Experience / quality signals
    signals = extract_experience_signals(resume_text)
    experience_score = (
        signals["years_mentioned"] * 0.35
        + signals["has_quantified_achievements"] * 0.30
        + signals["has_leadership"] * 0.20
        + signals["education_level"] * 0.15
    ) * 100

    # Final weighted score
    final_score = (
        skill_match_pct * 0.45
        + similarity * 100 * 0.35
        + experience_score * 0.20
    )
    final_score = round(min(max(final_score, 0), 100), 1)

    # Strengths & improvements
    strengths = []
    improvements = []

    if matched:
        strengths.append(f"Strong match on key skills: {', '.join(matched[:8])}")
    if skill_match_pct >= 70:
        strengths.append("Excellent skill alignment with the job requirements")
    elif skill_match_pct >= 45:
        strengths.append("Solid coverage of core required skills")
    if signals["has_quantified_achievements"]:
        strengths.append("Contains quantified achievements (metrics, percentages, impact)")
    if signals["has_leadership"]:
        strengths.append("Shows leadership or management experience")
    if signals["years_mentioned"] >= 0.5:
        strengths.append("Demonstrates relevant years of experience")

    if missing:
        improvements.append(f"Missing or not clearly mentioned: {', '.join(missing[:8])}")
    if skill_match_pct < 50:
        improvements.append("Skill match is below average — tailor the resume keywords to the job description")
    if similarity < 0.22:
        improvements.append("Language and terminology differ from the job description — mirror key phrases")
    if not signals["has_quantified_achievements"]:
        improvements.append("Add quantified achievements (e.g. 'increased revenue by 30%', 'reduced latency by 50ms')")
    if signals["years_mentioned"] < 0.2 and "senior" in clean_text(job_description):
        improvements.append("Job appears to require senior experience — highlight total years and impact")

    if not strengths:
        strengths.append("Resume processed successfully")
    if not improvements:
        improvements.append("Strong overall alignment — minor keyword tuning may still help ATS systems")

    summary = (
        f"Scored {final_score}/100. "
        f"Matched {len(matched)}/{len(jd_skills) or 0} key skills "
        f"({round(skill_match_pct, 1)}% skill match). "
        f"Semantic similarity: {round(similarity * 100, 1)}%."
    )

    return {
        "filename": filename,
        "score": final_score,
        "skill_match": {
            "matched_skills": matched,
            "missing_skills": missing,
            "match_percentage": round(skill_match_pct, 1),
        },
        "strengths": strengths,
        "improvements": improvements,
        "summary": summary,
        "score_breakdown": {
            "skill_match": round(skill_match_pct, 1),
            "semantic_similarity": round(similarity * 100, 1),
            "experience_quality": round(experience_score, 1),
        },
    }