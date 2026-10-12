import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach token if present
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export interface AnalyzeResult {
  filename: string;
  score: number;
  skill_match: {
    matched_skills: string[];
    missing_skills: string[];
    match_percentage: number;
  };
  strengths: string[];
  improvements: string[];
  summary: string;
  score_breakdown?: {
    skill_match: number;
    semantic_similarity: number;
    experience_quality: number;
  };
  llm_feedback?: string | null;
}

export interface BatchResultItem {
  rank: number;
  filename: string;
  score: number;
  matched_skills: string[];
  missing_skills: string[];
}

export interface BatchResponse {
  total_resumes: number;
  results: BatchResultItem[];
  job_description_preview: string;
}

export interface AdmissionResultItem {
  filename: string;
  score: number;
  status: "qualified" | "rejected";
  reasons: string[];
  matched_skills: string[];
  missing_required_skills: string[];
}

export interface AdmissionResponse {
  total: number;
  qualified_count: number;
  rejected_count: number;
  qualified: AdmissionResultItem[];
  rejected: AdmissionResultItem[];
}

export async function analyzeSingleResume(
  jobDescription: string,
  resumeFile: File,
  includeLlm = false
): Promise<AnalyzeResult> {
  const formData = new FormData();
  formData.append("job_description", jobDescription);
  formData.append("resume", resumeFile);
  formData.append("include_llm_feedback", String(includeLlm));

  const response = await api.post<AnalyzeResult>("/api/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function analyzeBatchResumes(
  jobDescription: string,
  resumeFiles: File[]
): Promise<BatchResponse> {
  const formData = new FormData();
  formData.append("job_description", jobDescription);
  resumeFiles.forEach((file) => formData.append("resumes", file));

  const response = await api.post<BatchResponse>("/api/batch", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function exportBatchExcel(
  jobDescription: string,
  resumeFiles: File[]
): Promise<Blob> {
  const formData = new FormData();
  formData.append("job_description", jobDescription);
  resumeFiles.forEach((file) => formData.append("resumes", file));

  const response = await api.post("/api/batch/export", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    responseType: "blob",
  });
  return response.data;
}

export async function filterAdmission(
  jobDescription: string,
  resumeFiles: File[],
  minScore: number,
  requiredSkills: string,
  minEducation: string,
  requireQuantified: boolean
): Promise<AdmissionResponse> {
  const formData = new FormData();
  formData.append("job_description", jobDescription);
  formData.append("min_score", String(minScore));
  formData.append("required_skills", requiredSkills);
  formData.append("min_education", minEducation);
  formData.append("require_quantified", String(requireQuantified));
  resumeFiles.forEach((file) => formData.append("resumes", file));

  const response = await api.post<AdmissionResponse>("/api/admission/filter", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);
  const res = await api.post("/api/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return res.data;
}

export async function register(email: string, username: string, password: string) {
  const res = await api.post("/api/auth/register", { email, username, password });
  return res.data;
}
