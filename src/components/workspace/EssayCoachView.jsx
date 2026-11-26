import { useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiFetch } from "./api.js";

export default function EssayCoachView({ lang }) {
  const isEn = lang === "en";
  const [essays, setEssays] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("Personal Statement");
  const [universityName, setUniversityName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await apiFetch("/api/workspace/essays");
    const list = data.items || [];
    setEssays(list);
    if (!activeId && list[0]) selectEssay(list[0]);
  }

  useEffect(() => {
    load();
  }, []);

  function selectEssay(item) {
    setActiveId(item.id);
    setTitle(item.title || "");
    setUniversityName(item.universityName || "");
    setPrompt(item.prompt || "");
    setContent(item.content || "");
    setFeedback(item.lastFeedback || null);
    setError("");
  }

  async function createDraft() {
    const data = await apiFetch("/api/workspace/essays", {
      method: "POST",
      body: JSON.stringify({
        title: isEn ? `Essay Draft #${essays.length + 1}` : `Черновик эссе #${essays.length + 1}`,
        universityName,
        prompt,
        content: "",
      }),
    });
    await load();
    if (data.item) selectEssay(data.item);
  }

  async function saveDraft() {
    if (!activeId) return;
    setBusy("save");
    try {
      await apiFetch("/api/workspace/essays", {
        method: "PATCH",
        body: JSON.stringify({ id: activeId, title, universityName, prompt, content }),
      });
      await load();
    } finally {
      setBusy("");
    }
  }

  async function runCoach() {
    setBusy("coach");
    setError("");
    try {
      const data = await apiFetch("/api/workspace/essays/coach", {
        method: "POST",
        body: JSON.stringify({ essayId: activeId, universityName, prompt, content, lang }),
      });
      setFeedback(data.feedback);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function deleteDraft(id) {
    await apiFetch(`/api/workspace/essays?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId("");
      setContent("");
      setFeedback(null);
    }
    await load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{isEn ? "Your Essay Drafts" : "Черновики эссе"}</h3>
          <button onClick={createDraft} className="inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
            <Plus className="h-3.5 w-3.5" /> {isEn ? "New" : "Новый"}
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {essays.map((e) => (
            <li key={e.id} className={`flex items-center justify-between rounded-2xl border p-3 text-xs ${activeId === e.id ? "border-brand bg-accent/30" : "border-border bg-background"}`}>
              <button onClick={() => selectEssay(e)} className="flex-1 text-left font-semibold">
                {e.title}
                {e.universityName && <span className="block text-[11px] font-normal text-muted-foreground">{e.universityName}</span>}
              </button>
              <button onClick={() => deleteDraft(e.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
        <div>
          <h3 className="text-lg font-bold">{isEn ? "AI Essay Coach" : "AI-коуч по мотивационному письму"}</h3>
          <p className="text-xs text-muted-foreground">
            {isEn ? "Coaches you on brainstorming, structure, clarity, grammar & weaknesses — never writes the essay for you." : "Помогает с идеями, структурой, ясностью, грамматикой и слабыми местами — не пишет эссе за тебя."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isEn ? "Essay title" : "Название эссе"} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          <input value={universityName} onChange={(e) => setUniversityName(e.target.value)} placeholder={isEn ? "Target university" : "Целевой вуз"} className="rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        </div>

        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={isEn ? "Essay prompt / question" : "Вопрос / тема эссе"} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />

        <textarea
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={isEn ? "Write or paste your draft here..." : "Напиши или вставь черновик сюда..."}
          className="w-full rounded-2xl border border-input bg-background p-4 text-sm outline-none focus:border-brand"
        />

        {error && <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-3">
          {activeId && (
            <button onClick={saveDraft} disabled={busy === "save"} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">
              {busy === "save" ? (isEn ? "Saving..." : "Сохранение...") : (isEn ? "Save Draft" : "Сохранить черновик")}
            </button>
          )}
          <button onClick={runCoach} disabled={busy === "coach"} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground">
            {busy === "coach" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {isEn ? "Get AI Coaching Feedback" : "Получить разбор коуча"}
          </button>
        </div>

        {feedback && (
          <div className="mt-4 space-y-3 rounded-2xl border border-border bg-background p-5 text-xs sm:text-sm">
            <h4 className="font-bold text-brand">{isEn ? "Coaching Review" : "Разбор коуча"}</h4>
            {feedback.brainstorming?.length > 0 && (
              <div>
                <p className="font-semibold">{isEn ? "Brainstorming angles:" : "Идеи для усиления:"}</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {feedback.brainstorming.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </div>
            )}
            <p><span className="font-semibold">{isEn ? "Structure:" : "Структура:"}</span> {feedback.structure}</p>
            <p><span className="font-semibold">{isEn ? "Clarity:" : "Ясность:"}</span> {feedback.clarity}</p>
            <p><span className="font-semibold">{isEn ? "Grammar:" : "Грамматика:"}</span> {feedback.grammar}</p>
            <p><span className="font-semibold">{isEn ? "Specificity:" : "Конкретика:"}</span> {feedback.specificity}</p>
            <p><span className="font-semibold">{isEn ? "Prompt alignment:" : "Соответствие теме:"}</span> {feedback.promptAlignment}</p>
            {feedback.weaknesses?.length > 0 && (
              <div>
                <p className="font-semibold text-destructive">{isEn ? "Weaknesses to fix:" : "Слабые места:"}</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  {feedback.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
