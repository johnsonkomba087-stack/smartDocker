# SmartResumeRanker v2

AI-powered Resume Analyzer, Batch Ranker & Admission Filter  
Built with **FastAPI** + **Next.js**

## Features

|Feature|Description|
|---|---|
|**Single Resume Analysis**|Score, matched/missing skills, strengths, improvements, score breakdown|
|**Batch Ranker**|Upload many resumes -> rank from best to worst|
|**Excel Export**|Download styled ranked results (top 3 highlighted)|
|**Admission Filter**|Set min score, required skills, education -> auto filter qualified vs rejected|
|**User Authentication**|Register / Login with JWT|
|**LLM Feedback**|Optional rich AI feedback via Groq or Ollama|
|**Semantic Embeddings**|Optional sentence-transformers for better matching|
|**Multi-language**|English + Swahili UI|

---

## Quick Start

### One Command (Windows PowerShell)

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
```

This starts both backend and frontend (and installs missing dependencies on first run).

### Docker (recommended)

```bash
docker-compose up --build
```

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- API Docs: <http://localhost:8000/docs>

### Deploy to Render

This repo includes a `render.yaml` Blueprint for one-click deployment of:

- `smart-resume-ranker-api` (FastAPI backend)
- `smart-resume-ranker-web` (Next.js frontend)

Steps:

1. Push the latest code to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select this repository and branch.
4. Review services and click **Apply**.

After deploy:

- Frontend URL: `https://smart-resume-ranker-web.onrender.com`
- Backend URL: `https://smart-resume-ranker-api.onrender.com`
- API Docs: `https://smart-resume-ranker-api.onrender.com/docs`

Notes:

- Backend DB defaults to SQLite (`/app/resume_ranker.db`) in container storage. For long-term persistence, use a managed database.
- Set optional env vars in Render for LLM features (`GROQ_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`).

### Local Development

#### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Optional Configuration

Create a `.env` file in `backend/`:

```env
# LLM (optional)
LLM_PROVIDER=groq          # none | groq | ollama
GROQ_API_KEY=your_key_here
LLM_MODEL=llama-3.1-8b-instant

# Or local Ollama
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# LLM_MODEL=llama3.2

# Semantic embeddings (optional – requires sentence-transformers)
USE_EMBEDDINGS=false

# Auth secret (change in production)
SECRET_KEY=your-super-secret-key
```

To enable embeddings:

```bash
pip install sentence-transformers
# then set USE_EMBEDDINGS=true
```

---

## API Endpoints

|Method|Endpoint|Description|
|---|---|---|
|POST|`/api/analyze`|Single resume analysis (+ optional LLM)|
|POST|`/api/batch`|Batch rank|
|POST|`/api/batch/export`|Batch rank + Excel download|
|POST|`/api/admission/filter`|Admission / criteria filter|
|POST|`/api/auth/register`|Create account|
|POST|`/api/auth/login`|Login -> JWT|
|GET|`/api/auth/me`|Current user|
|GET|`/health`|Health check|

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, JWT, scikit-learn, pdfplumber, python-docx, openpyxl
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Axios
- **Optional AI**: Groq / Ollama, sentence-transformers
- **Infra**: Docker Compose

---

## Project Structure

```text
smart-resume-ranker/
├── backend/
│   ├── app/
│   │   ├── core/          # analyzer, parser, ranker, export, auth, llm, embeddings
│   │   ├── models/
│   │   ├── routers/       # analyze, batch, auth, admission
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── lib/               # api.ts, i18n.ts
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```
