import { useState } from "react";
import { Bookmark, Check, ExternalLink, Plus, Scale, Sparkles } from "lucide-react";
import { apiFetch } from "./api.js";

function FitBar({ label, value }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold">
        <span className="text-muted-foreground">{label}</span>
        <span>{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-brand" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function MatchingAndCompareView({ lang, user, initialCatalog, onRefresh }) {
  const isEn = lang === "en";
  const [profile, setProfile] = useState({
    gpa: user?.profile?.gpa || "3.5",
    test: user?.profile?.test || "IELTS 6.5",
    major: user?.profile?.major || "Computer Science",
    country: user?.profile?.country || "",
    budget: user?.profile?.budget || "35000",
    degree: user?.profile?.degree || "bachelor",
  });
  const [results, setResults] = useState(initialCatalog || []);
  const [selectedIds, setSelectedIds] = useState((initialCatalog || []).slice(0, 3).map((u) => u.id));
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  async function runMatch(e) {
    e.preventDefault();
    setBusy("match");
    try {
      const data = await apiFetch("/api/verified-match", {
        method: "POST",
        body: JSON.stringify({ profile, lang }),
      });
      setResults(data.universities || []);
      setNote(data.note || "");
      onRefresh?.();
    } finally {
      setBusy("");
    }
  }

  function toggleCompare(id) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  async function saveUni(id) {
    setBusy(`save:${id}`);
    try {
      await apiFetch("/api/workspace/saved", {
        method: "POST",
        body: JSON.stringify({ universityId: id }),
      });
      onRefresh?.();
    } finally {
      setBusy("");
    }
  }

  async function addApplication(uni) {
    setBusy(`app:${uni.id}`);
    try {
      await apiFetch("/api/workspace/applications", {
        method: "POST",
        body: JSON.stringify({ universityId: uni.id, program: profile.major || uni.majors?.[0] }),
      });
      onRefresh?.();
    } finally {
      setBusy("");
    }
  }

  const compared = results.filter((u) => selectedIds.includes(u.id)).slice(0, 5);
  const topCompared = [...compared].sort((a, b) => b.matchScore - a.matchScore)[0];

  return (
    <div className="space-y-8">
      <form onSubmit={runMatch} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold">{isEn ? "Advanced Profile Matching" : "Расширенный подбор по профилю"}</h3>
            <p className="text-xs text-muted-foreground">
              {isEn
                ? "Verified academic, budget & program alignment — never presented as admission probabilities."
                : "Проверенное совпадение по баллам, бюджету и программе — не является вероятностью поступления."}
            </p>
          </div>
          <button
            type="submit"
            disabled={busy === "match"}
            className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground"
          >
            <Sparkles className="h-4 w-4" /> {isEn ? "Recalculate Match" : "Пересчитать подбор"}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <input
            value={profile.gpa}
            onChange={(e) => setProfile({ ...profile, gpa: e.target.value })}
            placeholder="GPA (e.g. 3.6)"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={profile.test}
            onChange={(e) => setProfile({ ...profile, test: e.target.value })}
            placeholder="IELTS / TOEFL"
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={profile.major}
            onChange={(e) => setProfile({ ...profile, major: e.target.value })}
            placeholder={isEn ? "Major" : "Специальность"}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={profile.country}
            onChange={(e) => setProfile({ ...profile, country: e.target.value })}
            placeholder={isEn ? "Country (any)" : "Страна (любая)"}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={profile.budget}
            onChange={(e) => setProfile({ ...profile, budget: e.target.value })}
            placeholder={isEn ? "Budget USD" : "Бюджет USD"}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={profile.degree}
            onChange={(e) => setProfile({ ...profile, degree: e.target.value })}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="bachelor">{isEn ? "Bachelor" : "Бакалавриат"}</option>
            <option value="master">{isEn ? "Master" : "Магистратура"}</option>
          </select>
        </div>
        {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
      </form>

      <div className="grid gap-5 lg:grid-cols-2">
        {results.map((uni) => {
          const isCompared = selectedIds.includes(uni.id);
          return (
            <article key={uni.id} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase text-accent-foreground">
                    {uni.fitTier} · {uni.rank}
                  </span>
                  <h4 className="mt-2 text-lg font-bold">{uni.name}</h4>
                  <p className="text-xs text-muted-foreground">{uni.city}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                    {isEn ? "Match Score" : "Совпадение"}
                  </p>
                  <p className="font-display text-2xl font-extrabold text-brand">{uni.matchScore}%</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
                <FitBar label={isEn ? "Academic Fit" : "Академ."} value={uni.academicFit} />
                <FitBar label={isEn ? "Budget Fit" : "Бюджет"} value={uni.budgetFit} />
                <FitBar label={isEn ? "Program Fit" : "Программа"} value={uni.programFit} />
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <p><span className="font-semibold">{isEn ? "Tuition:" : "Обучение:"}</span> {uni.tuitionDisplay}</p>
                <p><span className="font-semibold">{isEn ? "Next deadline:" : "Ближайший дедлайн:"}</span> {uni.nextDeadline}</p>
                <p><span className="font-semibold">{isEn ? "Housing:" : "Жильё:"}</span> {uni.housingInfo}</p>
              </div>

              {uni.reasons?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {uni.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> {r}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => toggleCompare(uni.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    isCompared ? "border-brand bg-accent text-accent-foreground" : "border-border"
                  }`}
                >
                  <Scale className="h-3.5 w-3.5" /> {isCompared ? (isEn ? "In comparison" : "В сравнении") : (isEn ? "Compare" : "Сравнить")}
                </button>
                <button
                  type="button"
                  onClick={() => saveUni(uni.id)}
                  disabled={busy === `save:${uni.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                >
                  <Bookmark className="h-3.5 w-3.5" /> {isEn ? "Save" : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => addApplication(uni)}
                  disabled={busy === `app:${uni.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground"
                >
                  <Plus className="h-3.5 w-3.5" /> {isEn ? "Add Application" : "В заявки"}
                </button>
                <a
                  href={uni.officialSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {isEn ? "Official Source" : "Офиц. сайт"}
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h3 className="text-lg font-bold">
          {isEn ? `University Comparison (${compared.length}/5 selected)` : `Сравнение университетов (выбрано ${compared.length}/5)`}
        </h3>
        {compared.length < 2 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {isEn ? "Select 2 to 5 universities above to compare them side by side." : "Отметь от 2 до 5 вузов выше, чтобы сравнить их в таблице."}
          </p>
        ) : (
          <>
            {topCompared && (
              <div className="mt-4 rounded-2xl bg-accent/40 p-4 text-sm">
                <span className="font-bold">{isEn ? "Personalized summary: " : "Персональный вывод: "}</span>
                {isEn
                  ? `${topCompared.name} leads your comparison with a ${topCompared.matchScore}% Profile Match Score (${topCompared.fitTier}).`
                  : `${topCompared.name} лидирует в сравнении с совпадением профиля ${topCompared.matchScore}% (${topCompared.fitTier}).`}
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">{isEn ? "University" : "Вуз"}</th>
                    <th className="py-2 pr-3">{isEn ? "Match" : "Совпадение"}</th>
                    <th className="py-2 pr-3">{isEn ? "Tuition" : "Обучение"}</th>
                    <th className="py-2 pr-3">{isEn ? "Living (Estimate)" : "Проживание (Оценка)"}</th>
                    <th className="py-2 pr-3">{isEn ? "Requirements" : "Требования"}</th>
                    <th className="py-2 pr-3">{isEn ? "Deadline" : "Дедлайн"}</th>
                    <th className="py-2">{isEn ? "Source" : "Источник"}</th>
                  </tr>
                </thead>
                <tbody>
                  {compared.map((u) => (
                    <tr key={u.id} className="border-b border-border/60">
                      <td className="py-3 pr-3 font-bold">{u.name}</td>
                      <td className="py-3 pr-3 font-bold text-brand">{u.matchScore}%</td>
                      <td className="py-3 pr-3">{u.tuitionDisplay}</td>
                      <td className="py-3 pr-3">~${u.livingAnnualUsdEstimate.toLocaleString()}/yr ({isEn ? "Estimate" : "Оценка"})</td>
                      <td className="py-3 pr-3">GPA {u.minGpa} · IELTS {u.minIelts}</td>
                      <td className="py-3 pr-3">{u.nextDeadline}</td>
                      <td className="py-3">
                        <a href={u.officialSourceUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand hover:underline">
                          {isEn ? "Official Source" : "Офиц. сайт"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
