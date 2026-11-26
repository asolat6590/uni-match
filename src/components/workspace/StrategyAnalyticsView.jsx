import { AlertTriangle, CheckCircle2, Compass } from "lucide-react";

export default function StrategyAnalyticsView({ lang, dashboard }) {
  const isEn = lang === "en";
  const strategy = dashboard?.strategy || {};
  const stats = dashboard?.stats || {};
  const tiers = strategy.tiers || { safety: 0, target: 0, reach: 0 };
  const totalTier = Math.max(1, tiers.safety + tiers.target + tiers.reach);

  const analyticsBars = [
    { label: isEn ? "Applications Progress" : "Прогресс заявок", pct: stats.applicationProgress || 0 },
    {
      label: isEn ? "Documents Completed" : "Готовность документов",
      pct: (stats.docsCompleted + stats.docsMissing) > 0
        ? Math.round((stats.docsCompleted / (stats.docsCompleted + stats.docsMissing)) * 100)
        : 0,
    },
    {
      label: isEn ? "Tasks Completed" : "Выполнение задач",
      pct: stats.tasksTotal > 0 ? Math.round((stats.tasksCompleted / stats.tasksTotal) * 100) : 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{isEn ? "Personalized Application Strategy" : "Персональная стратегия поступления"}</h3>
            <p className="text-xs text-muted-foreground">{strategy.disclaimer}</p>
          </div>
          <Compass className="h-5 w-5 text-brand" />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold text-muted-foreground">Safety</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-emerald-600">{tiers.safety}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold text-muted-foreground">Target</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-brand">{tiers.target}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-semibold text-muted-foreground">Reach</p>
            <p className="mt-1 font-display text-2xl font-extrabold text-amber-600">{tiers.reach}</p>
          </div>
        </div>

        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary">
          <div className="bg-emerald-500" style={{ width: `${(tiers.safety / totalTier) * 100}%` }} />
          <div className="bg-brand" style={{ width: `${(tiers.target / totalTier) * 100}%` }} />
          <div className="bg-amber-500" style={{ width: `${(tiers.reach / totalTier) * 100}%` }} />
        </div>

        <ul className="mt-6 space-y-2.5">
          {(strategy.recommendations || []).map((rec, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-2xl border border-border bg-background p-3.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{rec}</span>
            </li>
          ))}
        </ul>

        {strategy.missingDocsCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {isEn
                ? `${strategy.missingDocsCount} required document(s) still pending across your applications.`
                : `По твоим заявкам ещё не готовы ${strategy.missingDocsCount} обязательных документов.`}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h3 className="text-lg font-bold">{isEn ? "Progress Analytics" : "Аналитика прогресса"}</h3>
        <div className="mt-5 space-y-4">
          {analyticsBars.map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between text-xs font-semibold">
                <span>{bar.label}</span>
                <span>{bar.pct}%</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${bar.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
