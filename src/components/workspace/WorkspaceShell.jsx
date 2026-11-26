import { useEffect, useState } from "react";
import { Award, BarChart3, Calculator, CalendarClock, Compass, FolderKanban, LayoutDashboard, Loader2, Lock, PenTool, Sparkles } from "lucide-react";
import { apiFetch } from "./api.js";
import DashboardView from "./DashboardView.jsx";
import MatchingAndCompareView from "./MatchingAndCompareView.jsx";
import ScholarshipsView from "./ScholarshipsView.jsx";
import ApplicationsView from "./ApplicationsView.jsx";
import DeadlinesView from "./DeadlinesView.jsx";
import CostCalculatorView from "./CostCalculatorView.jsx";
import EssayCoachView from "./EssayCoachView.jsx";
import StrategyAnalyticsView from "./StrategyAnalyticsView.jsx";

export default function WorkspaceShell({ lang, user, activeTab, onTabChange, onRequireAuth, onStartCheckout, onBackToSite }) {
  const isEn = lang === "en";
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tabs = [
    { id: "dashboard", label: isEn ? "Dashboard" : "Дашборд", icon: LayoutDashboard },
    { id: "match", label: isEn ? "Match & Compare" : "Подбор и сравнение", icon: Sparkles },
    { id: "scholarships", label: isEn ? "Scholarships" : "Стипендии", icon: Award },
    { id: "applications", label: isEn ? "Applications & Docs" : "Заявки и документы", icon: FolderKanban },
    { id: "deadlines", label: isEn ? "Deadlines" : "Дедлайны", icon: CalendarClock },
    { id: "costs", label: isEn ? "Cost Calculator" : "Калькулятор", icon: Calculator },
    { id: "essays", label: isEn ? "Essay Coach" : "Эссе-коуч", icon: PenTool },
    { id: "strategy", label: isEn ? "Strategy & Analytics" : "Стратегия", icon: BarChart3 },
  ];

  async function refreshDashboard() {
    if (!user?.isPremium) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(`/api/workspace/dashboard?lang=${lang}`);
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshDashboard();
  }, [user?.isPremium, lang]);

  if (!user?.isPremium) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Compass className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-3xl font-extrabold">{isEn ? "Upgrade to UniMatch Pro" : "Перейди на UniMatch Pro"}</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {isEn
            ? "Unlock the full SaaS workspace: Personal Dashboard, Unlimited Verified Matching, 2–5 University Comparison, Scholarship Matcher, Application Planner, Smart Deadlines, Cost Calculator, AI Essay Coach & Strategy."
            : "Открой полный набор инструментов: личный дашборд, безлимитный подбор, сравнение 2–5 вузов, стипендии, планировщик заявок, умные дедлайны, калькулятор бюджета, AI-коуч эссе и стратегию."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={onStartCheckout} className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground">
            {isEn ? "Upgrade to Pro ($12/month)" : "Подключить Pro ($12/мес)"}
          </button>
          <button onClick={onBackToSite} className="rounded-full border border-border px-6 py-3 text-sm font-semibold">
            {isEn ? "Back to Free Explorer" : "Вернуться на главную"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-24 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                  active ? "bg-brand text-brand-foreground" : "border border-border bg-card hover:bg-secondary"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>
        <button onClick={onBackToSite} className="text-xs font-semibold text-muted-foreground hover:text-brand">
          {isEn ? "← Public landing" : "← На лендинг"}
        </button>
      </div>

      {error && <p className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {loading && !dashboard ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isEn ? "Loading workspace..." : "Загрузка кабинета..."}
        </div>
      ) : (
        <>
          {activeTab === "dashboard" && <DashboardView lang={lang} data={dashboard} onNavigate={onTabChange} />}
          {activeTab === "match" && (
            <MatchingAndCompareView lang={lang} user={user} initialCatalog={dashboard?.catalog || []} onRefresh={refreshDashboard} />
          )}
          {activeTab === "scholarships" && <ScholarshipsView lang={lang} onRefresh={refreshDashboard} />}
          {activeTab === "applications" && (
            <ApplicationsView lang={lang} catalog={dashboard?.catalog || []} onRefresh={refreshDashboard} />
          )}
          {activeTab === "deadlines" && <DeadlinesView lang={lang} onRefresh={refreshDashboard} />}
          {activeTab === "costs" && <CostCalculatorView lang={lang} catalog={dashboard?.catalog || []} onRefresh={refreshDashboard} />}
          {activeTab === "essays" && <EssayCoachView lang={lang} />}
          {activeTab === "strategy" && <StrategyAnalyticsView lang={lang} dashboard={dashboard} />}
        </>
      )}
    </div>
  );
}
