import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { FileText, HelpCircle, Mic, TrendingUp, ArrowRight } from "lucide-react";
import type { DocumentRecord, QuizRecord, InterviewRecord } from "@/types";

interface Props {
  onNavigate: (route: string) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const { user } = useAuth();
  const [docCount, setDocCount] = useState(0);
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([]);
  const [interviews, setInterviews] = useState<InterviewRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ count: dCount }, { data: quizData }, { data: ivData }] = await Promise.all([
        supabase.from("documents").select("*", { count: "exact", head: true }),
        supabase.from("quizzes").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("interviews").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setDocCount(dCount ?? 0);
      setQuizzes((quizData as QuizRecord[]) ?? []);
      setInterviews((ivData as InterviewRecord[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: "Documents", value: docCount, icon: <FileText className="w-6 h-6" />, color: "teal", route: "documents" },
    { label: "Quizzes Taken", value: quizzes.length, icon: <HelpCircle className="w-6 h-6" />, color: "blue", route: "quizzes" },
    { label: "Interviews", value: interviews.length, icon: <Mic className="w-6 h-6" />, color: "amber", route: "interviews" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
      <p className="text-slate-400 mb-8">Here's your interview prep overview.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <button
            key={stat.label}
            onClick={() => onNavigate(stat.route)}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-left hover:border-teal-500/30 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-${stat.color}-500/15 border border-${stat.color}-500/20 flex items-center justify-center text-${stat.color}-400`}>
                {stat.icon}
              </div>
              <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-teal-400 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Quizzes</h2>
            <button onClick={() => onNavigate("quizzes")} className="text-sm text-teal-400 hover:text-teal-300">
              View all
            </button>
          </div>
          {quizzes.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">No quizzes yet. Upload documents and generate one!</p>
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <div key={q.id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{q.title}</p>
                    <p className="text-xs text-slate-500">{q.total_questions} questions</p>
                  </div>
                  {q.score !== null ? (
                    <span className="flex items-center gap-1 text-sm font-medium text-teal-400">
                      <TrendingUp className="w-4 h-4" />
                      {q.score}/{q.total_questions}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 capitalize">{q.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Interviews</h2>
            <button onClick={() => onNavigate("interviews")} className="text-sm text-teal-400 hover:text-teal-300">
              View all
            </button>
          </div>
          {interviews.length === 0 ? (
            <p className="text-slate-500 text-sm py-8 text-center">No interviews yet. Set one up!</p>
          ) : (
            <div className="space-y-2">
              {interviews.map((iv) => (
                <div key={iv.id} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-xl">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">{iv.position || "General"} at {iv.company || "N/A"}</p>
                    <p className="text-xs text-slate-500">{new Date(iv.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    iv.status === "analyzed" ? "bg-teal-500/15 text-teal-400" :
                    iv.status === "active" ? "bg-amber-500/15 text-amber-400" :
                    "bg-slate-500/15 text-slate-400"
                  }`}>
                    {iv.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
