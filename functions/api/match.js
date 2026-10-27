export async function onRequestGet({ request, env }) {
  const token = env.FOOTBALL_API_TOKEN;
  if (!token) {
    return json({
      error: "مفتاح البيانات غير مضبوط. أضف FOOTBALL_API_TOKEN في إعدادات Cloudflare Pages."
    }, 503);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^\d{1,12}$/.test(id)) {
    return json({ error: "رقم المباراة غير صالح." }, 400);
  }

  try {
    const response = await fetch(`https://api.football-data.org/v4/matches/${id}`, {
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
      const message = response.status === 404
        ? "لم يتم العثور على المباراة."
        : response.status === 429
          ? "تم تجاوز حد الطلبات. حاول مرة أخرى لاحقًا."
          : response.status === 403
            ? "التفاصيل غير متاحة بالمفتاح أو الخطة الحالية."
            : "تعذر جلب تفاصيل المباراة من المزوّد.";
      const status = response.status === 404 ? 404 : response.status === 429 ? 429 : response.status === 403 ? 403 : 502;
      return json({ error: message, providerStatus: response.status }, status);
    }

    const match = data.match || data;
    if (!match || !match.id) {
      return json({ error: "استجابة تفاصيل المباراة غير مكتملة." }, 502);
    }

    return json(
      { match, updatedAt: new Date().toISOString() },
      200,
      { "Cache-Control": "public, max-age=30, s-maxage=30" }
    );
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
