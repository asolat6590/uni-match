import { useState } from "react";
import { Loader2, Lock, X } from "lucide-react";
import { apiFetch } from "./api.js";

export default function AuthModal({ lang, initialMode = "login", onSuccess, onClose }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEn = lang === "en";

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "register" ? { name, email, password } : { email, password };
      const data = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Lock className="h-4 w-4" />
            </span>
            <h3 className="text-xl font-extrabold">
              {mode === "register"
                ? isEn ? "Create UniMatch account" : "Создать аккаунт UniMatch"
                : isEn ? "Sign in to UniMatch" : "Войти в UniMatch"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">
          {isEn
            ? "Your applications, deadlines, essays, and Stripe subscription are securely linked to your account."
            : "Твои заявки, дедлайны, эссе и подписка Stripe надёжно привязаны к аккаунту."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="text-sm font-semibold">{isEn ? "Full name" : "Полное имя"}</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
                placeholder={isEn ? "Alex Kim" : "Алина Ким"}
              />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-semibold">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="student@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">{isEn ? "Password" : "Пароль"}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-brand"
              placeholder="••••••"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "register"
              ? isEn ? "Create account" : "Зарегистрироваться"
              : isEn ? "Sign in" : "Войти"}
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "register" ? (
            <button type="button" onClick={() => setMode("login")} className="font-semibold text-brand hover:underline">
              {isEn ? "Already have an account? Sign in" : "Уже есть аккаунт? Войти"}
            </button>
          ) : (
            <button type="button" onClick={() => setMode("register")} className="font-semibold text-brand hover:underline">
              {isEn ? "New to UniMatch? Create account" : "Нет аккаунта? Зарегистрироваться"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
