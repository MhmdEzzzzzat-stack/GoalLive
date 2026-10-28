export async function onRequestGet({ env }) {
  const token = typeof env?.API_FOOTBALL_KEY === "string"
    ? env.API_FOOTBALL_KEY.trim()
    : "";
  return new Response(JSON.stringify({
    ok: true,
    apiTokenConfigured: token.length > 0,
    checkedAt: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
