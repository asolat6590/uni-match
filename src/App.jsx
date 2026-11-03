import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  Check,
  Compass,
  Earth,
  ExternalLink,
  GraduationCap,
  Instagram,
  Layers,
  Linkedin,
  ListChecks,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Rocket,
  Scale,
  Send,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  X,
  Youtube,
} from "lucide-react";
import { copy, heroImage, imageForUniversity, navItems, sectionIds, universities } from "./data.js";
import { catalogFit, loadSaved, storeSaved } from "./fit.js";

const emptyForm = {
  name: "",
  email: "",
  major: "",
  country: "",
  gpa: "",
  test: "",
  budget: "",
  degree: "",
  intake: "",
  priority: "",
};

function textOf(value, lang) {
  if (value && typeof value === "object") return value[lang] || value.en || "";
  return value || "";
}

function toSaved(uni, lang) {
  return {
    name: uni.name,
    country: textOf(uni.country, lang),
    city: textOf(uni.city, lang),
    gpa: uni.gpa || "",
    tests: uni.tests || "",
    tuition: uni.tuition || "",
    scholarships: textOf(uni.scholarships, lang),
    rank: uni.rank || "",
    fit: uni.fit || "",
    fitScore: uni.fitScore || 0,
    major: uni.major || "",
    website: uni.website || "",
  };
}

async function postMatch(body, lang) {
  const response = await fetch("/api/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-unimatch-lang": lang,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "");
  return data;
}

