import { useEffect, useState } from "react";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { Loader2, Mic, ArrowRight, Briefcase, Building2 } from "lucide-react";
import type { DocumentRecord, InterviewRecord } from "@/types";

interface Props {
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export default function InterviewSetupPage({ onNavigate }: Props) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [position, setPosition] = useState("");
  const [company, setCompany] = useState("");
  const [prompt, setPrompt] = useState("");
  const [jobSpecText, setJobSpecText] = useState("");
  const [jobSpecDocId, setJobSpecDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: docs }, { data: ivData }] = await Promise.all([
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("interviews").select("*").order("created_at", { ascending: false }),
      ]);
      setDocuments((docs as DocumentRecord[]) ?? []);
      setInterviews((ivData as InterviewRecord[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please describe what the interview should cover.");
      return;
    }
    setError("");
    setGenerating(true);
    try {
      const result = await callEdgeFunction<{ interviewId: string }>("generate-interview-questions", {
        position,
        company,
        prompt,
        jobSpec: jobSpecText || undefined,
        jobSpecDocumentId: jobSpecDocId || undefined,
      });
      onNavigate("interview-practice", { interviewId: result.interviewId });
    } catch (err: any) {
      setError(err.message || "Failed to generate interview questions");
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Interview Practice</h1>
      <p className="text-slate-400 mb-8">Set up a mock interview. AI will generate 10 open-ended questions based on your inputs.</p>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Position</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                placeholder="e.g. Senior Software Engineer"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Company</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                placeholder="e.g. Google"
              />
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Interview Focus</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none"
            placeholder="Describe what the interview should cover. E.g. 'Technical interview focusing on system design, React, and behavioral questions about leadership.'"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Job Specification (optional)</label>
          <textarea
            value={jobSpecText}
            onChange={(e) => setJobSpecText(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all resize-none mb-3"
            placeholder="Paste the job description or vacancy advertisement here..."
          />
          <p className="text-xs text-slate-500 mb-2">Or attach a previously uploaded document:</p>
          <div className="flex flex-wrap gap-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  if (jobSpecDocId === doc.id) {
                    setJobSpecDocId(null);
                  } else {
                    setJobSpecDocId(doc.id);
                    setJobSpecText("");
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  jobSpecDocId === doc.id
                    ? "border-teal-500 bg-teal-500/10 text-teal-400"
                    : "border-slate-700 bg-slate-900/30 text-slate-400 hover:border-slate-600"
                }`}
              >
                {doc.filename}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating interview questions...
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              Start Interview
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {interviews.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Past Interviews</h2>
          <div className="space-y-2">
            {interviews.map((iv) => (
              <button
                key={iv.id}
                onClick={() => onNavigate(iv.status === "analyzed" ? "interview-analysis" : "interview-practice", { interviewId: iv.id })}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {iv.position || "General"} {iv.company && `at ${iv.company}`}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(iv.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  iv.status === "analyzed" ? "bg-teal-500/15 text-teal-400" :
                  iv.status === "active" ? "bg-amber-500/15 text-amber-400" :
                  "bg-slate-500/15 text-slate-400"
                }`}>
                  {iv.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
