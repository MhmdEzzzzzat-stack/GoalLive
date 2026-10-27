import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const matchesSource = await readFile(new URL("../functions/api/matches.js", import.meta.url), "utf8");
const healthSource = await readFile(new URL("../functions/api/health.js", import.meta.url), "utf8");

function appHelpers() {
  const wanted = [
    "const cairoDateKey=",
    "function dateFromCairoKey(",
    "function shiftCairoDate(",
    "function scorePair(",
    "function scoreText(",
    "const fmtDate="
  ];
  const lines = app.split("\n");
  const selected = wanted.map(prefix => {
    const line = lines.find(item => item.trimStart().startsWith(prefix));
    assert.ok(line, `Expected helper in app.js: ${prefix}`);
    return line;
  }).join("\n");
  const context = {};
  vm.runInNewContext(selected + "\nthis.helpers={cairoDateKey,dateFromCairoKey,shiftCairoDate,scorePair,scoreText,fmtDate};", context);
  return context.helpers;
}

function loadHandler(source, exportName, extra = {}) {
  const code = source.replace(new RegExp("export async function " + exportName), "async function " + exportName)
    + `\nthis.handler = ${exportName};`;
  const context = { URL, Request, Response, Date, Intl, Number, Object, String, Math, ...extra };
  vm.runInNewContext(code, context);
  return context.handler;
}

test("missing score is not shown as 0-0; real 0-0 is preserved", () => {
  const { scoreText } = appHelpers();
  assert.equal(scoreText({ status: "IN_PLAY", score: {} }), "—");
  assert.equal(scoreText({ status: "FINISHED", score: { fullTime: { home: 0, away: 0 } } }), "0 - 0");
});

test("regular time, extra time, and penalty shootout scores are selected correctly", () => {
  const { scoreText } = appHelpers();
  assert.equal(scoreText({ status: "FINISHED", score: { regularTime: { home: 1, away: 1 } } }), "1 - 1");
  assert.equal(scoreText({ status: "FINISHED", score: { extraTime: { home: 2, away: 1 } } }), "2 - 1");
  assert.equal(scoreText({ status: "PENALTY_SHOOTOUT", score: {
    fullTime: { home: 1, away: 1 }, penalties: { home: 4, away: 3 }
  } }), "4 - 3");
  assert.equal(scoreText({ status: "FINISHED", score: {
    fullTime: { home: 1, away: 1 }, penalties: { home: 4, away: 3 }
  } }), "1 - 1 (4 - 3 ر.ت)");
});

test("invalid and non-numeric score values are not rendered", () => {
  const { scoreText } = appHelpers();
  assert.equal(scoreText({ status: "FINISHED", score: { fullTime: { home: "1", away: 0 } } }), "—");
  assert.equal(scoreText({ status: "FINISHED", score: { fullTime: { home: NaN, away: 0 } } }), "—");
});

test("Cairo date key and day navigation cross midnight correctly", () => {
  const { cairoDateKey, shiftCairoDate, fmtDate } = appHelpers();
  const beforeCairoMidnight = new Date("2026-10-26T20:59:00Z");
  const afterCairoMidnight = new Date("2026-10-26T21:01:00Z");
  assert.equal(cairoDateKey(beforeCairoMidnight), "2026-10-26");
  assert.equal(cairoDateKey(afterCairoMidnight), "2026-10-27");
  assert.equal(fmtDate(shiftCairoDate(new Date("2026-10-27T12:00:00Z"), -1)), "2026-10-26");
  assert.equal(fmtDate(shiftCairoDate(new Date("2026-10-27T12:00:00Z"), 1)), "2026-10-28");
});

test("API rejects malformed and impossible dates before cache/provider access", async () => {
  let cacheCalls = 0;
  let fetchCalls = 0;
  const handler = loadHandler(matchesSource, "onRequestGet", {
    caches: { default: { match: async () => { cacheCalls++; return null; }, put: async () => {} } },
    fetch: async () => { fetchCalls++; throw new Error("should not fetch"); }
  });
  for (const date of ["", "2026/10/27", "2026-02-30", "2026-13-01", "abc"]) {
    const response = await handler({
      request: new Request("https://example.test/api/matches?date=" + encodeURIComponent(date)),
      env: { FOOTBALL_API_TOKEN: "test-token" }
    });
    assert.equal(response.status, 400, `date should be rejected: ${date}`);
    assert.match((await response.json()).error, /تاريخ غير صالح/);
  }
  assert.equal(cacheCalls, 0);
  assert.equal(fetchCalls, 0);
});

test("health endpoint reports token configuration without exposing token", async () => {
  const handler = loadHandler(healthSource, "onRequestGet");
  const secret = "never-return-this-token";
  const response = await handler({ env: { FOOTBALL_API_TOKEN: secret } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes('"apiTokenConfigured":true'));
  assert.ok(!body.includes(secret));
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("health endpoint treats missing and whitespace-only tokens as unconfigured", async () => {
  const handler = loadHandler(healthSource, "onRequestGet");
  for (const env of [{}, { FOOTBALL_API_TOKEN: "   " }, { FOOTBALL_API_TOKEN: 123 }]) {
    const response = await handler({ env });
    assert.equal((await response.json()).apiTokenConfigured, false);
  }
});
