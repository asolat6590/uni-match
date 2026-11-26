import { Award, CalendarClock, CheckCircle2, FileText, GraduationCap, PenTool, Sparkles, Wallet } from "lucide-react";

export default function DashboardView({ lang, data, onNavigate }) {
  const isEn = lang === "en";
  const s = data?.stats || {};
  const apps = data?.applications || [];
  const deadlines = data?.upcomingDeadlines || [];
  const tasks = data?.importantTasks || [];
  const strategy = data?.strategy || {};

  const kpis = [
    {
      label: isEn ? "Application Progress" : "Прогресс заявок",
      value: `${s.applicationProgress || 0}%`,
      sub: `${s.applicationsCount || 0} ${isEn ? "active" : "активных"}`,
      icon: GraduationCap,
      tab: "applications",
    },
    {
      label: isEn ? "Saved Universities" : "Сохранённые вузы",
      value: s.savedUniversitiesCount || 0,
      sub: isEn ? "Ready to compare" : "Готовы к сравнению",
      icon: Sparkles,
      tab: "match",
    },
    {
      label: isEn ? "Scholarships" : "Стипендии",
      value: s.scholarshipsCount || 0,
      sub: isEn ? "Saved / Applied" : "Сохранено / Подано",
      icon: Award,
      tab: "scholarships",
    },
    {
      label: isEn ? "Upcoming Deadlines" : "Ближайшие дедлайны",
      value: s.upcomingDeadlinesCount || 0,
      sub: isEn ? "Smart reminders on" : "Умные напоминания",
      icon: CalendarClock,
      tab: "deadlines",
    },
    {
      label: isEn ? "Documents" : "Документы",
      value: `${s.docsCompleted || 0}/${(s.docsCompleted || 0) + (s.docsMissing || 0)}`,
      sub: `${s.docsMissing || 0} ${isEn ? "missing" : "не хватает"}`,
      icon: FileText,
      tab: "applications",
    },
    {
      label: isEn ? "Essays & Drafts" : "Эссе и черновики",
      value: s.essaysCount || 0,
      sub: isEn ? "AI Essay Coach" : "AI-коуч эссе",
      icon: PenTool,
      tab: "essays",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-hero-gradient p-6 text-primary-foreground shadow-card sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-sky-accent">
              {isEn ? "UniMatch Pro Workspace" : "Личный кабинет UniMatch Pro"}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {isEn ? `Welcome back, ${data?.user?.name || "Applicant"}` : `С возвращением, ${data?.user?.name || "Абитуриент"}`}
            </h2>
          </div>
          {data?.latestCost && (
            <button
              onClick={() => onNavigate("costs")}
              className="rounded-2xl bg-white/10 px-4 py-2.5 text-left backdrop-blur-sm hover:bg-white/15"
            >
              <p className="text-[11px] uppercase tracking-wider text-primary-foreground/75">
                {isEn ? "Latest 1st-year estimate" : "Последний расчёт (1 год · оценка)"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-lg font-extrabold">
                <Wallet className="h-4 w-4 text-mint-accent" /> ${Number(data.latestCost.netFirstYear || 0).toLocaleString()}
              </p>
            </button>
          )}
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>{isEn ? "Overall application readiness" : "Общая готовность к поступлению"}</span>
            <span>{s.applicationProgress || 0}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-mint-accent transition-all" style={{ width: `${s.applicationProgress || 0}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => onNavigate(item.tab)}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 text-left shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                <p className="mt-1 font-display text-2xl font-extrabold">{item.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{isEn ? "Upcoming Deadlines" : "Ближайшие дедлайны"}</h3>
            <button onClick={() => onNavigate("deadlines")} className="text-xs font-semibold text-brand hover:underline">
              {isEn ? "Open calendar" : "Открыть календарь"}
            </button>
          </div>
          {deadlines.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {isEn ? "No upcoming deadlines. Add a university to Application Planner to auto-import verified deadlines." : "Нет активных дедлайнов. Добавь вуз в планировщик заявок, чтобы подтянуть проверенные даты."}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {deadlines.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-3">
                  <div>
                    <p className="text-sm font-semibold">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{d.date}</p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{isEn ? "Important Actions & Next Steps" : "Важные действия и шаги"}</h3>
            <button onClick={() => onNavigate("strategy")} className="text-xs font-semibold text-brand hover:underline">
              {isEn ? "Full strategy" : "Вся стратегия"}
            </button>
          </div>
          <ul className="mt-4 space-y-2.5">
            {(strategy.recommendations || []).map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-2xl border border-border bg-background p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>{rec}</span>
              </li>
            ))}
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-2xl border border-border bg-background p-3 text-sm">
                <span className="font-medium">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.dueDate || t.priority}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {apps.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{isEn ? "Active Applications" : "Активные заявки"}</h3>
            <button onClick={() => onNavigate("applications")} className="text-xs font-semibold text-brand hover:underline">
              {isEn ? "Manage all" : "Управлять"}
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {apps.map((app) => (
              <div key={app.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{app.universityName}</p>
                  <span className="text-xs font-bold text-brand">{app.progress}%</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{app.program} · {app.intake}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${app.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
