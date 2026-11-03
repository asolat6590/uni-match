function gpaScore(value) {
  const match = String(value ?? "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0 || number > 5) return null;
  return number;
}

function ieltsScore(value) {
  const source = String(value ?? "");
  const labeled = source.match(/ielts\s*(\d+(?:[.,]\d+)?)/i);
  const raw = labeled ? labeled[1] : source;
  const match = String(raw).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0 || number > 9) return null;
  return number;
}

function money(value) {
  const number = Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(number) || number < 500) return null;
  return number;
}

function tuitionLow(value) {
  const numbers = String(value ?? "")
    .replace(/[, ]/g, "")
    .match(/\d+(?:\.\d+)?/g);
  if (!numbers) return null;
  const amounts = numbers.map(Number).filter((item) => item >= 500).sort((a, b) => a - b);
  return amounts[0] ?? null;
}

export function catalogFit(form, uni) {
  const userGpa = gpaScore(form?.gpa);
  const userIelts = ieltsScore(form?.test);
  const budget = money(form?.budget);
  const minGpa = gpaScore(uni?.gpa);
  const minIelts = ieltsScore(uni?.tests);
  const tuition = tuitionLow(uni?.tuition);

  if (userGpa == null && userIelts == null && budget == null) return null;

  const weakGrades = (userGpa != null && minGpa != null && userGpa + 0.05 < minGpa) || (userIelts != null && minIelts != null && userIelts + 0.1 < minIelts);
  const overBudget = budget != null && tuition != null && budget < tuition * 0.85;

  if (overBudget && !weakGrades) return "budget";
  if (weakGrades || overBudget) return "reach";
  if (userGpa != null && minGpa != null && userIelts != null && minIelts != null && userGpa >= minGpa + 0.3 && userIelts >= minIelts) {
    return "safety";
  }
  if (userGpa != null && minGpa != null && userGpa >= minGpa + 0.3 && userIelts == null) return "safety";
  return "match";
}

const SAVED_KEY = "unimatch-saved";

export function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function storeSaved(list) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 12)));
}
