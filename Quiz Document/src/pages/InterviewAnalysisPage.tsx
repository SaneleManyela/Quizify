import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Loader2, Briefcase, Building2, Calendar } from "lucide-react";
import type { InterviewRecord, InterviewQuestionRecord } from "@/types";

interface Props {
  interviewId: string;
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export default function InterviewAnalysisPage({ interviewId, onNavigate }: Props) {
  const [interview, setInterview] = useState<InterviewRecord | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: ivData }, { data: qData }] = await Promise.all([
        supabase.from("interviews").select("*").eq("id", interviewId).maybeSingle(),
        supabase
          .from("interview_questions")
          .select("*")
          .eq("interview_id", interviewId)
          .order("order_index", { ascending: true }),
      ]);
      setInterview(ivData as InterviewRecord | null);
      setQuestions((qData as InterviewQuestionRecord[]) ?? []);
      setLoading(false);
    }
    load();
  }, [interviewId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 mb-4">Interview not found.</p>
        <button onClick={() => onNavigate("interviews")} className="text-teal-400 hover:text-teal-300 text-sm font-medium">
          Back to Interviews
        </button>
      </div>
    );
  }

  const analysisSections = (interview.analysis || "")
    .split(/\n(?=\d+\.|\*\*[A-Z]|#{1,3}\s)/)
    .filter((s) => s.trim());

  return (
    <div className="max-w-4xl mx-auto">
      <button onClick={() => onNavigate("interviews")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Interviews
      </button>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-white mb-4">Interview Analysis</h1>
        <div className="flex flex-wrap gap-4 text-sm text-slate-400">
          {interview.position && (
            <span className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-slate-500" />
              {interview.position}
            </span>
          )}
          {interview.company && (
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              {interview.company}
            </span>
          )}
          <span className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            {new Date(interview.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {interview.analysis ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 mb-6">
          <div className="prose prose-invert max-w-none">
            {analysisSections.map((section, idx) => (
              <div key={idx} className="mb-6 last:mb-0">
                {section.split("\n").map((line, lineIdx) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (lineIdx === 0 && /^\d+\.\s|^\*\*|^#{1,3}\s/.test(trimmed)) {
                    const cleanTitle = trimmed.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "").replace(/^#{1,3}\s*/, "");
                    return (
                      <h2 key={lineIdx} className="text-lg font-semibold text-teal-400 mb-3 mt-6 first:mt-0">
                        {cleanTitle}
                      </h2>
                    );
                  }
                  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                    return (
                      <p key={lineIdx} className="text-slate-300 text-sm leading-relaxed ml-4 mb-1">
                        {trimmed.replace(/^[-*]\s*/, "")}
                      </p>
                    );
                  }
                  return (
                    <p key={lineIdx} className="text-slate-300 text-sm leading-relaxed mb-2">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Analysis is still being generated...</p>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Answers</h2>
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <div key={q.id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-300 text-xs font-bold">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium text-white">{q.question_text}</p>
              </div>
              <div className="ml-10">
                {q.transcript ? (
                  <p className="text-sm text-slate-400 leading-relaxed">{q.transcript}</p>
                ) : q.answer_text ? (
                  <div className="text-sm text-slate-400 leading-relaxed [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: q.answer_text }} />
                ) : (
                  <p className="text-sm text-slate-600 italic">No answer provided</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
