import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import type { QuizQuestionRecord } from "@/types";

interface Props {
  quizId: string;
  onNavigate: (route: string, params?: Record<string, string>) => void;
}

export default function QuizTakingPage({ quizId, onNavigate }: Props) {
  const [questions, setQuestions] = useState<QuizQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true });
      if (error) {
        setLoading(false);
        return;
      }
      const qs = (data as QuizQuestionRecord[]) ?? [];
      if (qs.length === 0) {
        setLoading(false);
        return;
      }
      const existing: Record<string, number> = {};
      qs.forEach((q) => {
        if (q.user_answer !== null) existing[q.id] = q.user_answer;
      });
      setQuestions(qs);
      setAnswers(existing);
      setLoading(false);
    }
    load();
  }, [quizId]);

  const handleAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    let correctCount = 0;

    for (const q of questions) {
      const userAnswer = answers[q.id] ?? null;
      if (userAnswer === q.correct_index) correctCount++;
      await supabase
        .from("quiz_questions")
        .update({ user_answer: userAnswer })
        .eq("id", q.id);
    }

    await supabase
      .from("quizzes")
      .update({ score: correctCount, status: "completed" })
      .eq("id", quizId);

    onNavigate("quiz-results", { quizId });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 mb-4">No questions found for this quiz.</p>
        <button onClick={() => onNavigate("quizzes")} className="text-teal-400 hover:text-teal-300 text-sm font-medium">
          Back to Quizzes
        </button>
      </div>
    );
  }

  const q = questions[currentIdx];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIdx === questions.length - 1;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => onNavigate("quizzes")} className="text-slate-400 hover:text-white text-sm">
          Exit Quiz
        </button>
        <span className="text-sm text-slate-400">
          {answeredCount} / {questions.length} answered
        </span>
      </div>

      <div className="w-full bg-slate-800 rounded-full h-2 mb-8">
        <div
          className="bg-teal-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 mb-6">
        <div className="flex items-start gap-3 mb-6">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center text-teal-400 text-sm font-bold">
            {currentIdx + 1}
          </span>
          <p className="text-lg text-white leading-relaxed pt-0.5">{q.question_text}</p>
        </div>

        <div className="space-y-3">
          {q.options.map((option, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                answers[q.id] === idx
                  ? "border-teal-500 bg-teal-500/10"
                  : "border-slate-700 bg-slate-900/30 hover:border-slate-600"
              }`}
            >
              <input
                type="radio"
                name={`question-${q.id}`}
                checked={answers[q.id] === idx}
                onChange={() => handleAnswer(q.id, idx)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                answers[q.id] === idx ? "border-teal-500 bg-teal-500" : "border-slate-600"
              }`}>
                {answers[q.id] === idx && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-slate-200">{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all"
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
