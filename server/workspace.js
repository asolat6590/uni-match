import { getSessionUser, publicUser, readJsonBody, requirePremium, requireUser, sendJson } from "./auth.js";
import { insertForUser, listForUser, newId, removeForUser, updateForUser, updateUser } from "./db.js";
import { coachEssay } from "./gemini.js";
import { matchVerifiedScholarships, matchVerifiedUniversities, scoreUniversity } from "./matcher.js";
import { VERIFIED_SCHOLARSHIPS, VERIFIED_UNIVERSITIES } from "./verifiedData.js";

const MILESTONE_DAYS = [30, 14, 7, 3, 1, 0];

export function classifyDeadline(dateStr, completed = false, now = new Date()) {
  if (completed) return "Completed";
  if (!dateStr) return "Upcoming";
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Upcoming";
  const diffDays = Math.round((parsed.getTime() - todayUtc) / 86_400_000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays <= 3) return "Urgent";
  if (diffDays <= 14) return "Soon";
  return "Upcoming";
}

export function daysUntilDeadline(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.round((parsed.getTime() - todayUtc) / 86_400_000);
}

export function syncDeadlineNotifications(userId, now = new Date()) {
  const deadlines = listForUser("deadlines", userId);
  const existing = listForUser("notifications", userId);

  for (const dl of deadlines) {
    if (dl.completed || !dl.date) continue;
    const diff = daysUntilDeadline(dl.date, now);
    if (diff === null) continue;

    let milestone = null;
    if (diff < 0) milestone = "overdue";
    else {
      for (const m of MILESTONE_DAYS) {
        if (diff <= m) milestone = `${m}d`;
      }
    }
    if (!milestone) continue;

    const dedupeKey = `${dl.id}:${milestone}`;
    if (existing.some((n) => n.dedupeKey === dedupeKey)) continue;

    const title =
      diff < 0
        ? `Overdue: ${dl.title}`
        : diff === 0
          ? `Due today: ${dl.title}`
          : `Due in ${diff} day(s): ${dl.title}`;

    insertForUser("notifications", userId, {
      dedupeKey,
      deadlineId: dl.id,
      title,
      message: `${dl.universityName || "General"} · ${dl.date}`,
      severity: diff <= 0 ? "urgent" : diff <= 7 ? "soon" : "info",
      read: false,
    });
  }

  return listForUser("notifications", userId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function computeCostSummary({ tuition = 0, living = 0, other = 0, scholarship = 0 }) {
  const t = Math.max(0, Number(tuition) || 0);
  const l = Math.max(0, Number(living) || 0);
  const o = Math.max(0, Number(other) || 0);
  const s = Math.max(0, Number(scholarship) || 0);
  const gross = t + l + o;
  const netFirstYear = Math.max(0, gross - s);
  return { tuition: t, living: l, other: o, scholarship: s, gross, netFirstYear, livingIsEstimate: true };
}

function enrichApplications(userId) {
  const apps = listForUser("applications", userId);
  const tasks = listForUser("tasks", userId);
  const docs = listForUser("documents", userId);
  const essays = listForUser("essays", userId);
  const deadlines = listForUser("deadlines", userId);

  return apps.map((app) => {
    const appTasks = tasks.filter((t) => t.applicationId === app.id);
    const appDocs = docs.filter((d) => d.applicationId === app.id);
    const appEssays = essays.filter((e) => e.applicationId === app.id);
    const appDeadlines = deadlines.filter((d) => d.applicationId === app.id);

    const totalItems = appTasks.length + appDocs.length + (appEssays.length > 0 ? 1 : 0);
    const doneItems =
      appTasks.filter((t) => t.completed).length +
      appDocs.filter((d) => d.status === "completed").length +
      (appEssays.some((e) => e.status === "final") ? 1 : 0);
    const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : app.status === "submitted" ? 100 : 10;

    return {
      ...app,
      progress,
      counts: {
        tasksTotal: appTasks.length,
        tasksDone: appTasks.filter((t) => t.completed).length,
        docsTotal: appDocs.length,
        docsDone: appDocs.filter((d) => d.status === "completed").length,
        essaysCount: appEssays.length,
        deadlinesCount: appDeadlines.length,
      },
    };
  });
}

function buildStrategy(user, lang = "ru") {
  const apps = enrichApplications(user.id);
  const savedUnis = listForUser("savedUniversities", user.id);
  const docs = listForUser("documents", user.id);
  const userSch = listForUser("scholarships", user.id);
  const profile = user.profile || {};

  const targetList = apps.length > 0 ? apps : savedUnis;
  const scored = targetList.map((item) => {
    const uni = VERIFIED_UNIVERSITIES.find((u) => u.id === item.universityId || u.name === item.universityName);
    return uni ? scoreUniversity(profile, uni, lang) : null;
  }).filter(Boolean);

  const tiers = { safety: 0, target: 0, reach: 0 };
  for (const s of scored) tiers[s.fitTier] = (tiers[s.fitTier] || 0) + 1;

  const missingDocs = docs.filter((d) => d.status !== "completed");
  const matchedScholarships = matchVerifiedScholarships(profile, lang).slice(0, 3);

  const recommendations = [];
  if (scored.length === 0) {
    recommendations.push(
      lang === "en"
        ? "Add 3–5 universities to your Application Planner to build a balanced Safety / Target / Reach list."
        : "Добавь 3–5 вузов в планировщик заявок, чтобы сбалансировать Safety / Target / Reach.",
    );
  } else {
    if (tiers.safety === 0) {
      recommendations.push(
        lang === "en"
          ? "Consider adding at least 1 Safety option where your GPA and language scores comfortably exceed verified minimums."
          : "Добавь хотя бы 1 вариант категории Safety, где твои баллы уверенно превышают минимальные требования.",
      );
    }
    if (tiers.reach > tiers.target + tiers.safety) {
      recommendations.push(
        lang === "en"
          ? "Your list is Reach-heavy. Balance it with Target universities to reduce risk."
          : "Список перегружен сложными вузами (Reach). Добавь больше вариантов Target для баланса.",
      );
    }
  }
  if (missingDocs.length > 0) {
    recommendations.push(
      lang === "en"
        ? `Complete ${missingDocs.length} pending document(s) in Document Tracker before upcoming deadlines.`
        : `Подготовь ${missingDocs.length} недостающих документов в трекере документов до ближайших дедлайнов.`,
    );
  }
  if (userSch.length === 0) {
    recommendations.push(
      lang === "en"
        ? "Save relevant verified scholarships in Scholarship Matcher to offset first-year tuition."
        : "Сохрани подходящие стипендии в разделе стипендий, чтобы снизить стоимость первого года.",
    );
  }

  return {
    tiers,
    totalTracked: scored.length,
    missingDocsCount: missingDocs.length,
    topScholarships: matchedScholarships,
    recommendations,
    disclaimer:
      lang === "en"
        ? "UniMatch provides profile alignment insights only and never guarantees admission."
        : "UniMatch оценивает соответствие профиля требованиям и не гарантирует поступление.",
  };
}

export async function handleVerifiedMatch(req, res, env) {
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method", message: "POST only" });
    return;
  }
  const user = getSessionUser(req, env);
  const body = await readJsonBody(req).catch(() => ({}));
  const lang = body.lang === "en" ? "en" : "ru";
  const isPremium = Boolean(user && ["active", "trialing"].includes(user.subscriptionStatus));

  if (user && !isPremium && (user.freeMatchesUsed || 0) >= 1) {
    sendJson(res, 403, {
      error: "free_limit",
      message: lang === "en" ? "Free plan includes 1 match. Upgrade to UniMatch Pro for unlimited matches." : "На тарифе Free доступен 1 подбор. Перейди на UniMatch Pro для безлимитного подбора.",
    });
    return;
  }

  const profile = body.profile || body;
  if (user) {
    updateUser(user.id, {
      profile: { ...(user.profile || {}), ...profile },
      freeMatchesUsed: isPremium ? user.freeMatchesUsed || 0 : (user.freeMatchesUsed || 0) + 1,
    });
  }

  const all = matchVerifiedUniversities(profile, lang);
  const universities = isPremium ? all : all.slice(0, 3);
  sendJson(res, 200, {
    isPremium,
    totalAvailable: all.length,
    universities,
    note:
      lang === "en"
        ? "Match scores reflect verified academic, budget, and program alignment — not admission probability."
        : "Оценка совпадения отражает соответствие профиля проверенным требованиям, а не вероятность поступления.",
  });
}

export async function handleWorkspace(req, res, env, subPath) {
  const user = requirePremium(req, res, env);
  if (!user) return;

  const url = new URL(req.url || "/", "http://localhost");
  const lang = url.searchParams.get("lang") === "en" || req.headers["x-unimatch-lang"] === "en" ? "en" : "ru";

  // 1. Dashboard summary
  if (subPath === "/dashboard" && req.method === "GET") {
    const apps = enrichApplications(user.id);
    const tasks = listForUser("tasks", user.id);
    const docs = listForUser("documents", user.id);
    const essays = listForUser("essays", user.id);
    const savedUnis = listForUser("savedUniversities", user.id);
    const scholarships = listForUser("scholarships", user.id);
    const costs = listForUser("costCalculations", user.id);
    const deadlines = listForUser("deadlines", user.id).map((d) => ({
      ...d,
      status: classifyDeadline(d.date, d.completed),
      daysLeft: daysUntilDeadline(d.date),
    }));
    const notifications = syncDeadlineNotifications(user.id);

    const avgProgress = apps.length
      ? Math.round(apps.reduce((sum, a) => sum + a.progress, 0) / apps.length)
      : 0;

    sendJson(res, 200, {
      user: publicUser(user),
      stats: {
        applicationProgress: avgProgress,
        applicationsCount: apps.length,
        savedUniversitiesCount: savedUnis.length,
        scholarshipsCount: scholarships.length,
        upcomingDeadlinesCount: deadlines.filter((d) => !d.completed).length,
        essaysCount: essays.length,
        docsCompleted: docs.filter((d) => d.status === "completed").length,
        docsMissing: docs.filter((d) => d.status !== "completed").length,
        tasksCompleted: tasks.filter((t) => t.completed).length,
        tasksTotal: tasks.length,
        unreadNotifications: notifications.filter((n) => !n.read).length,
      },
      applications: apps,
      upcomingDeadlines: deadlines.filter((d) => !d.completed).sort((a, b) => (a.date || "").localeCompare(b.date || "")).slice(0, 6),
      importantTasks: tasks.filter((t) => !t.completed).slice(0, 5),
      latestCost: costs[costs.length - 1] || null,
      strategy: buildStrategy(user, lang),
      catalog: VERIFIED_UNIVERSITIES.map((u) => scoreUniversity(user.profile || {}, u, lang)),
    });
    return;
  }

  // 2. Saved Universities & Comparison
  if (subPath === "/saved" && req.method === "GET") {
    const saved = listForUser("savedUniversities", user.id);
    sendJson(res, 200, { items: saved });
    return;
  }
  if (subPath === "/saved" && req.method === "POST") {
    const body = await readJsonBody(req);
    const uni = VERIFIED_UNIVERSITIES.find((u) => u.id === body.universityId);
    if (!uni) return sendJson(res, 404, { error: "not_found", message: "Verified university not found." });
    const existing = listForUser("savedUniversities", user.id).find((s) => s.universityId === uni.id);
    if (existing) return sendJson(res, 200, { item: existing });
    const item = insertForUser("savedUniversities", user.id, {
      universityId: uni.id,
      universityName: uni.name,
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/saved" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("savedUniversities", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 3. Scholarships
  if (subPath === "/scholarships" && req.method === "GET") {
    const matched = matchVerifiedScholarships(user.profile || {}, lang);
    const userRecords = listForUser("scholarships", user.id);
    const byId = Object.fromEntries(userRecords.map((r) => [r.scholarshipId, r]));
    const items = matched.map((sch) => ({
      ...sch,
      userStatus: byId[sch.id]?.status || null,
      recordId: byId[sch.id]?.id || null,
    }));
    sendJson(res, 200, { items });
    return;
  }
  if (subPath === "/scholarships" && req.method === "POST") {
    const body = await readJsonBody(req);
    const sch = VERIFIED_SCHOLARSHIPS.find((s) => s.id === body.scholarshipId);
    if (!sch) return sendJson(res, 404, { error: "not_found", message: "Verified scholarship not found." });
    const status = ["saved", "applied", "completed"].includes(body.status) ? body.status : "saved";
    const existing = listForUser("scholarships", user.id).find((s) => s.scholarshipId === sch.id);
    if (existing) {
      const updated = updateForUser("scholarships", user.id, existing.id, { status });
      return sendJson(res, 200, { item: updated });
    }
    const item = insertForUser("scholarships", user.id, {
      scholarshipId: sch.id,
      title: sch.title.en,
      universityName: sch.universityName,
      status,
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/scholarships" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("scholarships", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 4. Applications (auto-seeds verified documents & deadlines)
  if (subPath === "/applications" && req.method === "GET") {
    sendJson(res, 200, {
      items: enrichApplications(user.id),
      documents: listForUser("documents", user.id),
      tasks: listForUser("tasks", user.id),
      deadlines: listForUser("deadlines", user.id).map((d) => ({ ...d, status: classifyDeadline(d.date, d.completed) })),
      essays: listForUser("essays", user.id),
    });
    return;
  }
  if (subPath === "/applications" && req.method === "POST") {
    const body = await readJsonBody(req);
    const uni = VERIFIED_UNIVERSITIES.find((u) => u.id === body.universityId);
    if (!uni) return sendJson(res, 404, { error: "not_found", message: "Verified university not found." });
    const existing = listForUser("applications", user.id).find((a) => a.universityId === uni.id);
    if (existing) return sendJson(res, 200, { item: existing });

    const appId = newId("app");
    const app = insertForUser("applications", user.id, {
      id: appId,
      universityId: uni.id,
      universityName: uni.name,
      country: uni.country[lang] || uni.country.en,
      program: String(body.program || uni.majors[lang]?.[0] || uni.majors.en[0]),
      intake: String(body.intake || "Fall 2027"),
      status: "planning",
      testsStatus: "pending",
      recommendationsStatus: "pending",
      officialSourceUrl: uni.officialSourceUrl,
    });

    // Seed verified documents
    for (const docTitle of uni.requiredDocuments[lang] || uni.requiredDocuments.en) {
      insertForUser("documents", user.id, {
        applicationId: appId,
        universityName: uni.name,
        title: docTitle,
        status: "missing",
        deadline: uni.deadlines?.[0]?.date || "",
        notes: "",
        officialSourceUrl: uni.officialSourceUrl,
      });
    }

    // Seed verified deadlines
    for (const dl of uni.deadlines || []) {
      insertForUser("deadlines", user.id, {
        applicationId: appId,
        universityName: uni.name,
        title: `${uni.name}: ${dl.label[lang] || dl.label.en}`,
        category: "application",
        date: dl.date,
        completed: false,
        officialSourceUrl: uni.officialSourceUrl,
      });
    }

    syncDeadlineNotifications(user.id);
    sendJson(res, 201, { item: app });
    return;
  }
  if (subPath === "/applications" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const updated = updateForUser("applications", user.id, body.id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.program ? { program: body.program } : {}),
      ...(body.testsStatus ? { testsStatus: body.testsStatus } : {}),
      ...(body.recommendationsStatus ? { recommendationsStatus: body.recommendationsStatus } : {}),
    });
    sendJson(res, updated ? 200 : 404, { item: updated });
    return;
  }
  if (subPath === "/applications" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("applications", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 5. Tasks
  if (subPath === "/tasks" && req.method === "GET") {
    sendJson(res, 200, { items: listForUser("tasks", user.id) });
    return;
  }
  if (subPath === "/tasks" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body.title) return sendJson(res, 400, { error: "invalid", message: "Task title is required." });
    const item = insertForUser("tasks", user.id, {
      title: String(body.title).trim(),
      category: body.category || "documents",
      priority: body.priority || "medium",
      dueDate: body.dueDate || "",
      applicationId: body.applicationId || "",
      universityName: body.universityName || "",
      completed: Boolean(body.completed),
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/tasks" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const updated = updateForUser("tasks", user.id, body.id, {
      ...(typeof body.completed === "boolean" ? { completed: body.completed } : {}),
      ...(body.title ? { title: body.title } : {}),
      ...(body.priority ? { priority: body.priority } : {}),
    });
    sendJson(res, updated ? 200 : 404, { item: updated });
    return;
  }
  if (subPath === "/tasks" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("tasks", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 6. Smart Deadlines
  if (subPath === "/deadlines" && req.method === "GET") {
    const items = listForUser("deadlines", user.id).map((d) => ({
      ...d,
      status: classifyDeadline(d.date, d.completed),
      daysLeft: daysUntilDeadline(d.date),
    }));
    sendJson(res, 200, { items });
    return;
  }
  if (subPath === "/deadlines" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body.title || !body.date) return sendJson(res, 400, { error: "invalid", message: "Title and date are required." });
    const item = insertForUser("deadlines", user.id, {
      title: String(body.title).trim(),
      category: body.category || "application",
      date: String(body.date).slice(0, 10),
      applicationId: body.applicationId || "",
      universityName: body.universityName || "",
      completed: false,
    });
    syncDeadlineNotifications(user.id);
    sendJson(res, 201, { item: { ...item, status: classifyDeadline(item.date, item.completed) } });
    return;
  }
  if (subPath === "/deadlines" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const updated = updateForUser("deadlines", user.id, body.id, {
      ...(typeof body.completed === "boolean" ? { completed: body.completed } : {}),
      ...(body.date ? { date: body.date } : {}),
      ...(body.title ? { title: body.title } : {}),
    });
    sendJson(res, updated ? 200 : 404, {
      item: updated ? { ...updated, status: classifyDeadline(updated.date, updated.completed) } : null,
    });
    return;
  }
  if (subPath === "/deadlines" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("deadlines", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 7. Notifications
  if (subPath === "/notifications" && req.method === "GET") {
    const items = syncDeadlineNotifications(user.id);
    sendJson(res, 200, { items });
    return;
  }
  if (subPath === "/notifications" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    if (body.markAll) {
      for (const n of listForUser("notifications", user.id)) {
        updateForUser("notifications", user.id, n.id, { read: true });
      }
      return sendJson(res, 200, { items: listForUser("notifications", user.id) });
    }
    const updated = updateForUser("notifications", user.id, body.id, { read: true });
    sendJson(res, updated ? 200 : 404, { item: updated });
    return;
  }

  // 8. Documents
  if (subPath === "/documents" && req.method === "GET") {
    sendJson(res, 200, { items: listForUser("documents", user.id) });
    return;
  }
  if (subPath === "/documents" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body.title) return sendJson(res, 400, { error: "invalid", message: "Document title is required." });
    const item = insertForUser("documents", user.id, {
      applicationId: body.applicationId || "",
      universityName: body.universityName || "General",
      title: String(body.title).trim(),
      status: body.status || "missing",
      deadline: body.deadline || "",
      notes: body.notes || "",
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/documents" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const updated = updateForUser("documents", user.id, body.id, {
      ...(body.status ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.deadline !== undefined ? { deadline: body.deadline } : {}),
    });
    sendJson(res, updated ? 200 : 404, { item: updated });
    return;
  }
  if (subPath === "/documents" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("documents", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 9. Cost Calculator
  if (subPath === "/costs" && req.method === "GET") {
    sendJson(res, 200, { items: listForUser("costCalculations", user.id) });
    return;
  }
  if (subPath === "/costs" && req.method === "POST") {
    const body = await readJsonBody(req);
    const summary = computeCostSummary(body);
    const item = insertForUser("costCalculations", user.id, {
      label: String(body.label || body.universityName || "Calculation").trim(),
      universityId: body.universityId || "",
      universityName: body.universityName || "",
      ...summary,
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/costs" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("costCalculations", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  // 10. Essays & AI Essay Coach
  if (subPath === "/essays" && req.method === "GET") {
    sendJson(res, 200, { items: listForUser("essays", user.id) });
    return;
  }
  if (subPath === "/essays" && req.method === "POST") {
    const body = await readJsonBody(req);
    const item = insertForUser("essays", user.id, {
      title: String(body.title || "Personal Statement Draft").trim(),
      applicationId: body.applicationId || "",
      universityName: body.universityName || "",
      prompt: body.prompt || "",
      content: body.content || "",
      status: body.status || "draft",
      lastFeedback: body.lastFeedback || null,
    });
    sendJson(res, 201, { item });
    return;
  }
  if (subPath === "/essays" && req.method === "PATCH") {
    const body = await readJsonBody(req);
    const updated = updateForUser("essays", user.id, body.id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.prompt !== undefined ? { prompt: body.prompt } : {}),
      ...(body.content !== undefined ? { content: body.content } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.lastFeedback !== undefined ? { lastFeedback: body.lastFeedback } : {}),
    });
    sendJson(res, updated ? 200 : 404, { item: updated });
    return;
  }
  if (subPath === "/essays" && req.method === "DELETE") {
    const id = url.searchParams.get("id") || "";
    const ok = removeForUser("essays", user.id, id);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }
  if (subPath === "/essays/coach" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const feedback = await coachEssay({ ...body, lang }, env);
      if (body.essayId) {
        updateForUser("essays", user.id, body.essayId, { lastFeedback: feedback });
      }
      sendJson(res, 200, { feedback });
    } catch (error) {
      sendJson(res, error.status || 500, { error: error.code || "coach_failed", message: error.message });
    }
    return;
  }

  // 11. Strategy
  if (subPath === "/strategy" && req.method === "GET") {
    sendJson(res, 200, buildStrategy(user, lang));
    return;
  }

  sendJson(res, 404, { error: "not_found", message: "Workspace endpoint not found." });
}
