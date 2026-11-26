import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { apiFetch } from "./api.js";

export default function NotificationBell({ lang, isPremium, onOpenDeadlines }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);
  const isEn = lang === "en";

  useEffect(() => {
    if (!isPremium) {
      setItems([]);
      return;
    }
    apiFetch("/api/workspace/notifications")
      .then((d) => setItems(d.items || []))
      .catch(() => {});
  }, [isPremium]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (!isPremium) return null;

  const unread = items.filter((n) => !n.read).length;

  async function markAllRead() {
    const data = await apiFetch("/api/workspace/notifications", {
      method: "PATCH",
      body: JSON.stringify({ markAll: true }),
    });
    setItems(data.items || []);
  }

  async function markOne(id) {
    await apiFetch("/api/workspace/notifications", {
      method: "PATCH",
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={isEn ? "Notifications" : "Уведомления"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-secondary"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-border bg-card p-3 shadow-card z-50">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {isEn ? "In-App Reminders" : "Напоминания"}
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> {isEn ? "Mark all read" : "Прочитать все"}
              </button>
            )}
          </div>
          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto">
            {items.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {isEn ? "No deadline alerts yet. Add deadlines to get 30/14/7/3/1-day reminders." : "Пока нет напоминаний. Добавь дедлайны для алертов за 30/14/7/3/1 дн."}
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markOne(n.id);
                    if (onOpenDeadlines) onOpenDeadlines();
                    setOpen(false);
                  }}
                  className={`w-full rounded-xl border p-2.5 text-left transition-colors ${
                    n.read ? "border-border/60 bg-background opacity-70" : "border-brand/30 bg-accent/30"
                  }`}
                >
                  <p className="text-xs font-bold">{n.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{n.message}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
