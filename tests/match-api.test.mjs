import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../functions/api/match.js", import.meta.url), "utf8");

function loadHandler(fetchImpl) {
  const code = source.replace("export async function onRequestGet", "async function onRequestGet")
    + "\nthis.handler = onRequestGet;";
  const context = { URL, Request, Response, Date, Intl, Number, Object, String, Math, Promise, encodeURIComponent, fetch: fetchImpl };
  vm.runInNewContext(code, context);
  return context.handler;
}
const request = id => new Request("https://example.test/api/match?id=" + encodeURIComponent(id));

test("match endpoint rejects invalid IDs before calling provider", async () => {
  let calls = 0;
  const handler = loadHandler(async () => { calls++; throw new Error("unexpected provider call"); });
  for (const id of ["", "abc", "-1", "1.2", "1234567890123"]) {
    const response = await handler({ request: request(id), env: { API_FOOTBALL_KEY: "test-token" } });
    assert.equal(response.status, 400, `ID should be rejected: ${id}`);
    assert.match((await response.json()).error, /رقم المباراة غير صالح/);
  }
  assert.equal(calls, 0);
});

test("match endpoint requests fixture, events and lineups without exposing key", async () => {
  const secret = "never-return-this-token";
  const urls = [];
  const handler = loadHandler(async (url, options) => {
    urls.push(new URL(url));
    assert.equal(options.headers["x-apisports-key"], secret);
    if (new URL(url).pathname.endsWith("/fixtures/events")) return new Response(JSON.stringify({response:[{type:"Goal",detail:"Normal Goal",time:{elapsed:12},player:{name:"Scorer"},team:{name:"Home"}}]}), {status:200});
    if (new URL(url).pathname.endsWith("/fixtures/lineups")) return new Response(JSON.stringify({response:[{team:{id:1},formation:"4-3-3",startXI:[{player:{id:9,name:"Keeper",number:1,pos:"G",grid:"1:1"}}],substitutes:[]},{team:{id:2},formation:"4-4-2",startXI:[],substitutes:[]}]}), {status:200});
    return new Response(JSON.stringify({response:[{fixture:{id:42,date:"2026-10-28T15:00:00+00:00",status:{short:"FT",elapsed:90},venue:{name:"Ground"}},league:{id:1,name:"League",logo:""},teams:{home:{id:1,name:"Home",logo:"",winner:true},away:{id:2,name:"Away",logo:"",winner:false}},score:{halftime:{home:1,away:0},fulltime:{home:2,away:0}}}]}), {status:200});
  });
  const response = await handler({request:request("42"),env:{API_FOOTBALL_KEY:secret}});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.match.id,42);
  assert.equal(body.match.goals.length,1);
  assert.equal(body.match.homeTeam.lineup[0].name,"Keeper");
  assert.ok(!JSON.stringify(body).includes(secret));
  assert.equal(urls.length,3);
  assert.ok(urls.some(u=>u.pathname.endsWith("/fixtures")&&u.searchParams.get("id")==="42"));
  assert.ok(urls.some(u=>u.pathname.endsWith("/fixtures/events")&&u.searchParams.get("fixture")==="42"));
  assert.ok(urls.some(u=>u.pathname.endsWith("/fixtures/lineups")&&u.searchParams.get("fixture")==="42"));
});

test("missing API-Football key is rejected without provider access", async () => {
  let calls = 0;
  const handler = loadHandler(async () => { calls++; throw new Error("unexpected provider call"); });
  const response = await handler({ request: request("42"), env: { API_FOOTBALL_KEY: "   " } });
  assert.equal(response.status, 503);
  assert.equal(calls, 0);
});

test("provider rate limiting is translated to 429 with Retry-After", async () => {
  const handler = loadHandler(async () => new Response(JSON.stringify({ errors: ["rate limited"] }), { status: 429 }));
  const response = await handler({ request: request("42"), env: { API_FOOTBALL_KEY: "test-token" } });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "300");
});
