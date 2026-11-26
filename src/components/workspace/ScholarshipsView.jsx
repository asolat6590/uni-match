import { useEffect, useState } from "react";
import { Award, Check, ExternalLink } from "lucide-react";
import { apiFetch } from "./api.js";

export default function ScholarshipsView({ lang, onRefresh }) {
  const isEn = lang === "en";
  const [items, setItems] = useState([]);
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    const data = await apiFetch(`/api/workspace/scholarships?lang=${lang}`);
    setItems(data.items || []);
  }

  useEffect(() => {
    load();
  }, [lang]);

  async function setStatus(scholarshipId, status) {
    await apiFetch("/api/workspace/scholarships", {
      method: "POST",
      body: JSON.stringify({ scholarshipId, status }),
    });
    await load();
    onRefresh?.();
  }

  const countries = [...new Set(items.map((i) => i.country))];
  const filtered = items.filter((item) => {
    if (countryFilter && item.country !== countryFilter) return false;
    if (statusFilter !== "all" && item.userStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <div>
          <h3 className="text-lg font-bold">{isEn ? "Verified Scholarship Matcher" : "Подбор проверенных стипендий"}</h3>
          <p className="text-xs text-muted-foreground">
            {isEn ? "All amounts and deadlines come from official university pages." : "Все суммы и дедлайны взяты с официальных страниц университетов."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="">{isEn ? "All countries" : "Все страны"}</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="all">{isEn ? "All statuses" : "Все статусы"}</option>
            <option value="saved">{isEn ? "Saved" : "Сохранено"}</option>
            <option value="applied">{isEn ? "Applied" : "Подано"}</option>
            <option value="completed">{isEn ? "Completed" : "Завершено"}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {filtered.map((sch) => (
          <article key={sch.id} className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
                    <Award className="h-3.5 w-3.5" /> {sch.country}
                  </span>
                  <h4 className="mt-2 text-lg font-bold">{sch.title}</h4>
                  <p className="text-xs text-muted-foreground">{sch.universityName}</p>
                </div>
                <span className="font-display text-xl font-extrabold text-brand">{sch.matchScore}%</span>
              </div>

              <div className="mt-4 space-y-1.5 text-xs">
                <p><span className="font-semibold">{isEn ? "Amount:" : "Размер:"}</span> {sch.amountDisplay}</p>
                <p><span className="font-semibold">{isEn ? "Deadline:" : "Дедлайн:"}</span> {sch.deadline}</p>
                <p><span className="font-semibold">{isEn ? "Eligibility:" : "Условия:"}</span> {sch.eligibility}</p>
              </div>

              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {sch.whyMatches.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" /> {w}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {["saved", "applied", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatus(sch.id, st)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sch.userStatus === st
                      ? "bg-brand text-brand-foreground"
                      : "border border-border hover:bg-secondary"
                  }`}
                >
                  {st === "saved" ? (isEn ? "Save" : "Сохранить") : st === "applied" ? (isEn ? "Applied" : "Подано") : (isEn ? "Completed" : "Завершено")}
                </button>
              ))}
              <a
                href={sch.officialSourceUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {isEn ? "Official Source" : "Офиц. сайт"}
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