const stepIcons = [UserRound, Compass, Rocket];
const whyIcons = [Layers, Trophy, Earth, Compass, Timer];
const social = [Instagram, Linkedin, Youtube];

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function App() {
  const [lang, setLang] = useState("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [saved, setSaved] = useState(() => loadSaved());
  const [picked, setPicked] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [busy, setBusy] = useState("");
  const [extraError, setExtraError] = useState("");
  const text = copy[lang];

  useEffect(() => {
    storeSaved(saved);
  }, [saved]);

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  function go(id) {
    setMenuOpen(false);
    scrollToId(id);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitProfile(event) {
    event.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const data = await postMatch({ ...form, lang, action: "match" }, lang);
      setResult(data);
      setStatus("done");
      requestAnimationFrame(() => scrollToId("match"));
    } catch (err) {
      setStatus("idle");
      setError(err.message || text.ai.fallback);
    }
  }

  function toggleSave(uni) {
    const item = toSaved(uni, lang);
    setSaved((current) => (current.some((entry) => entry.name === item.name) ? current.filter((entry) => entry.name !== item.name) : [item, ...current].slice(0, 12)));
    setPicked((names) => names.filter((name) => name !== item.name));
  }

  function togglePick(name) {
    setPicked((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name);
      if (current.length >= 3) return current;
      return [...current, name];
    });
  }

  async function runTask(body, key) {
    setBusy(key);
    setExtraError("");
    try {
      return await postMatch({ ...form, lang, ...body }, lang);
    } catch (err) {
      setExtraError(err.message || text.ai.fallback);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function refineList(kind) {
    if (!result?.universities?.length) return;
    const data = await runTask({ action: "refine", refine: kind, previous: result.universities }, kind);
    if (data?.universities) {
      setResult(data);
      requestAnimationFrame(() => scrollToId("match"));
    }
  }

  async function compareSaved() {
    const selected = saved.filter((item) => picked.includes(item.name));
    if (selected.length < 2) {
      setExtraError(text.ai.compareHint);
      return;
    }
    const data = await runTask({ action: "compare", selected }, "compare");
    if (data?.rows) setComparison(data);
  }

  async function openChecklist(uni) {
    const data = await runTask({ action: "checklist", university: toSaved(uni, lang) }, `check:${uni.name}`);
    if (data?.title) setChecklist({ ...data, university: uni.name });
  }

  function downloadChecklist() {
    if (!checklist) return;
    const lines = [
      checklist.title,
      `${form.name} · ${form.email}`,
      "",
      text.ai.deadlines,
      ...checklist.deadlines.map((item) => `- ${item}`),
      "",
      text.ai.documents,
      ...checklist.documents.map((item) => `- ${item}`),
      "",
      text.ai.essay,
      checklist.essay,
      "",
      text.ai.living,
      checklist.livingCost,
      "",
      checklist.note,
    ].filter((line) => line !== undefined);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "unimatch-checklist.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={() => go("home")} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">UniMatch</span>
          </button>
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => go(sectionIds[item])}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-brand"
              >
                {text.nav[item]}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center rounded-full border border-border p-0.5 sm:flex">
              {["en", "ru"].map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
                    lang === code ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-brand"
                  }`}
                >
                  {code}
                </button>
              ))}
            </div>
            <button
              onClick={() => go("match")}
              className="hidden rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground shadow-soft transition-transform hover:-translate-y-0.5 md:inline-flex"
            >
              {text.cta}
            </button>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border lg:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-border bg-background px-4 py-4 lg:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item}
                  onClick={() => go(sectionIds[item])}
                  className="rounded-xl px-3 py-3 text-left text-base font-medium hover:bg-secondary"
                >
                  {text.nav[item]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center rounded-full border border-border p-0.5">
                {["en", "ru"].map((code) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase ${
                      lang === code ? "bg-brand text-brand-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
              <button
                onClick={() => go("match")}
                className="flex-1 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground"
              >
                {text.cta}
              </button>
            </div>
          </div>
        )}
      </header>

      <section id="home" className="relative overflow-hidden bg-hero-gradient pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div className="text-primary-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-accent">
              <Sparkles className="h-3.5 w-3.5" /> UniMatch
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-[3.4rem]">{text.heroTitle}</h1>
            <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">{text.heroSub}</p>
            <p className="mt-3 max-w-xl text-sm text-primary-foreground/65">{text.heroDesc}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => go("match")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-accent px-6 py-3.5 text-sm font-semibold text-brand shadow-card transition-transform hover:-translate-y-0.5"
              >
                {text.cta} <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => go("universities")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary-foreground/30 px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10"
              >
                {text.browse}
              </button>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {text.stats.map((item) => (
                <div key={item.l} className="rounded-2xl bg-primary-foreground/10 px-4 py-3">
                  <dt className="font-display text-xl font-bold text-primary-foreground">{item.v}</dt>
                  <dd className="text-xs text-primary-foreground/70">{item.l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-primary-foreground/15 shadow-card">
              <img src={heroImage} width="1280" height="1024" alt="International students on a university campus" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 left-4 hidden rounded-2xl bg-background px-5 py-4 shadow-card sm:block">
              <p className="text-xs text-muted-foreground">QS Top-100</p>
              <p className="font-display text-sm font-bold">{text.heroBadge}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle title={text.howTitle} sub={text.howSub} />
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {text.steps.map((step, index) => {
              const Icon = stepIcons[index];
              return (
                <div key={step.t} className="rounded-3xl border border-border bg-card p-7 shadow-soft transition-transform hover:-translate-y-1">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="font-display text-3xl font-bold text-border">0{index + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-bold">{step.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{step.d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="universities" className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle title={text.unisTitle} sub={text.unisSub} />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {universities.map((uni) => {
              const fit = catalogFit(form, uni);
              return (
              <button
                key={uni.id}
                onClick={() => setSelected(uni)}
                className="group overflow-hidden rounded-3xl border border-border bg-card text-left shadow-soft transition-all hover:-translate-y-1.5 hover:shadow-card"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {fit && (
                    <span className="absolute left-3 top-3 z-10 rounded-full bg-background/90 px-3 py-1 text-xs font-bold text-brand shadow-soft">
                      {text.ai.fits[fit]}
                    </span>
                  )}
                  <img
                    src={uni.image}
                    width="1024"
                    height="768"
                    loading="lazy"
                    alt={uni.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 p-5">
                  <div>
                    <h3 className="text-base font-bold">{uni.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {uni.country[lang]}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors group-hover:bg-brand group-hover:text-brand-foreground">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle title={text.pricingTitle} sub={text.pricingSub} />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {text.plans.map((plan, index) => {
              const featured = index === 1;
              return (
                <div
                  key={plan.n}
                  className={`relative flex flex-col rounded-3xl border p-8 transition-transform hover:-translate-y-1 ${
                    featured
                      ? "border-transparent bg-hero-gradient text-primary-foreground shadow-card lg:scale-[1.03]"
                      : "border-border bg-card shadow-soft"
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-8 rounded-full bg-sky-accent px-3 py-1 text-xs font-bold text-brand">
                      {text.popular}
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{plan.n}</h3>
                  <p className="mt-4 flex items-end gap-1">
                    <span className="font-display text-4xl font-extrabold">{plan.p}</span>
                    {plan.per && <span className={featured ? "text-primary-foreground/70" : "text-muted-foreground"}>{plan.per}</span>}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    {plan.f.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? "text-mint-accent" : "text-brand"}`} />
                        <span className={featured ? "text-primary-foreground/90" : "text-muted-foreground"}>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => go("match")}
                    className={`mt-8 rounded-full px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 ${
                      featured ? "bg-sky-accent text-brand" : "bg-brand text-brand-foreground"
                    }`}
                  >
                    {plan.b}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="match" className="py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <SectionTitle title={text.formTitle} sub={text.formSub} />
          <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-10">
            {status === "done" && result ? (
              <MatchResults
                text={text}
                result={result}
                busy={busy}
                extraError={extraError}
                saved={saved}
                onReset={() => {
                  setStatus("idle");
                  setResult(null);
                }}
                onRefine={refineList}
                onToggleSave={toggleSave}
                onChecklist={openChecklist}
              />
            ) : (
              <form onSubmit={submitProfile} className="grid gap-5 sm:grid-cols-2">
                <Field label={text.fields.name} name="name" value={form.name} onChange={updateField} required autoComplete="name" />
                <Field label={text.fields.email} name="email" type="email" value={form.email} onChange={updateField} required autoComplete="email" />
                <Field label={text.fields.major} name="major" value={form.major} onChange={updateField} />
                <Field label={text.fields.country} name="country" value={form.country} onChange={updateField} />
                <SelectField label={text.fields.degree} name="degree" value={form.degree} onChange={updateField} options={text.fields.degreeOptions} />
                <SelectField label={text.fields.intake} name="intake" value={form.intake} onChange={updateField} options={text.fields.intakeOptions} />
                <Field label={text.fields.gpa} name="gpa" value={form.gpa} onChange={updateField} placeholder="3.5 / 4.0" />
                <Field label={text.fields.test} name="test" value={form.test} onChange={updateField} placeholder="IELTS 7.0" />
                <Field label={text.fields.budget} name="budget" value={form.budget} onChange={updateField} placeholder="$20,000" />
                <SelectField label={text.fields.priority} name="priority" value={form.priority} onChange={updateField} options={text.fields.priorityOptions} />
                {error && (
                  <p className="rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive sm:col-span-2">{error}</p>
                )}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-brand-foreground shadow-soft transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-70"
                  >
                    {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {status === "loading" ? text.ai.loading : text.submit}
                  </button>
                </div>
              </form>
            )}
          </div>
          {status !== "done" && extraError && (
            <p className="mt-4 rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">{extraError}</p>
          )}
          <SavedPanel
            text={text}
            saved={saved}
            picked={picked}
            comparison={comparison}
            busy={busy}
            onTogglePick={togglePick}
            onRemove={toggleSave}
            onCompare={compareSaved}
            onChecklist={openChecklist}
          />
        </div>
      </section>

      <section className="bg-surface py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <SectionTitle title={text.whyTitle} />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {text.why.map((item, index) => {
              const Icon = whyIcons[index];
              return (
                <div key={item} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold">{item}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl rounded-[2.5rem] bg-hero-gradient px-6 py-16 text-center text-primary-foreground shadow-card sm:px-12">
          <h2 className="text-3xl font-extrabold sm:text-4xl">{text.finalTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-primary-foreground/80">{text.finalText}</p>
          <button
            onClick={() => go("match")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-sky-accent px-7 py-3.5 text-sm font-semibold text-brand transition-transform hover:-translate-y-0.5"
          >
            {text.cta} <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      <footer id="contacts" className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <GraduationCap className="h-5 w-5" />
              </span>
              <span className="font-display text-lg font-bold">UniMatch</span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{text.footerDesc}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">{text.footerNav}</h3>
            <ul className="mt-4 space-y-2.5">
              {navItems.map((item) => (
                <li key={item}>
                  <button onClick={() => go(sectionIds[item])} className="text-sm text-muted-foreground hover:text-brand">
                    {text.nav[item]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">{text.footerContact}</h3>
            <a href="mailto:hello@unimatch.study" className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand">
              <Mail className="h-4 w-4" /> hello@unimatch.study
            </a>
            <div className="mt-5 flex gap-3">
              {social.map((Icon, index) => (
                <a
                  key={index}
                  href="#home"
                  aria-label="Social link"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-brand hover:text-brand-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} UniMatch. {text.rights}
        </div>
      </footer>

      {selected && (
        <UniversityModal
          uni={selected}
          lang={lang}
          labels={text.modal}
          saved={saved.some((item) => item.name === selected.name)}
          saveLabel={saved.some((item) => item.name === selected.name) ? text.ai.saved : text.ai.save}
          checklistLabel={text.ai.checklist}
          fitLabel={catalogFit(form, selected) ? text.ai.fits[catalogFit(form, selected)] : ""}
          onSave={() => toggleSave(selected)}
          onChecklist={() => openChecklist(selected)}
          onClose={() => setSelected(null)}
        />
      )}
      {checklist && (
        <ChecklistModal text={text} checklist={checklist} onDownload={downloadChecklist} onClose={() => setChecklist(null)} />
      )}
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-extrabold sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-ring/40"
      >
        {options.map((option) => (
          <option key={option.v || "empty"} value={option.v}>
            {option.l}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({ label, name, type = "text", placeholder, required, value, onChange, autoComplete }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-ring/40"
      />
    </label>
  );
}

function MatchResults({ text, result, busy, extraError, saved, onReset, onRefine, onToggleSave, onChecklist }) {
  const refinements = [
    ["cheaper", text.ai.cheaper],
    ["europe", text.ai.europe],
    ["no-reach", text.ai.noReach],
  ];
  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Check className="h-7 w-7" />
        </span>
        <h3 className="mt-5 text-lg font-bold">{text.ai.summary}</h3>
        {result.summary && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{result.summary}</p>}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {refinements.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            disabled={Boolean(busy)}
            onClick={() => onRefine(kind)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {busy === kind ? text.ai.refining : label}
          </button>
        ))}
      </div>
      {extraError && <p className="mt-4 rounded-2xl border border-destructive/40 px-4 py-3 text-sm text-destructive">{extraError}</p>}
      <div className="mt-8 grid gap-5">
        {result.universities.map((uni) => {
          const image = imageForUniversity(`${uni.name} ${uni.city}`);
          const kept = saved.some((item) => item.name === uni.name);
          return (
            <article key={`${uni.name}-${uni.city}`} className="overflow-hidden rounded-3xl border border-border bg-background text-left shadow-soft">
              {image ? (
                <img src={image} alt={uni.name} className="h-44 w-full object-cover" />
              ) : (
                <div className="h-24 bg-hero-gradient" />
              )}
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold">{uni.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {[uni.city, uni.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                      {text.ai.fits[uni.fit] || text.ai.fits.match}
                    </span>
                    <span className="font-display text-sm font-bold text-brand">
                      {text.ai.score} {uni.fitScore}%
                    </span>
                  </div>
                </div>
                {uni.major && (
                  <p className="mt-4 text-sm">
                    <span className="font-semibold">{text.ai.program}: </span>
                    {uni.major}
                  </p>
                )}
                {uni.why && <p className="mt-2 text-sm text-muted-foreground">{uni.why}</p>}
                {uni.estimate && <p className="mt-2 text-xs text-muted-foreground">{uni.estimate}</p>}
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {uni.rank && <Fact label={text.modal.rank} value={uni.rank} />}
                  {uni.gpa && <Fact label={text.modal.gpa} value={uni.gpa} />}
                  {uni.tests && <Fact label={text.modal.tests} value={uni.tests} />}
                  {uni.tuition && <Fact label={text.modal.tuition} value={uni.tuition} />}
                  {uni.scholarships && <Fact label={text.modal.scholarships} value={uni.scholarships} />}
                  {uni.nextStep && <Fact label={text.ai.next} value={uni.nextStep} />}
                </div>
                {uni.requirements?.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {uni.requirements.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {item}
                      </li>
                    ))}
                  </ul>
                )}
                {uni.website ? (
                  <a href={uni.website} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                    <ExternalLink className="h-4 w-4" /> {text.ai.website}
                  </a>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">{text.ai.noWebsite}</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onToggleSave(uni)} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary">
                    <Bookmark className="h-4 w-4" /> {kept ? text.ai.saved : text.ai.save}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => onChecklist(uni)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
                  >
                    <ListChecks className="h-4 w-4" /> {busy === `check:${uni.name}` ? text.ai.checklistLoading : text.ai.checklist}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">{text.ai.disclaimer}</p>
      <div className="mt-6 text-center">
        <button onClick={onReset} className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary">
          {text.ai.again}
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function SavedPanel({ text, saved, picked, comparison, busy, onTogglePick, onRemove, onCompare, onChecklist }) {
  if (!saved.length) return null;
  const verdicts = Object.fromEntries((comparison?.rows || []).map((row) => [row.name, row.verdict]));
  return (
    <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{text.ai.shortlist}</h3>
        <button
          type="button"
          disabled={Boolean(busy) || picked.length < 2}
          onClick={onCompare}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
        >
          <Scale className="h-4 w-4" /> {busy === "compare" ? text.ai.comparing : text.ai.compare}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{text.ai.compareHint}</p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2 pr-3" />
              <th className="py-2 pr-3">{text.fields.name}</th>
              <th className="py-2 pr-3">{text.fields.country}</th>
              <th className="py-2 pr-3">GPA</th>
              <th className="py-2 pr-3">IELTS</th>
              <th className="py-2 pr-3">{text.modal.tuition}</th>
              <th className="py-2">{text.ai.score}</th>
            </tr>
          </thead>
          <tbody>
            {saved.map((uni) => (
              <tr key={uni.name} className="border-t border-border">
                <td className="py-3 pr-3">
                  <input type="checkbox" checked={picked.includes(uni.name)} onChange={() => onTogglePick(uni.name)} aria-label={uni.name} />
                </td>
                <td className="py-3 pr-3 font-semibold">{uni.name}</td>
                <td className="py-3 pr-3 text-muted-foreground">{uni.country}</td>
                <td className="py-3 pr-3">{uni.gpa}</td>
                <td className="py-3 pr-3">{uni.tests}</td>
                <td className="py-3 pr-3">{uni.tuition}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    {uni.fit && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">{text.ai.fits[uni.fit] || uni.fit}</span>}
                    <button type="button" onClick={() => onChecklist(uni)} className="text-xs font-semibold text-brand">
                      {text.ai.checklist}
                    </button>
                    <button type="button" onClick={() => onRemove(uni)} className="text-xs font-semibold text-muted-foreground">
                      {text.modal.close}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comparison && (
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{text.ai.first}</p>
          <p className="mt-1 text-lg font-bold">{comparison.firstChoice}</p>
          {comparison.summary && <p className="mt-2 text-sm text-muted-foreground">{comparison.summary}</p>}
          <ul className="mt-4 space-y-3">
            {saved
              .filter((uni) => picked.includes(uni.name))
              .map((uni) => (
                <li key={uni.name} className="text-sm">
                  <span className="font-semibold">{uni.name}. </span>
                  <span className="text-muted-foreground">{verdicts[uni.name]}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChecklistModal({ text, checklist, onDownload, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div onClick={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card p-6 shadow-card sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-extrabold">{checklist.title}</h3>
          <button onClick={onClose} aria-label={text.modal.close} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 grid gap-4">
          <FactList title={text.ai.deadlines} items={checklist.deadlines} />
          <FactList title={text.ai.documents} items={checklist.documents} />
          {checklist.essay && <Fact label={text.ai.essay} value={checklist.essay} />}
          {checklist.livingCost && <Fact label={text.ai.living} value={checklist.livingCost} />}
          {checklist.note && <p className="text-xs text-muted-foreground">{checklist.note}</p>}
        </div>
        <button onClick={onDownload} className="mt-8 w-full rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">
          {text.ai.download}
        </button>
      </div>
    </div>
  );
}

function FactList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UniversityModal({ uni, lang, labels, saved, saveLabel, checklistLabel, fitLabel, onSave, onChecklist, onClose }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-card shadow-card sm:rounded-3xl"
      >
        <div className="relative">
          <img src={uni.image} width="1024" height="768" alt={uni.name} className="h-52 w-full object-cover sm:h-64" />
          <button
            onClick={onClose}
            aria-label={labels.close}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-soft"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-2xl font-extrabold">{uni.name}</h3>
            {fitLabel && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{fitLabel}</span>}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {uni.city[lang]}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Fact label={labels.rank} value={uni.rank} />
            <Fact label={labels.acceptance} value={uni.acceptance[lang]} />
            <Fact label={labels.gpa} value={uni.gpa} />
            <Fact label={labels.tests} value={uni.tests} />
            <Fact label={labels.tuition} value={uni.tuition} />
            <Fact label={labels.scholarships} value={uni.scholarships[lang]} />
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{labels.majors}</h4>
            <div className="mt-3 flex flex-wrap gap-2">
              {uni.majors[lang].map((major) => (
                <span key={major} className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
                  {major}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-6">
            <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{labels.req}</h4>
            <ul className="mt-3 space-y-2">
              {uni.requirements[lang].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button onClick={onSave} className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-5 py-3 text-sm font-semibold hover:bg-secondary">
              <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} /> {saveLabel}
            </button>
            <button onClick={onChecklist} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground">
              <ListChecks className="h-4 w-4" /> {checklistLabel}
            </button>
          </div>
          <button onClick={onClose} className="mt-3 w-full rounded-full px-5 py-3 text-sm font-semibold text-muted-foreground">
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );
}
