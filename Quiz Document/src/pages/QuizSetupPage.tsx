import { useEffect, useState } from "react";
import { supabase, callEdgeFunction } from "@/lib/supabase";
import { FileText, Loader2, HelpCircle, ArrowRight, CheckCircle } from "lucide-react";
import type { DocumentRecord, QuizRecord } from "@/types";

interface Props {
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export default function QuizSetupPage({ onNavigate }: Props) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [{ data: docs }, { data: quizData }] = await Promise.all([
        supabase.from("documents").select("*").order("created_at", { ascending: false }),
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }),
      ]);
      setDocuments((docs as DocumentRecord[]) ?? []);
      setQuizzes((quizData as QuizRecord[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selected.size === 0) return;
    setError("");
    setGenerating(true);
    try {
      const result = await callEdgeFunction<{ quizId: string }>("generate-quiz", {
        documentIds: Array.from(selected),
      });
      onNavigate("quiz-taking", { quizId: result.quizId });
    } catch (err: any) {
      setError(err.message || "Failed to generate quiz");
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
      <h1 className="text-3xl font-bold text-white mb-2">Quizzes</h1>
      <p className="text-slate-400 mb-8">Select documents to generate a 50-question multiple-choice quiz, or review past quizzes below.</p>

      {documents.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 border border-slate-700/50 rounded-2xl">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Upload documents first to generate quizzes.</p>
          <button onClick={() => onNavigate("documents")} className="mt-4 text-teal-400 hover:text-teal-300 text-sm font-medium">
            Go to Documents
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3">Select Source Documents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => toggleSelect(doc.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                    selected.has(doc.id)
                      ? "border-teal-500 bg-teal-500/10"
                      : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    selected.has(doc.id) ? "border-teal-500 bg-teal-500" : "border-slate-600"
                  }`}>
                    {selected.has(doc.id) && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{doc.filename}</p>
                    <p className="text-xs text-slate-500">{doc.content.length.toLocaleString()} characters</p>
                  </div>
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
            disabled={selected.size === 0 || generating}
            className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mb-8"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating 50 questions with AI...
              </>
            ) : (
              <>
                <HelpCircle className="w-5 h-5" />
                Generate Quiz ({selected.size} document{selected.size !== 1 ? "s" : ""} selected)
              </>
            )}
          </button>
        </>
      )}

      {quizzes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Past Quizzes</h2>
          <div className="space-y-2">
            {quizzes.map((q) => (
              <button
                key={q.id}
                onClick={() => onNavigate(q.score !== null ? "quiz-results" : "quiz-taking", { quizId: q.id })}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{q.title}</p>
                  <p className="text-xs text-slate-500">{q.total_questions} questions - {new Date(q.created_at).toLocaleDateString()}</p>
                </div>
                {q.score !== null ? (
                  <span className="text-sm font-medium text-teal-400">{q.score}/{q.total_questions}</span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-amber-400">
                    Take quiz <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


