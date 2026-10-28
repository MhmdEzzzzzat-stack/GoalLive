export async function onRequestGet({request,env}) {
  const token=typeof env?.FOOTBALL_API_TOKEN==="string"?env.FOOTBALL_API_TOKEN.trim():"";
  if(!token)return json({error:"مفتاح البيانات غير مضبوط. أضف FOOTBALL_API_TOKEN في إعدادات Cloudflare Pages."},503);

  const url=new URL(request.url),date=url.searchParams.get("date");
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"تاريخ غير صالح."},400);
  const selected=new Date(date+"T00:00:00Z");
  if(Number.isNaN(selected.getTime())||selected.toISOString().slice(0,10)!==date)return json({error:"تاريخ غير صالح."},400);

  // Share one provider response across every date in the same 7-day bucket.
  // The extra day on either side covers fixtures crossing Cairo/UTC date boundaries.
  const dayNumber=Math.floor(selected.getTime()/86400000);
  const bucketStart=Math.floor(dayNumber/7)*7;
  const from=new Date((bucketStart-1)*86400000);
  const to=new Date((bucketStart+8)*86400000);
  const fromKey=from.toISOString().slice(0,10),toKey=to.toISOString().slice(0,10);
  const cacheKey=new Request(url.origin+"/api/matches-week-cache-v1?from="+fromKey+"&to="+toKey);
  const edgeCache=caches.default;
  let providerMatches=null;

  try {
    const cached=await edgeCache.match(cacheKey);
    if(cached) {
      const payload=await cached.json();
      if(Array.isArray(payload.matches))providerMatches=payload.matches;
    }
  } catch {}

  if(!providerMatches) {
    const api="https://api.football-data.org/v4/matches?dateFrom="+fromKey+"&dateTo="+toKey;
    try {
      const r=await fetch(api,{headers:{"X-Auth-Token":token,Accept:"application/json"}});
      const data=await r.json().catch(()=>({}));
      if(!r.ok) {
        const message=r.status===429?"تم تجاوز حد الطلبات المجانية. حاول لاحقًا.":r.status===403?"المفتاح غير صالح أو البطولة غير متاحة في خطتك.":"تعذر جلب البيانات من المزوّد.";
        return json({error:message,providerStatus:r.status},r.status===429?429:502,r.status===429?{"Retry-After":"300","Cache-Control":"no-store"}:{});
      }
      providerMatches=Array.isArray(data.matches)?data.matches:[];
      const cachePayload=json({matches:providerMatches},200,{"Cache-Control":"public, max-age=0, s-maxage=600"});
      try { await edgeCache.put(cacheKey,cachePayload); } catch {}
    } catch {
      return json({error:"تعذر الاتصال بمصدر المباريات."},502);
    }
  }

  const matches=providerMatches.filter(m=>m.utcDate&&cairoDateKey(new Date(m.utcDate))===date);
  return json({date,matches,count:matches.length,updatedAt:new Date().toISOString()},200,{"Cache-Control":"public, max-age=20, s-maxage=90, stale-while-revalidate=180"});
}

function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
}
function cairoDateKey(date) {
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const values=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
