import { VERIFIED_SCHOLARSHIPS, VERIFIED_UNIVERSITIES } from "./verifiedData.js";

export function parseGpa(value) {
  const match = String(value ?? "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  // Normalize 5-point or 100-point scales gently if entered
  if (num > 5 && num <= 100) return Number(((num / 100) * 4).toFixed(2));
  if (num > 4 && num <= 5) return Number(((num / 5) * 4).toFixed(2));
  return Number(num.toFixed(2));
}

export function parseIelts(value) {
  const source = String(value ?? "");
  const ieltsMatch = source.match(/ielts\s*(\d+(?:[.,]\d+)?)/i);
  if (ieltsMatch) {
    const n = Number(ieltsMatch[1].replace(",", "."));
    return Number.isFinite(n) && n > 0 && n <= 9 ? n : null;
  }
  const toeflMatch = source.match(/toefl\s*(\d+)/i);
  if (toeflMatch) {
    const t = Number(toeflMatch[1]);
    if (t >= 110) return 8.0;
    if (t >= 100) return 7.0;
    if (t >= 88) return 6.5;
    if (t >= 79) return 6.0;
    return 5.5;
  }
  const plain = source.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!plain) return null;
  const n = Number(plain[1]);
  if (n > 0 && n <= 9) return n;
  if (n >= 40 && n <= 120) {
    if (n >= 100) return 7.0;
    if (n >= 88) return 6.5;
    if (n >= 79) return 6.0;
    return 5.5;
  }
  return null;
}

