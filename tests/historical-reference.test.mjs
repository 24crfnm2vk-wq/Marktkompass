import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const stateMatch = app.match(/const REFERENCE_STATES = new Set\((\[[\s\S]*?\])\);/);
assert.ok(stateMatch, "REFERENCE_STATES muss vorhanden sein");
const states = new Function("return new Set(" + stateMatch[1] + ")")();

const start = app.indexOf("    let reference='';");
const end = app.indexOf("    const distance=Number(s.distance);", start);
assert.ok(start >= 0 && end > start, "Referenz-Ausgabeblock muss vorhanden sein");
const renderBlock = app.slice(start, end);
const renderReference = new Function("s", "REFERENCE_STATES", `
  const showReference = REFERENCE_STATES.has(s.state);
  const formatPercent = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? "–" : \`\${Number(value)>0?"+":""}\${Number(value).toFixed(2)} %\`;
  const formatNumber = value => value === null || value === undefined || !Number.isFinite(Number(value)) ? "–" : Number(value).toFixed(2);
  ${renderBlock}
  return reference;
`);

const sample = {
  found: true,
  date: "2020-03-16",
  stressStart: "2020-02-24",
  stressLevel: 45,
  acwiChangeSinceStart: -20,
  distanceToSma200: -12,
  vix: 82.69
};

test("alle acht Stress- und Erholungszustände bleiben referenzfähig", () => {
  for (const state of [
    "STABILISIERUNG", "ERSTE VERBESSERUNG", "STRUKTURELLE VERBESSERUNG",
    "ERHOLUNG BESTÄTIGT", "STRESS", "STRESS HOCH", "STRESS EXTREM",
    "AUSSERGEWÖHNLICHER STRESS"
  ]) assert.equal(states.has(state), true, state);
  assert.equal(states.size, 8);
});

test("Normalzustand zeigt keine historische Referenz", () => {
  assert.equal(renderReference({ state: "NORMAL", historicalReference: sample }, states), "");
});

test("Stress und bestätigte Erholung zeigen den historischen Referenzfall", () => {
  for (const state of ["STRESS", "STRESS HOCH", "ERHOLUNG BESTÄTIGT"]) {
    const html = renderReference({ state, historicalReference: sample }, states);
    assert.match(html, /Historischer Referenzverlauf/);
    assert.match(html, /2020-03-16/);
    assert.match(html, /Stressereignis begann/);
    assert.match(html, /VIX: 82\.69 Punkte/);
  }
});

test("bei fehlendem Treffer erscheint der vorgesehene Hinweis", () => {
  const html = renderReference(
    { state: "STABILISIERUNG", historicalReference: { found: false } },
    states
  );
  assert.match(html, /Kein vergleichbarer Fall für diese Situation gefunden/);
});
