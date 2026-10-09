import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import DocumentsPage from "@/pages/DocumentsPage";
import QuizSetupPage from "@/pages/QuizSetupPage";
import QuizTakingPage from "@/pages/QuizTakingPage";
import QuizResultsPage from "@/pages/QuizResultsPage";
import InterviewSetupPage from "@/pages/InterviewSetupPage";
import InterviewPracticePage from "@/pages/InterviewPracticePage";
import InterviewAnalysisPage from "@/pages/InterviewAnalysisPage";
import { Loader2 } from "lucide-react";

interface RouteState {
  route: string;
  params: Record<string, string>;
}

function parseHash(): RouteState {
  const hash = window.location.hash.slice(1) || "dashboard";
  const [route, queryString] = hash.split("?");
  const params: Record<string, string> = {};
  if (queryString) {
    new URLSearchParams(queryString).forEach((value, key) => {
      params[key] = value;
    });
  }
  return { route: route || "dashboard", params };
}

function navigate(route: string, params?: Record<string, string>) {
  let hash = route;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams(params).toString();
    hash = `${route}?${search}`;
  }
  window.location.hash = hash;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [routeState, setRouteState] = useState<RouteState>(parseHash());

  useEffect(() => {
    const onHashChange = () => setRouteState(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const { route, params } = routeState;

  const renderPage = () => {
    switch (route) {
      case "dashboard":
        return <Dashboard onNavigate={navigate} />;
      case "documents":
        return <DocumentsPage />;
      case "quizzes":
        return <QuizSetupPage onNavigate={navigate} />;
      case "quiz-taking":
        return params.quizId ? (
          <QuizTakingPage quizId={params.quizId} onNavigate={navigate} />
        ) : (
          <QuizSetupPage onNavigate={navigate} />
        );
      case "quiz-results":
        return params.quizId ? (
          <QuizResultsPage quizId={params.quizId} onNavigate={navigate} />
        ) : (
          <QuizSetupPage onNavigate={navigate} />
        );
      case "interviews":
        return <InterviewSetupPage onNavigate={navigate} />;
      case "interview-practice":
        return params.interviewId ? (
          <InterviewPracticePage interviewId={params.interviewId} onNavigate={navigate} />
        ) : (
          <InterviewSetupPage onNavigate={navigate} />
        );
      case "interview-analysis":
        return params.interviewId ? (
          <InterviewAnalysisPage interviewId={params.interviewId} onNavigate={navigate} />
        ) : (
          <InterviewSetupPage onNavigate={navigate} />
        );
      default:
        return <Dashboard onNavigate={navigate} />;
    }
  };

  return (
    <Layout currentRoute={route} onNavigate={navigate}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
