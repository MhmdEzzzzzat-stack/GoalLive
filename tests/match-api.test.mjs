import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../functions/api/match.js", import.meta.url), "utf8");

function loadHandler(fetchImpl) {
  const code = source.replace("export async function onRequestGet", "async function onRequestGet")
    + "\nthis.handler = onRequestGet;";
  const context = { URL, Request, Response, Date, Intl, Number, Object, String, Math, fetch: fetchImpl };
  vm.runInNewContext(code, context);
  return context.handler;
}

const request = id => new Request("https://example.test/api/match?id=" + encodeURIComponent(id));

test("match endpoint rejects invalid IDs before calling provider", async () => {
  let calls = 0;
  const handler = loadHandler(async () => { calls++; throw new Error("unexpected provider call"); });
  for (const id of ["", "abc", "-1", "1.2", "1234567890123"]) {
    const response = await handler({ request: request(id), env: { FOOTBALL_API_TOKEN: "test-token" } });
    assert.equal(response.status, 400, `ID should be rejected: ${id}`);
    assert.match((await response.json()).error, /رقم المباراة غير صالح/);
  }
  assert.equal(calls, 0);
});

test("match endpoint requests the selected ID and does not expose the token", async () => {
  const secret = "never-return-this-token";
  let calledUrl;
  let calledOptions;
  const handler = loadHandler(async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return new Response(JSON.stringify({ matches: [{ id: 42, homeTeam: { name: "Home" }, awayTeam: { name: "Away" } }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
  const response = await handler({ request: request("42"), env: { FOOTBALL_API_TOKEN: secret } });
  assert.equal(response.status, 200);
  const body = await response.text();
  assert.ok(body.includes('"id":42'));
  assert.ok(!body.includes(secret));
  assert.equal(new URL(calledUrl).pathname, "/v4/matches");
  assert.equal(new URL(calledUrl).searchParams.get("ids"), "42");
  assert.equal(calledOptions.headers["X-Auth-Token"], secret);
  assert.equal(calledOptions.headers["X-Unfold-Lineups"], "true");
});

test("missing token is rejected without provider access", async () => {
  let calls = 0;
  const handler = loadHandler(async () => { calls++; throw new Error("unexpected provider call"); });
  const response = await handler({ request: request("42"), env: { FOOTBALL_API_TOKEN: "   " } });
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("unexpected provider call"));
  assert.equal(calls, 0);
});

test("provider rate limiting is translated to 429 with Retry-After", async () => {
  const handler = loadHandler(async () => new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }));
  const response = await handler({ request: request("42"), env: { FOOTBALL_API_TOKEN: "test-token" } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "300");
  assert.match((await response.json()).error, /حد الطلبات/);
});
