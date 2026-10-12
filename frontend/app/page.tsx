"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  Sparkles,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import {
  AdmissionResponse,
  AnalyzeResult,
  BatchResponse,
  analyzeBatchResumes,
  analyzeSingleResume,
  exportBatchExcel,
  filterAdmission,
  login,
  register,
} from "@/lib/api";
import { Locale, t } from "@/lib/i18n";

type Mode = "single" | "batch" | "admission";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx"];

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
  ) {
    return (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || fallback;
  }
  return fallback;
}

function isAllowedFile(file: File) {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const [mode, setMode] = useState<Mode>("single");
  const [jobDescription, setJobDescription] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeLlm, setIncludeLlm] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [minScore, setMinScore] = useState(50);
  const [requiredSkills, setRequiredSkills] = useState("");
  const [minEducation, setMinEducation] = useState("none");
  const [requireQuantified, setRequireQuantified] = useState(false);

  const [singleResult, setSingleResult] = useState<AnalyzeResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null);
  const [admissionResult, setAdmissionResult] = useState<AdmissionResponse | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authEmail, setAuthEmail] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUsername(localStorage.getItem("username"));
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !loading) {
        event.preventDefault();
        if (mode === "single") {
          void handleSingle();
        } else if (mode === "batch") {
          void handleBatch();
        } else {
          void handleAdmission();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, mode, jobDescription, singleFile, batchFiles, minScore, requiredSkills, minEducation, requireQuantified, includeLlm]);

  const jobWordCount = useMemo(() => {
    const trimmed = jobDescription.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [jobDescription]);

  const uploadedCount = mode === "single" ? (singleFile ? 1 : 0) : batchFiles.length;

  const tr = (key: Parameters<typeof t>[1]) => t(locale, key);

  const resetResults = () => {
    setError(null);
    setSingleResult(null);
    setBatchResult(null);
    setAdmissionResult(null);
  };

  const setUploadedFiles = (files: File[]) => {
    const filtered = files.filter(isAllowedFile);
    const rejected = files.length - filtered.length;

    if (rejected > 0) {
      setError(`Skipped ${rejected} unsupported file(s). Only PDF and DOCX are allowed.`);
    } else {
      setError(null);
    }

    if (mode === "single") {
      setSingleFile(filtered[0] || null);
    } else {
      setBatchFiles(filtered);
    }
  };

  const removeBatchFile = (name: string) => {
    setBatchFiles((current) => current.filter((file) => file.name !== name));
  };

  const handleSingle = async () => {
    if (!jobDescription.trim() || !singleFile) {
      setError("Please provide both a job description and a resume file.");
      return;
    }

    setLoading(true);
    resetResults();
    try {
      const result = await analyzeSingleResume(jobDescription, singleFile, includeLlm);
      setSingleResult(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to analyze resume."));
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    if (!jobDescription.trim() || batchFiles.length === 0) {
      setError("Please provide a job description and at least one resume.");
      return;
    }

    setLoading(true);
    resetResults();
    try {
      const result = await analyzeBatchResumes(jobDescription, batchFiles);
      setBatchResult(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to process batch."));
    } finally {
      setLoading(false);
    }
  };

  const handleAdmission = async () => {
    if (!jobDescription.trim() || batchFiles.length === 0) {
      setError("Please provide a job description and documents.");
      return;
    }

    setLoading(true);
    resetResults();
    try {
      const result = await filterAdmission(
        jobDescription,
        batchFiles,
        minScore,
        requiredSkills,
        minEducation,
        requireQuantified,
      );
      setAdmissionResult(result);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to filter applicants."));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!jobDescription.trim() || batchFiles.length === 0) {
      return;
    }

    setExporting(true);
    try {
      const blob = await exportBatchExcel(jobDescription, batchFiles);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ranked_resumes.xlsx";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export Excel.");
    } finally {
      setExporting(false);
    }
  };

  const handleAuth = async () => {
    try {
      if (authMode === "login") {
        const data = await login(authUser, authPass);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        setUsername(data.username);
      } else {
        await register(authEmail, authUser, authPass);
        const data = await login(authUser, authPass);
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.username);
        setUsername(data.username);
      }
      setShowAuth(false);
    } catch (err) {
      setError(getErrorMessage(err, "Authentication failed"));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-emerald-900 bg-emerald-100 border-emerald-300";
    if (score >= 50) return "text-amber-900 bg-amber-100 border-amber-300";
    return "text-rose-900 bg-rose-100 border-rose-300";
  };

  const getGaugeColor = (score: number) => {
    if (score >= 75) return "#059669";
    if (score >= 50) return "#d97706";
    return "#e11d48";
  };

  const getRankBadgeClasses = (rank: number) => {
    if (rank === 1) {
      return "border-amber-300 bg-gradient-to-br from-yellow-200 via-amber-200 to-yellow-400 text-amber-950 shadow-[0_0_0_2px_rgba(251,191,36,0.25),0_8px_20px_rgba(217,119,6,0.25)]";
    }
    if (rank === 2) {
      return "border-slate-300 bg-gradient-to-br from-slate-200 via-zinc-200 to-slate-400 text-slate-900 shadow-[0_0_0_2px_rgba(148,163,184,0.2),0_8px_18px_rgba(100,116,139,0.22)]";
    }
    if (rank === 3) {
      return "border-orange-300 bg-gradient-to-br from-orange-200 via-amber-200 to-orange-400 text-orange-950 shadow-[0_0_0_2px_rgba(251,146,60,0.22),0_8px_18px_rgba(194,65,12,0.22)]";
    }
    return "border-slate-200 bg-slate-200 text-slate-700";
  };

  const executeCurrentMode = mode === "single" ? handleSingle : mode === "batch" ? handleBatch : handleAdmission;

  return (
    <div className="min-h-screen text-slate-900">
      <div className="bg-decoration" />

      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 via-rose-500 to-amber-400 text-white shadow-lg shadow-rose-300/30">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Hiring Intelligence</p>
              <h1 className="text-lg font-bold md:text-xl">{tr("appName")}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === "en" ? "sw" : "en")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              <Globe className="h-4 w-4" />
              {locale === "en" ? "SW" : "EN"}
            </button>
            {username ? (
              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-300/70 bg-white px-3 py-2">
                <span className="max-w-28 truncate text-sm font-medium text-slate-700">{username}</span>
                <button onClick={handleLogout} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Logout">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <LogIn className="h-4 w-4" />
                {tr("login")}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
        <section className="animate-in rounded-3xl border border-white/50 bg-white/80 p-5 shadow-2xl shadow-orange-100/40 backdrop-blur md:p-7">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                AI-first Candidate Ranking
              </p>
              <h2 className="text-2xl font-bold leading-tight md:text-3xl">Modern evaluator for resumes at scale</h2>
              <p className="mt-1 text-sm text-slate-600">{tr("tagline")}</p>
            </div>
            <p className="text-xs text-slate-500">Shortcut: Ctrl/Cmd + Enter to run current mode</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-orange-200/80 bg-orange-50 p-3">
              <p className="text-xs uppercase tracking-wider text-orange-600">Mode</p>
              <p className="text-lg font-semibold text-orange-900">{mode}</p>
            </div>
            <div className="rounded-2xl border border-sky-200/80 bg-sky-50 p-3">
              <p className="text-xs uppercase tracking-wider text-sky-600">Words in JD</p>
              <p className="text-lg font-semibold text-sky-900">{jobWordCount}</p>
            </div>
            <div className="rounded-2xl border border-violet-200/80 bg-violet-50 p-3">
              <p className="text-xs uppercase tracking-wider text-violet-600">Files loaded</p>
              <p className="text-lg font-semibold text-violet-900">{uploadedCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-wider text-emerald-600">Ready</p>
              <p className="text-lg font-semibold text-emerald-900">
                {jobDescription.trim() && uploadedCount > 0 ? "Yes" : "No"}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(["single", "batch", "admission"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  resetResults();
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                  mode === m
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-300/60"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m === "single" ? tr("single") : m === "batch" ? tr("batch") : tr("admission")}
              </button>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">{tr("jobDescription")}</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder={tr("jobPlaceholder")}
                  className="h-44 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-orange-400 focus:bg-white"
                />
                <p className="mt-2 text-xs text-slate-500">{jobWordCount} words</p>
              </div>

              {mode === "admission" && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <p className="mb-3 text-sm font-semibold text-slate-700">{tr("admission")}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700">{tr("minScore")}: {minScore}</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={minScore}
                        onChange={(e) => setMinScore(Number(e.target.value))}
                        className="mt-1 w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">{tr("requiredSkills")}</label>
                      <input
                        value={requiredSkills}
                        onChange={(e) => setRequiredSkills(e.target.value)}
                        placeholder="python, react, docker"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">{tr("minEducation")}</label>
                      <select
                        value={minEducation}
                        onChange={(e) => setMinEducation(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
                      >
                        <option value="none">None</option>
                        <option value="bachelor">Bachelor</option>
                        <option value="master">Master</option>
                        <option value="phd">PhD</option>
                      </select>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={requireQuantified}
                        onChange={(e) => setRequireQuantified(e.target.checked)}
                      />
                      {tr("requireQuantified")}
                    </label>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  {mode === "single" ? tr("uploadResume") : tr("uploadResumes")}
                </label>

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    setUploadedFiles(Array.from(event.dataTransfer.files || []));
                  }}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
                    dragOver ? "border-orange-500 bg-orange-50" : "border-slate-300 bg-slate-50 hover:border-orange-300"
                  }`}
                >
                  <input
                    id="file-upload"
                    type="file"
                    accept=".pdf,.docx"
                    multiple={mode !== "single"}
                    className="hidden"
                    onChange={(e) => setUploadedFiles(Array.from(e.target.files || []))}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                    <p className="text-sm font-medium text-slate-700">
                      {mode === "single" ? tr("clickUpload") : tr("clickUploadMulti")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Drag and drop is supported</p>
                  </label>
                </div>

                <div className="mt-3 space-y-2">
                  {mode === "single" && singleFile && (
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                      <span className="truncate text-slate-700">{singleFile.name}</span>
                      <button onClick={() => setSingleFile(null)} className="rounded p-1 hover:bg-slate-200" aria-label="Remove file">
                        <X className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                  )}

                  {mode !== "single" && batchFiles.length > 0 && (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{batchFiles.length} files selected</p>
                        <button
                          onClick={() => setBatchFiles([])}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="max-h-36 space-y-2 overflow-auto pr-1">
                        {batchFiles.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="stagger-item flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="truncate text-slate-700">{file.name}</span>
                            <button onClick={() => removeBatchFile(file.name)} className="rounded p-1 hover:bg-slate-200" aria-label="Remove file">
                              <X className="h-4 w-4 text-slate-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {mode === "single" && (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={includeLlm} onChange={(e) => setIncludeLlm(e.target.checked)} />
                  Include LLM-powered detailed feedback
                </label>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={executeCurrentMode}
                  disabled={loading}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {tr("analyzing")}
                    </>
                  ) : mode === "single" ? (
                    tr("analyze")
                  ) : mode === "batch" ? (
                    tr("rankAll")
                  ) : (
                    tr("filterApplicants")
                  )}
                </button>

                {mode === "batch" && (
                  <button
                    onClick={handleExport}
                    disabled={exporting || batchFiles.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                  >
                    {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                    {tr("excel")}
                  </button>
                )}
              </div>

              {error && (
                <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </section>

            <section className="space-y-4">
              {mode === "single" && singleResult && (
                <div className="animate-in rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{tr("analysisResult")}</h3>
                    <div className="flex items-center gap-3">
                      <div
                        className="relative grid h-20 w-20 place-items-center rounded-full"
                        style={{
                          background: `conic-gradient(${getGaugeColor(singleResult.score)} ${singleResult.score * 3.6}deg, #e2e8f0 0deg)`,
                        }}
                        aria-label={`Score gauge ${singleResult.score} out of 100`}
                      >
                        <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white shadow-inner shadow-slate-200">
                          <span className="text-lg font-extrabold text-slate-900">{singleResult.score}</span>
                        </div>
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-sm font-bold ${getScoreColor(singleResult.score)}`}>
                        {singleResult.score}/100
                      </div>
                    </div>
                  </div>

                  <p className="mb-4 text-sm leading-relaxed text-slate-700">{singleResult.summary}</p>

                  {singleResult.score_breakdown && (
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      {[
                        [tr("skills"), singleResult.score_breakdown.skill_match],
                        [tr("semantic"), singleResult.score_breakdown.semantic_similarity],
                        [tr("experience"), singleResult.score_breakdown.experience_quality],
                      ].map(([label, value]) => (
                        <div key={label as string} className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
                          <p className="text-lg font-bold">{value as number}%</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mb-3">
                    <h4 className="mb-1 text-sm font-semibold">{tr("matchedSkills")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {singleResult.skill_match.matched_skills.length > 0 ? (
                        singleResult.skill_match.matched_skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">{tr("noneDetected")}</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-1 text-sm font-semibold">{tr("missingSkills")}</h4>
                    <div className="flex flex-wrap gap-2">
                      {singleResult.skill_match.missing_skills.length > 0 ? (
                        singleResult.skill_match.missing_skills.map((skill) => (
                          <span key={skill} className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-800">
                            {skill}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">{tr("greatCoverage")}</span>
                      )}
                    </div>
                  </div>

                  {singleResult.llm_feedback && (
                    <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <h4 className="mb-1 text-sm font-semibold text-violet-900">AI Feedback</h4>
                      <p className="whitespace-pre-wrap text-sm text-violet-950">{singleResult.llm_feedback}</p>
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <h4 className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        {tr("strengths")}
                      </h4>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {singleResult.strengths.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-amber-800">
                        <AlertCircle className="h-4 w-4" />
                        {tr("improvements")}
                      </h4>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {singleResult.improvements.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {mode === "batch" && batchResult && (
                <div className="animate-in rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-semibold">
                      {tr("rankedResults")} ({batchResult.total_resumes} {tr("resumes")})
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {batchResult.results.map((item) => (
                      <div key={item.filename} className="stagger-item flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div
                          className={`grid h-10 w-10 place-items-center rounded-full border text-xs font-extrabold ${getRankBadgeClasses(item.rank)}`}
                        >
                          #{item.rank}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-800">{item.filename}</p>
                          <p className="truncate text-xs text-slate-500">{item.matched_skills.slice(0, 4).join(", ") || "No matched skills"}</p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-sm font-bold ${getScoreColor(item.score)}`}>
                          {item.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mode === "admission" && admissionResult && (
                <div className="animate-in space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-lime-100 p-5 text-center shadow-lg shadow-emerald-200/50 md:p-6">
                      <p className="text-4xl font-extrabold text-emerald-900 md:text-5xl">{admissionResult.qualified_count}</p>
                      <p className="text-sm font-semibold uppercase tracking-wider text-emerald-800">{tr("qualified")}</p>
                    </div>
                    <div className="rounded-2xl border-2 border-rose-400 bg-gradient-to-br from-rose-50 to-orange-100 p-5 text-center shadow-lg shadow-rose-200/50 md:p-6">
                      <p className="text-4xl font-extrabold text-rose-900 md:text-5xl">{admissionResult.rejected_count}</p>
                      <p className="text-sm font-semibold uppercase tracking-wider text-rose-800">{tr("rejected")}</p>
                    </div>
                  </div>

                  {admissionResult.qualified.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        {tr("qualified")}
                      </h3>
                      <div className="space-y-2">
                        {admissionResult.qualified.map((item) => (
                          <div key={item.filename} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{item.filename}</p>
                              <p className="truncate text-xs text-slate-500">{item.reasons.join("; ")}</p>
                            </div>
                            <span className={`ml-2 rounded-full border px-2 py-0.5 text-sm font-bold ${getScoreColor(item.score)}`}>
                              {item.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {admissionResult.rejected.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-rose-800">
                        <AlertCircle className="h-4 w-4" />
                        {tr("rejected")}
                      </h3>
                      <div className="space-y-2">
                        {admissionResult.rejected.map((item) => (
                          <div key={item.filename} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{item.filename}</p>
                              <p className="truncate text-xs text-slate-500">{item.reasons.join("; ")}</p>
                            </div>
                            <span className={`ml-2 rounded-full border px-2 py-0.5 text-sm font-bold ${getScoreColor(item.score)}`}>
                              {item.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!singleResult && !batchResult && !admissionResult && !loading && (
                <div className="animate-in rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <h3 className="text-base font-semibold text-slate-700">{tr("noResults")}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {mode === "single" ? tr("noResultsSingle") : tr("noResultsBatch")}
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>

      {showAuth && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/30 bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-xl font-bold">
              {authMode === "login" ? tr("login") : tr("register")}
            </h2>

            <div className="space-y-3">
              {authMode === "register" && (
                <input
                  type="email"
                  placeholder={tr("email")}
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
                />
              )}

              <input
                type="text"
                placeholder={tr("username")}
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
              />

              <input
                type="password"
                placeholder={tr("password")}
                value={authPass}
                onChange={(e) => setAuthPass(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-400"
              />

              <button
                onClick={handleAuth}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {authMode === "login" ? tr("login") : tr("register")}
              </button>

              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="w-full text-sm font-medium text-orange-700 hover:text-orange-800"
              >
                {authMode === "login" ? tr("register") : tr("login")}
              </button>

              <button onClick={() => setShowAuth(false)} className="w-full text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
