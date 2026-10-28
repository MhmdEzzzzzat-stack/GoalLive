export async function onRequestGet({ request, env }) {
  const token = typeof env?.FOOTBALL_API_TOKEN === "string" ? env.FOOTBALL_API_TOKEN.trim() : "";
  if (!token) {
    return json({
      error: "مفتاح البيانات غير مضبوط. أضف FOOTBALL_API_TOKEN في إعدادات Cloudflare Pages."
    }, 503);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  // Match IDs from football-data.org are numeric. Keep this regex as \d in JS.
  if (!id || !/^\d{1,12}$/.test(id)) {
    return json({ error: "رقم المباراة غير صالح." }, 400);
  }

  try {
    const providerUrl = new URL(`https://api.football-data.org/v4/matches/${id}`);
    const response = await fetch(providerUrl.toString(), {
      headers: {
        "X-Auth-Token": token,
        "Accept": "application/json",
        "X-Unfold-Lineups": "true",
        "X-Unfold-Goals": "true",
        "X-Unfold-Bookings": "true",
        "X-Unfold-Subs": "true"
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerStatus = response.status;
      const message = providerStatus === 404
        ? "لم يتم العثور على المباراة."
        : providerStatus === 429
          ? "تم تجاوز حد الطلبات. انتظر قليلًا ثم حاول مرة أخرى."
          : providerStatus === 403
            ? "المزوّد رفض الطلب. تحقق من صلاحية المفتاح والخطة وتغطية البطولة."
            : providerStatus === 400
              ? "رفض المزوّد معرّف المباراة أو صيغة الطلب."
              : "تعذر جلب تفاصيل المباراة من المزوّد.";
      const status = providerStatus === 404 ? 404
        : providerStatus === 429 ? 429
          : providerStatus === 403 ? 403
            : providerStatus === 400 ? 400 : 502;
      const headers = providerStatus === 429 ? { "Retry-After": "300" } : {};
      return json({ error: message, providerStatus }, status, headers);
    }

    const match = data && String(data.id) === id ? data : (data.matches || []).find(item => String(item.id) === id);
    if (!match) {
      return json({
        error: "لم يُرجع المزوّد بيانات لهذه المباراة.",
        providerStatus: response.status
      }, 404);
    }

    const homeLineups = Array.isArray(match.homeTeam?.lineup) ? match.homeTeam.lineup.length : 0;
    const awayLineups = Array.isArray(match.awayTeam?.lineup) ? match.awayTeam.lineup.length : 0;
    const eventsCount = ["goals", "bookings", "substitutions"].reduce((total, key) =>
      total + (Array.isArray(match[key]) ? match[key].length : 0), 0);

    return json({
      match,
      diagnostics: {
        lineupsAvailable: homeLineups > 0 || awayLineups > 0,
        homeLineupCount: homeLineups,
        awayLineupCount: awayLineups,
        eventsAvailable: eventsCount > 0,
        eventsCount,
        note: homeLineups || eventsCount
          ? null
          : "المزوّد لم يُرجع بيانات التشكيلات أو الأحداث. قد تكون الخطة أو تغطية هذه المباراة لا تتضمنها."
      },
      updatedAt: new Date().toISOString()
    }, 200, { "Cache-Control": "public, max-age=30, s-maxage=30" });
  } catch {
    return json({ error: "تعذر الاتصال بمصدر تفاصيل المباراة." }, 502);
  }
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}
