export async function onRequestGet({request,env}) {
  const token=typeof env?.API_FOOTBALL_KEY==="string"?env.API_FOOTBALL_KEY.trim():"";
  if(!token)return json({error:"مفتاح API-Football غير مضبوط. أضف API_FOOTBALL_KEY في إعدادات Cloudflare Pages."},503);

  const url=new URL(request.url),date=url.searchParams.get("date");
  if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))return json({error:"تاريخ غير صالح."},400);
  const selected=new Date(date+"T00:00:00Z");
  if(Number.isNaN(selected.getTime())||selected.toISOString().slice(0,10)!==date)return json({error:"تاريخ غير صالح."},400);

  const cacheKey=new Request(url.origin+"/api/apifootball-matches-v2?date="+date);
  let fixtures=null;
  try {
    const cached=await caches.default.match(cacheKey);
    if(cached){const payload=await cached.json();if(Array.isArray(payload.fixtures))fixtures=payload.fixtures;}
  } catch {}

  if(!fixtures) {
    try {
      const api=new URL("https://v3.football.api-sports.io/fixtures");
      api.searchParams.set("date",date);
      api.searchParams.set("timezone","Africa/Cairo");
      const response=await fetch(api.toString(),{headers:{"x-apisports-key":token}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||hasProviderErrors(data?.errors)) {
        const status=response.status===429?429:response.status===403?403:502;
        return json({error:status===429?"تم تجاوز حد طلبات API-Football. حاول لاحقًا.":status===403?"مفتاح API-Football غير صالح أو لا يملك صلاحية الوصول.":providerErrorMessage(data?.errors),providerStatus:response.status,details:data?.errors||undefined},status,status===429?{"Retry-After":"300"}:{});
      }
      fixtures=Array.isArray(data.response)?data.response:[];
      try { await caches.default.put(cacheKey,json({fixtures},200,{"Cache-Control":"public, max-age=0, s-maxage=300"})); } catch {}
    } catch {
      return json({error:"تعذر الاتصال بـ API-Football."},502);
    }
  }

  const matches=fixtures.map(normalizeFixture);
  return json({date,matches,count:matches.length,updatedAt:new Date().toISOString()},200,{"Cache-Control":"public, max-age=20, s-maxage=60, stale-while-revalidate=120"});
}

function normalizeFixture(f) {
  const status=mapStatus(f.fixture?.status?.short);
  return {
    id:f.fixture?.id,
    utcDate:f.fixture?.date,
    status,
    venue:f.fixture?.venue?.name||null,
    minute:f.fixture?.status?.elapsed??null,
    competition:{id:f.league?.id,name:f.league?.name||"بطولة",emblem:f.league?.logo||null},
    homeTeam:{id:f.teams?.home?.id,name:f.teams?.home?.name||"الفريق المضيف",crest:f.teams?.home?.logo||null},
    awayTeam:{id:f.teams?.away?.id,name:f.teams?.away?.name||"الفريق الضيف",crest:f.teams?.away?.logo||null},
    score:{winner:f.teams?.home?.winner===true?"HOME_TEAM":f.teams?.away?.winner===true?"AWAY_TEAM":null,halfTime:{home:f.score?.halftime?.home??null,away:f.score?.halftime?.away??null},fullTime:{home:f.score?.fulltime?.home??null,away:f.score?.fulltime?.away??null},regularTime:{home:f.score?.fulltime?.home??null,away:f.score?.fulltime?.away??null}},
    _provider:"api-football"
  };
}
function mapStatus(s) {
  if(["1H","2H","ET","P","LIVE"].includes(s))return "IN_PLAY";
  if(["HT","BT","INT"].includes(s))return "PAUSED";
  if(["FT","AET","PEN"].includes(s))return "FINISHED";
  if(["PST","SUSP"].includes(s))return "POSTPONED";
  if(["CANC","ABD","AWD","WO"].includes(s))return "CANCELLED";
  return "SCHEDULED";
}
function hasProviderErrors(errors) {\n  if(errors==null)return false;\n  if(Array.isArray(errors))return errors.length>0;\n  if(typeof errors==="object")return Object.values(errors).some(v=>v!==null&&v!==undefined&&v!==""&&v!==false);\n  return Boolean(errors);\n}\nfunction providerErrorMessage(errors) {\n  const raw=typeof errors==="object"?Object.values(errors).filter(Boolean).join("، "):String(errors||"");\n  if(/plan|subscription|access|limit|free/i.test(raw))return "مصدر البيانات رفض طلب المباريات بسبب صلاحيات الخطة أو حدود الوصول؛ راجع صلاحيات API-Football.";\n  if(/token|key|authori/i.test(raw))return "مفتاح API-Football غير صالح أو غير مخوّل لهذا الطلب.";\n  return "تعذر جلب المباريات من API-Football."+(raw?" ("+raw+")":"");\n}\nfunction json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
}