export function parseBudgetUsd(value) {
  const num = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(num) && num >= 500 ? num : null;
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function scoreUniversity(profile = {}, uni, lang = "ru") {
  const userGpa = parseGpa(profile.gpa);
  const userIelts = parseIelts(profile.test);
  const budget = parseBudgetUsd(profile.budget);
  const majorQuery = String(profile.major || "").trim().toLowerCase();
  const countryQuery = String(profile.country || "").trim().toLowerCase();
  const degree = profile.degree || "";

  // 1. Academic Fit (0 - 100)
  let academicFit = 72;
  const reasons = [];
  const missingRequirements = [];

  if (userGpa != null) {
    const diff = userGpa - uni.minGpa;
    academicFit = clamp(75 + diff * 40, 25, 99);
    if (diff >= 0.25) {
      reasons.push(
        lang === "en"
          ? `Your GPA (${userGpa}) exceeds the verified reference minimum (${uni.minGpa}).`
          : `Твой GPA (${userGpa}) выше минимального ориентира (${uni.minGpa}).`,
      );
    } else if (diff >= -0.05) {
      reasons.push(
        lang === "en"
          ? `Your GPA (${userGpa}) aligns closely with the verified requirement (${uni.minGpa}).`
          : `Твой GPA (${userGpa}) соответствует требованиям вуза (${uni.minGpa}).`,
      );
    } else {
      missingRequirements.push(
        lang === "en"
          ? `GPA gap: ${userGpa} vs verified reference ${uni.minGpa}.`
          : `Ниже ориентира по GPA: ${userGpa} при требовании ${uni.minGpa}.`,
      );
    }
  }

  if (userIelts != null) {
    const engDiff = userIelts - uni.minIelts;
    academicFit = clamp(academicFit * 0.7 + clamp(75 + engDiff * 25, 25, 99) * 0.3);
    if (engDiff >= 0) {
      reasons.push(
        lang === "en"
          ? `English score (~IELTS ${userIelts}) meets the minimum (${uni.minIelts}).`
          : `Уровень английского (~IELTS ${userIelts}) покрывает минимум (${uni.minIelts}).`,
      );
    } else {
      missingRequirements.push(
        lang === "en"
          ? `English score below minimum: ~IELTS ${userIelts} vs ${uni.minIelts} required.`
          : `Английский ниже минимума: ~IELTS ${userIelts} при требовании ${uni.minIelts}.`,
      );
    }
  }

  // 2. Budget Fit (0 - 100)
  let budgetFit = 70;
  if (budget != null) {
    const ratio = budget / uni.tuitionAnnualUsd;
    budgetFit = clamp(ratio >= 1 ? 85 + Math.min(15, (ratio - 1) * 20) : ratio * 80, 20, 99);
    if (ratio >= 1) {
      reasons.push(
        lang === "en"
          ? `Annual tuition (~$${uni.tuitionAnnualUsd.toLocaleString()}) fits within your $${budget.toLocaleString()} budget.`
          : `Стоимость обучения (~$${uni.tuitionAnnualUsd.toLocaleString()}/год) укладывается в твой бюджет $${budget.toLocaleString()}.`,
      );
    } else {
      missingRequirements.push(
        lang === "en"
          ? `Tuition (~$${uni.tuitionAnnualUsd.toLocaleString()}) exceeds stated budget ($${budget.toLocaleString()}) — scholarships recommended.`
          : `Обучение (~$${uni.tuitionAnnualUsd.toLocaleString()}) выше бюджета ($${budget.toLocaleString()}) — стоит рассмотреть стипендии.`,
      );
    }
  }

  // 3. Program Fit (0 - 100)
  let programFit = 75;
  const majorsList = [...(uni.majors.en || []), ...(uni.majors.ru || [])].map((m) => m.toLowerCase());
  if (majorQuery) {
    const matchedMajor = majorsList.some((m) => m.includes(majorQuery) || majorQuery.includes(m));
    if (matchedMajor) {
      programFit = 94;
      reasons.push(
        lang === "en"
          ? `Offers verified programs matching "${profile.major}".`
          : `Есть проверенные программы по направлению «${profile.major}».`,
      );
    } else {
      programFit = 58;
    }
  }
  if (countryQuery) {
    const cEn = uni.country.en.toLowerCase();
    const cRu = uni.country.ru.toLowerCase();
    if (cEn.includes(countryQuery) || cRu.includes(countryQuery) || countryQuery.includes(cEn) || countryQuery.includes(cRu)) {
      programFit = clamp(programFit + 6, 0, 99);
      reasons.push(
        lang === "en"
          ? `Matches your preferred destination (${uni.country.en}).`
          : `Совпадает с выбранной страной (${uni.country.ru}).`,
      );
    } else {
      programFit = clamp(programFit - 12, 25, 99);
    }
  }
  if (degree && !uni.degrees.includes(degree)) {
    programFit = clamp(programFit - 20, 20, 99);
  }

  const matchScore = clamp(academicFit * 0.4 + budgetFit * 0.3 + programFit * 0.3);

  // Fit Tier (Safety / Target / Reach) — strictly profile alignment, NOT admission probability
  let fitTier = "target";
  if (missingRequirements.length > 0 || academicFit < 65) {
    fitTier = "reach";
  } else if (academicFit >= 84 && budgetFit >= 78) {
    fitTier = "safety";
  }

  const nextDeadline = uni.deadlines?.[0]
    ? `${uni.deadlines[0].date} (${uni.deadlines[0].label[lang] || uni.deadlines[0].label.en})`
    : lang === "en"
      ? "Information not verified"
      : "Информация не проверена";

  return {
    id: uni.id,
    name: uni.name,
    country: uni.country[lang] || uni.country.en,
    city: uni.city[lang] || uni.city.en,
    rank: uni.rank,
    officialSourceUrl: uni.officialSourceUrl,
    housingUrl: uni.housingUrl,
    housingInfo: uni.housingInfo[lang] || uni.housingInfo.en,
    tuitionDisplay: uni.tuitionDisplay,
    tuitionAnnualUsd: uni.tuitionAnnualUsd,
    livingAnnualUsdEstimate: uni.livingAnnualUsdEstimate,
    livingIsEstimate: true,
    minGpa: uni.minGpa,
    minIelts: uni.minIelts,
    minToefl: uni.minToefl,
    majors: uni.majors[lang] || uni.majors.en,
    requirements: uni.requirements[lang] || uni.requirements.en,
    requiredDocuments: uni.requiredDocuments[lang] || uni.requiredDocuments.en,
    deadlines: uni.deadlines.map((d) => ({ label: d.label[lang] || d.label.en, date: d.date })),
    nextDeadline,
    matchScore,
    academicFit,
    budgetFit,
    programFit,
    fitTier,
    reasons,
    missingRequirements,
  };
}

export function matchVerifiedUniversities(profile = {}, lang = "ru") {
  const scored = VERIFIED_UNIVERSITIES.map((uni) => scoreUniversity(profile, uni, lang)).sort(
    (a, b) => b.matchScore - a.matchScore,
  );
  return scored;
}

export function matchVerifiedScholarships(profile = {}, lang = "ru") {
  const userGpa = parseGpa(profile.gpa);
  const userIelts = parseIelts(profile.test);
  const countryQuery = String(profile.country || "").trim().toLowerCase();
  const degree = profile.degree || "";

  return VERIFIED_SCHOLARSHIPS.map((sch) => {
    let score = 74;
    const reasons = [];

    if (userGpa != null) {
      if (userGpa >= sch.minGpa) {
        score += 12;
        reasons.push(
          lang === "en"
            ? `Your GPA (${userGpa}) meets the scholarship benchmark (${sch.minGpa}).`
            : `Твой GPA (${userGpa}) соответствует порогу стипендии (${sch.minGpa}).`,
        );
      } else {
        score -= 15;
      }
    }

    if (userIelts != null && userIelts >= sch.minIelts) {
      score += 6;
    }

    if (degree && sch.degrees.includes(degree)) {
      score += 6;
      reasons.push(
        lang === "en"
          ? `Open to your target degree level (${degree}).`
          : `Подходит для твоего уровня обучения (${degree}).`,
      );
    } else if (degree && !sch.degrees.includes(degree)) {
      score -= 22;
    }

    if (countryQuery) {
      const cEn = sch.country.en.toLowerCase();
      const cRu = sch.country.ru.toLowerCase();
      if (cEn.includes(countryQuery) || cRu.includes(countryQuery)) {
        score += 8;
        reasons.push(
          lang === "en"
            ? `Located in your preferred country (${sch.country.en}).`
            : `Находится в выбранной стране (${sch.country.ru}).`,
        );
      }
    }

    if (reasons.length === 0) {
      reasons.push(
        lang === "en"
          ? `Verified international funding opportunity at ${sch.universityName}.`
          : `Проверенная стипендиальная программа в ${sch.universityName}.`,
      );
    }

    return {
      id: sch.id,
      universityId: sch.universityId,
      universityName: sch.universityName,
      country: sch.country[lang] || sch.country.en,
      title: sch.title[lang] || sch.title.en,
      amountDisplay: sch.amountDisplay,
      amountUsdEstimate: sch.amountUsdEstimate,
      isEstimateAmount: sch.isEstimateAmount,
      deadline: sch.deadline || (lang === "en" ? "Information not verified" : "Информация не проверена"),
      rawDeadline: sch.deadline,
      degrees: sch.degrees,
      minGpa: sch.minGpa,
      minIelts: sch.minIelts,
      eligibility: sch.eligibility[lang] || sch.eligibility.en,
      officialSourceUrl: sch.officialSourceUrl,
      matchScore: clamp(score, 25, 99),
      whyMatches: reasons,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
