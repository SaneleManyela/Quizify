import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { BookOpen, FileText, LayoutDashboard, Mic, HelpCircle, LogOut } from "lucide-react";

interface NavItem {
  label: string;
  icon: ReactNode;
  route: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" />, route: "dashboard" },
  { label: "Documents", icon: <FileText className="w-5 h-5" />, route: "documents" },
  { label: "Quizzes", icon: <HelpCircle className="w-5 h-5" />, route: "quizzes" },
  { label: "Interviews", icon: <Mic className="w-5 h-5" />, route: "interviews" },
];

interface LayoutProps {
  children: ReactNode;
  currentRoute: string;
  onNavigate: (route: string) => void;
}

export default function Layout({ children, currentRoute, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col fixed h-screen">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-teal-400" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Interview Prep</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                currentRoute === item.route || currentRoute.startsWith(item.route)
                  ? "bg-teal-500/15 text-teal-400 border border-teal-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="px-4 py-2 mb-2">
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8 max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
