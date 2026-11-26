import { useEffect, useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "./api.js";

export default function CostCalculatorView({ lang, catalog, onRefresh }) {
  const isEn = lang === "en";
  const [saved, setSaved] = useState([]);
  const [label, setLabel] = useState("University of Toronto — 1st Year");
  const [tuition, setTuition] = useState(45000);
  const [living, setLiving] = useState(18500);
  const [other, setOther] = useState(2500);
  const [scholarship, setScholarship] = useState(0);

  async function load() {
    const data = await apiFetch("/api/workspace/costs");
    setSaved(data.items || []);
  }

  useEffect(() => {
    load();
  }, []);

  function applyUni(id) {
    const u = (catalog || []).find((x) => x.id === id);
    if (!u) return;
    setLabel(`${u.name} — ${isEn ? "Year 1" : "1-й год"}`);
    setTuition(u.tuitionAnnualUsd || 0);
    setLiving(u.livingAnnualUsdEstimate || 0);
  }

  const net = Math.max(0, Number(tuition || 0) + Number(living || 0) + Number(other || 0) - Number(scholarship || 0));

  async function saveCalc(e) {
    e.preventDefault();
    await apiFetch("/api/workspace/costs", {
      method: "POST",
      body: JSON.stringify({ label, tuition, living, other, scholarship }),
    });
    await load();
    onRefresh?.();
  }

  async function remove(id) {
    await apiFetch(`/api/workspace/costs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
    onRefresh?.();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={saveCalc} className="rounded-3xl border border-border bg-card p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{isEn ? "First-Year Cost Calculator" : "Калькулятор стоимости 1-го года"}</h3>
            <p className="text-xs text-muted-foreground">
              {isEn ? "Non-official living & other expenses are clearly marked as Estimates." : "Неофициальные расходы на жильё и быт помечены как Оценка (Estimate)."}
            </p>
          </div>
          <Calculator className="h-5 w-5 text-brand" />
        </div>

        <label className="block text-xs font-semibold">
          {isEn ? "Prefill from verified university" : "Заполнить из проверенного вуза"}
          <select onChange={(e) => applyUni(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
            <option value="">{isEn ? "Choose university..." : "Выбери вуз..."}</option>
            {(catalog || []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold">
          {isEn ? "Calculation name" : "Название расчёта"}
          <input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">
            {isEn ? "Tuition (USD/yr)" : "Обучение (USD/год)"}
            <input type="number" min={0} value={tuition} onChange={(e) => setTuition(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold">
            {isEn ? "Living & Housing (Estimate)" : "Жильё и питание (Оценка)"}
            <input type="number" min={0} value={living} onChange={(e) => setLiving(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold">
            {isEn ? "Visa / Flights / Other (Estimate)" : "Виза / перелёт / прочее (Оценка)"}
            <input type="number" min={0} value={other} onChange={(e) => setOther(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold">
            {isEn ? "Scholarships / Grants (−)" : "Стипендии / гранты (−)"}
            <input type="number" min={0} value={scholarship} onChange={(e) => setScholarship(e.target.value)} className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="rounded-2xl bg-hero-gradient p-4 text-primary-foreground">
          <p className="text-xs uppercase tracking-wider text-primary-foreground/75">
            {isEn ? "Estimated Net First-Year Cost (Estimate)" : "Итоговая стоимость 1-го года (Оценка)"}
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold">${net.toLocaleString()}</p>
        </div>

        <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">
          <Plus className="h-4 w-4" /> {isEn ? "Save Calculation" : "Сохранить расчёт"}
        </button>
      </form>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
        <h3 className="text-lg font-bold">{isEn ? "Saved Calculations" : "Сохранённые расчёты"}</h3>
        {saved.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {isEn ? "No saved calculations yet." : "Пока нет сохранённых расчётов."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {saved.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4">
                <div>
                  <p className="text-sm font-bold">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ${Number(c.tuition).toLocaleString()} + ${Number(c.living).toLocaleString()} ({isEn ? "Est." : "Оц."}) + ${Number(c.other).toLocaleString()} ({isEn ? "Est." : "Оц."}) − ${Number(c.scholarship).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-extrabold text-brand">${Number(c.netFirstYear).toLocaleString()}</span>
                  <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
