import assert from "node:assert/strict";
import { catalogFit } from "../src/fit.js";
import { matchProfile, normalizeMatch, normalizeProfile, parseModelText } from "./gemini.js";

const profile = normalizeProfile({
  lang: "ru",
  name: "Асолат",
  email: "a@b.co",
  major: "CS",
  country: "Канада",
  gpa: "3.4",
  test: "IELTS 6.5",
  budget: "$20,000",
});
assert.equal(profile.major, "CS");
assert.equal(profile.lang, "ru");

assert.throws(() => normalizeProfile({ name: "A", email: "bad", lang: "en" }), (error) => error.status === 400);

const parsed = parseModelText(`\`\`\`json
{"summary":"Подходит Канада","universities":[{"name":"University of Toronto","country":"Канада","city":"Торонто","fit":"reach","fitScore":140,"why":"Высокий конкурс","major":"Computer Science","tuition":"$45,000","nextStep":"Сдать IELTS","requirements":["эссе","аттестат"]}]}
\`\`\``);
const match = normalizeMatch(parsed, "ru");
assert.equal(match.universities[0].fitScore, 100);
assert.equal(match.universities[0].fit, "reach");
assert.equal(match.summary, "Подходит Канада");
assert.equal(match.universities[0].website, "");

const withSite = normalizeMatch(
  {
    summary: "ok",
    universities: [
      {
        name: "University of Amsterdam",
        country: "Netherlands",
        city: "Amsterdam",
        fit: "match",
        fitScore: 80,
        why: "fits",
        major: "CS",
        tuition: "€15,000",
        nextStep: "apply",
        website: "https://www.uva.nl/en",
        estimate: "Стоимость — типичный диапазон",
      },
    ],
  },
  "ru",
);
assert.equal(withSite.universities[0].website, "https://www.uva.nl/en");
assert.equal(withSite.universities[0].estimate, "Стоимость — типичный диапазон");

assert.equal(
  catalogFit({ gpa: "3.0 / 4.0", test: "IELTS 6.0", budget: "$10000" }, { gpa: "3.8 / 4.0", tests: "IELTS 7.0", tuition: "SGD 30,000" }),
  "reach",
);
assert.equal(
  catalogFit({ gpa: "3.2", test: "IELTS 6.5", budget: "$8000" }, { gpa: "3.0 / 4.0", tests: "IELTS 6.5", tuition: "$33,000" }),
  "budget",
);
assert.equal(catalogFit({ gpa: "", test: "", budget: "" }, { gpa: "3.6 / 4.0", tests: "IELTS 6.5", tuition: "$45,000" }), null);

await assert.rejects(
  () => matchProfile({ name: "Asolatkhon", email: "a@b.co", lang: "ru", action: "compare", selected: [{ name: "Only one" }] }, { GEMINI_API_KEY: "test" }),
  (error) => error.code === "invalid",
);

await assert.rejects(
  () => matchProfile({ name: "Asolatkhon", email: "a@b.co", lang: "ru" }, {}),
  (error) => error.code === "missing_key",
);

console.log("gemini helpers ok");
