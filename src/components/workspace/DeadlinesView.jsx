import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, List, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "./api.js";

const STATUS_STYLE = {
  Overdue: "bg-destructive/15 text-destructive",
  Today: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  Urgent: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  Soon: "bg-sky-accent/30 text-brand",
  Upcoming: "bg-secondary text-muted-foreground",
  Completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export default function DeadlinesView({ lang, onRefresh }) {
  const isEn = lang === "en";
  const [items, setItems] = useState([]);
  const [view, setView] = useState("list");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("application");

  async function load() {
    const data = await apiFetch("/api/workspace/deadlines");
    setItems(data.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addDeadline(e) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    await apiFetch("/api/workspace/deadlines", {
      method: "POST",
      body: JSON.stringify({ title, date, category }),
    });
    setTitle("");
    setDate("");
    await load();
    onRefresh?.();
  }

  async function toggleDone(dl) {
    await apiFetch("/api/workspace/deadlines", {
      method: "PATCH",
      body: JSON.stringify({ id: dl.id, completed: !dl.completed }),
    });
    await load();
    onRefresh?.();
  }

  async function remove(id) {
    await apiFetch(`/api/workspace/deadlines?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    onRefresh?.();
  }

  const groupedByMonth = items.reduce((acc, item) => {
    const key = (item.date || "").slice(0, 7) || "Other";
    (acc[key] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div>
          <h3 className="text-lg font-bold">{isEn ? "Smart Deadlines" : "Умные дедлайны"}</h3>
          <p className="text-xs text-muted-foreground">
            {isEn ? "Auto-classified as Upcoming, Soon, Urgent, Today, Overdue, or Completed." : "Автоматические статусы: Upcoming, Soon, Urgent, Today, Overdue, Completed."}
          </p>
        </div>
        <div className="flex rounded-full border border-border p-1">
          <button
            onClick={() => setView("list")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${view === "list" ? "bg-brand text-brand-foreground" : ""}`}
          >
            <List className="h-3.5 w-3.5" /> {isEn ? "List" : "Список"}
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${view === "calendar" ? "bg-brand text-brand-foreground" : ""}`}
          >
            <Calendar className="h-3.5 w-3.5" /> {isEn ? "Calendar" : "Календарь"}
          </button>
        </div>
      </div>

      <form onSubmit={addDeadline} className="grid gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft sm:grid-cols-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isEn ? "Deadline title" : "Название дедлайна"}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs sm:col-span-2"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-xs" />
        <div className="flex gap-2">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs">
            <option value="application">{isEn ? "Application" : "Заявка"}</option>
            <option value="scholarship">{isEn ? "Scholarship" : "Стипендия"}</option>
            <option value="document">{isEn ? "Document" : "Документ"}</option>
          </select>
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </form>

      {view === "list" ? (
        <div className="space-y-2.5">
          {items.map((dl) => (
            <div key={dl.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleDone(dl)} className="text-brand">
                  <CheckCircle2 className={`h-5 w-5 ${dl.completed ? "opacity-100" : "opacity-30"}`} />
                </button>
                <div>
                  <p className={`text-sm font-bold ${dl.completed ? "line-through opacity-60" : ""}`}>{dl.title}</p>
                  <p className="text-xs text-muted-foreground">{dl.date} · {dl.category}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[dl.status] || ""}`}>
                  {dl.status}
                </span>
                <button onClick={() => remove(dl.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(groupedByMonth).sort().map(([month, list]) => (
            <div key={month} className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <h4 className="font-display text-base font-bold">{month}</h4>
              <ul className="mt-3 space-y-2">
                {list.map((dl) => (
                  <li key={dl.id} className="flex items-center justify-between gap-2 rounded-xl bg-background p-2.5 text-xs">
                    <span className="font-medium">{dl.date.slice(8)}: {dl.title}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[dl.status] || ""}`}>
                      {dl.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
