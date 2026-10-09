import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, ArrowLeft, Trophy } from "lucide-react";
import type { QuizQuestionRecord, QuizRecord } from "@/types";

interface Props {
  quizId: string;
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export default function QuizResultsPage({ quizId, onNavigate }: Props) {
  const [quiz, setQuiz] = useState<QuizRecord | null>(null);
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: quizData }, { data: qData }] = await Promise.all([
        supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(),
        supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("created_at", { ascending: true }),
      ]);
      setQuiz(quizData as QuizRecord | null);
      setQuestions((qData as QuizQuestionRecord[]) ?? []);
      setLoading(false);
    }
    load();
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const score = quiz?.score ?? 0;
  const total = quiz?.total_questions ?? questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => onNavigate("quizzes")} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
        <ArrowLeft className="w-4 h-4" />
        Back to Quizzes
      </button>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-500/15 border border-teal-500/20 mb-4">
          <Trophy className="w-8 h-8 text-teal-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{score} / {total}</h1>
        <p className="text-lg text-slate-400">{percentage}% Correct</p>
        <div className="w-full bg-slate-900/50 rounded-full h-3 mt-4 max-w-xs mx-auto">
          <div
            className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">Question Review</h2>
      <div className="space-y-3">
        {questions.map((q, idx) => {
          const userAnswer = q.user_answer;
          const isCorrect = userAnswer === q.correct_index;
          return (
            <div
              key={q.id}
              className={`p-5 rounded-xl border ${
                isCorrect ? "border-teal-500/30 bg-teal-500/5" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                {isCorrect ? (
                  <CheckCircle className="w-5 h-5 text-teal-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-white font-medium">{idx + 1}. {q.question_text}</p>
              </div>
              <div className="ml-8 space-y-1.5 text-sm">
                {q.options.map((option, oIdx) => (
                  <div
                    key={oIdx}
                    className={`flex items-center gap-2 ${
                      oIdx === q.correct_index
                        ? "text-teal-400"
                        : oIdx === userAnswer
                        ? "text-red-400"
                        : "text-slate-500"
                    }`}
                  >
                    {oIdx === q.correct_index && <CheckCircle className="w-4 h-4" />}
                    {oIdx === userAnswer && oIdx !== q.correct_index && <XCircle className="w-4 h-4" />}
                    <span>{option}</span>
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="ml-8 mt-3 text-sm text-slate-400 italic border-l-2 border-slate-700 pl-3">
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
