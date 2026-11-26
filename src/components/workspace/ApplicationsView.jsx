import { useEffect, useState } from "react";
import { CheckSquare, ExternalLink, Plus, Square, Trash2 } from "lucide-react";
import { apiFetch } from "./api.js";

export default function ApplicationsView({ lang, catalog, onRefresh }) {
  const isEn = lang === "en";
  const [data, setData] = useState({ items: [], documents: [], tasks: [], deadlines: [] });
  const [selectedUniId, setSelectedUniId] = useState(catalog?.[0]?.id || "toronto");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("documents");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskAppId, setTaskAppId] = useState("");

  async function load() {
    const res = await apiFetch(`/api/workspace/applications?lang=${lang}`);
    setData(res);
    if (!taskAppId && res.items?.[0]?.id) setTaskAppId(res.items[0].id);
  }

  useEffect(() => {
    load();
  }, [lang]);

  async function addApplication() {
    if (!selectedUniId) return;
    await apiFetch("/api/workspace/applications", {
      method: "POST",
      body: JSON.stringify({ universityId: selectedUniId }),
    });
    await load();
    onRefresh?.();
  }

  async function updateAppStatus(id, status) {
    await apiFetch("/api/workspace/applications", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
    await load();
    onRefresh?.();
  }

  async function toggleDoc(doc) {
    const next = doc.status === "completed" ? "missing" : "completed";
    await apiFetch("/api/workspace/documents", {
      method: "PATCH",
      body: JSON.stringify({ id: doc.id, status: next }),
    });
    await load();
    onRefresh?.();
  }

  async function addTask(e) {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    const app = data.items.find((a) => a.id === taskAppId);
    await apiFetch("/api/workspace/tasks", {
      method: "POST",
      body: JSON.stringify({
        title: taskTitle,
        category: taskCategory,
        priority: taskPriority,
        dueDate: taskDueDate,
        applicationId: taskAppId,
        universityName: app?.universityName || "",
      }),
    });
    setTaskTitle("");
    await load();
    onRefresh?.();
  }

  async function toggleTask(task) {
    await apiFetch("/api/workspace/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: task.id, completed: !task.completed }),
    });
    await load();
    onRefresh?.();
  }

  async function deleteTask(id) {
    await apiFetch(`/api/workspace/tasks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    onRefresh?.();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div>
          <h3 className="text-lg font-bold">{isEn ? "Application Planner & Timeline" : "Планировщик заявок и таймлайн"}</h3>
          <p className="text-xs text-muted-foreground">
            {isEn ? "Adding a university automatically imports verified required documents and official deadlines." : "При добавлении вуза автоматически подтягиваются проверенные документы и официальные дедлайны."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedUniId}
            onChange={(e) => setSelectedUniId(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
          >
            {(catalog || []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={addApplication}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> {isEn ? "Add Application" : "Добавить заявку"}
          </button>
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {isEn ? "No applications yet. Select a verified university above to start tracking." : "Заявок пока нет. Выбери проверенный университет выше, чтобы начать."}
        </div>
      ) : (
        <div className="space-y-6">
          {data.items.map((app) => {
            const appDocs = data.documents.filter((d) => d.applicationId === app.id);
            const appTasks = data.tasks.filter((t) => t.applicationId === app.id);
            const appDeadlines = data.deadlines.filter((d) => d.applicationId === app.id);
            const timelineItems = [
              ...appDeadlines.map((d) => ({ date: d.date, title: d.title, kind: "deadline", done: d.completed })),
              ...appTasks.filter((t) => t.dueDate).map((t) => ({ date: t.dueDate, title: t.title, kind: "task", done: t.completed })),
            ].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

            return (
              <div key={app.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-xl font-bold">{app.universityName}</h4>
                    <p className="text-xs text-muted-foreground">{app.program} · {app.intake} · {app.country}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={app.status}
                      onChange={(e) => updateAppStatus(app.id, e.target.value)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold"
                    >
                      <option value="planning">{isEn ? "Planning" : "Планирование"}</option>
                      <option value="in_progress">{isEn ? "In Progress" : "В работе"}</option>
                      <option value="submitted">{isEn ? "Submitted" : "Подано"}</option>
                      <option value="decision">{isEn ? "Decision" : "Решение"}</option>
                    </select>
                    <a href={app.officialSourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                      <ExternalLink className="h-3.5 w-3.5" /> {isEn ? "Official Source" : "Офиц. сайт"}
                    </a>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{isEn ? "Application Progress" : "Прогресс заявки"}</span>
                    <span>{app.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${app.progress}%` }} />
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? "Document Tracker" : "Трекер документов"} ({appDocs.filter((d) => d.status === "completed").length}/{appDocs.length})
                    </h5>
                    <ul className="mt-3 space-y-2">
                      {appDocs.map((doc) => (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => toggleDoc(doc)}
                            className="flex w-full items-start gap-2 rounded-xl border border-border bg-background p-2.5 text-left text-xs hover:bg-secondary/50"
                          >
                            {doc.status === "completed" ? (
                              <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                            ) : (
                              <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className={doc.status === "completed" ? "line-through opacity-60" : ""}>{doc.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {isEn ? "Application Timeline" : "Таймлайн заявки"}
                    </h5>
                    <ol className="mt-3 space-y-2 border-l-2 border-brand/30 pl-4">
                      {timelineItems.map((item, idx) => (
                        <li key={idx} className="relative text-xs">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                          <p className="font-bold text-brand">{item.date}</p>
                          <p className={item.done ? "line-through opacity-60" : ""}>{item.title}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h3 className="text-lg font-bold">{isEn ? "Application Tasks" : "Задачи по поступлению"}</h3>
        <form onSubmit={addTask} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder={isEn ? "New task (e.g. Request transcript)" : "Новая задача (напр. Запросить транскрипт)"}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs sm:col-span-2"
          />
          <select value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-xs">
            <option value="documents">{isEn ? "Documents" : "Документы"}</option>
            <option value="essays">{isEn ? "Essays" : "Эссе"}</option>
            <option value="tests">{isEn ? "Tests" : "Тесты"}</option>
            <option value="scholarship">{isEn ? "Scholarship" : "Стипендия"}</option>
          </select>
          <select value={taskAppId} onChange={(e) => setTaskAppId(e.target.value)} className="rounded-xl border border-input bg-background px-3 py-2 text-xs">
            <option value="">{isEn ? "General" : "Общая"}</option>
            {data.items.map((a) => (
              <option key={a.id} value={a.id}>{a.universityName}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="w-full rounded-xl border border-input bg-background px-2 py-2 text-xs" />
            <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </form>

        <ul className="mt-5 space-y-2">
          {data.tasks.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-xs">
              <button type="button" onClick={() => toggleTask(task)} className="flex items-center gap-2 text-left">
                {task.completed ? <CheckSquare className="h-4 w-4 text-brand" /> : <Square className="h-4 w-4 text-muted-foreground" />}
                <span className={task.completed ? "line-through opacity-60" : "font-semibold"}>{task.title}</span>
              </button>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span>{task.universityName || task.category}</span>
                {task.dueDate && <span>{task.dueDate}</span>}
                <button type="button" onClick={() => deleteTask(task.id)} className="hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
