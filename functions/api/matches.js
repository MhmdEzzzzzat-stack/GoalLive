export async function onRequestGet({request,env}) {
const token=env.FOOTBALL_API_TOKEN;
  if(!token)return json({error:"مفتاح البيانات غير مضبوط. أضف FOOTBALL_API_TOKEN في إعدادات Cloudflare Pages."},503);
  const url=new URL(request.url),date=url.searchParams.get("date");
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"تاريخ غير صالح."},400);
  const parsedDate=new Date(date+"T00:00:00Z");
  if(Number.isNaN(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date)return json({error:"تاريخ غير صالح."},400);
  // Keep existing cache windows until the deployed provider plan and quota are verified.
  const cacheKey = new Request(url.origin+"/api/matches-cache?date="+encodeURIComponent(date));
  const edgeCache = caches.default;
  try { const cachedResponse = await edgeCache.match(cacheKey); if (cachedResponse) return cachedResponse; } catch {}

  const center=new Date(`${date}T12:00:00Z`),from=new Date(center),to=new Date(center);
  from.setUTCDate(from.getUTCDate()-1);to.setUTCDate(to.getUTCDate()+1);
  const api=`https://api.football-data.org/v4/matches?dateFrom=${from.toISOString().slice(0,10)}&dateTo=${to.toISOString().slice(0,10)}`;
  try{
    const r=await fetch(api,{headers:{"X-Auth-Token":token,Accept:"application/json"}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){
      const message=r.status===429?"تم تجاوز حد الطلبات المجانية. حاول لاحقًا.":r.status===403?"المفتاح غير صالح أو البطولة غير متاحة في خطتك.":"تعذر جلب البيانات من المزوّد.";
      return json({error:message,providerStatus:r.status},r.status===429?429:502,r.status===429?{"Retry-After":"300","Cache-Control":"no-store"}:{});
    }
    const matches=(data.matches||[]).filter(m=>m.utcDate&&cairoDateKey(new Date(m.utcDate))===date);
    const response = json({date,matches,count:matches.length,updatedAt:new Date().toISOString()},200,{"Cache-Control":"public, max-age=20, s-maxage=90, stale-while-revalidate=180"});
    try { await edgeCache.put(cacheKey, response.clone()); } catch {}
    return response;
  }catch{return json({error:"تعذر الاتصال بمصدر المباريات."},502)}
}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}})}

function cairoDateKey(date){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);const values=Object.fromEntries(parts.filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));return `${values.year}-${values.month}-${values.day}`}
