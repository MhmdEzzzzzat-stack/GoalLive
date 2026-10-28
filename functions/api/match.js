export async function onRequestGet({request,env}) {
  const token=typeof env?.API_FOOTBALL_KEY==="string"?env.API_FOOTBALL_KEY.trim():"";
  if(!token)return json({error:"مفتاح API-Football غير مضبوط. أضف API_FOOTBALL_KEY في إعدادات Cloudflare Pages."},503);

  const url=new URL(request.url),id=url.searchParams.get("id");
  if(!id||!/^\d{1,12}$/.test(id))return json({error:"رقم المباراة غير صالح."},400);

  // Share a short edge cache between visitors and enforce a site-wide cooldown
  // after provider rate limits, rather than letting every click hit API-Football.
  const edgeCache=typeof caches!=="undefined"?caches.default:null;
  const cacheKey=new Request(url.origin+"/api/match-cache?id="+encodeURIComponent(id));
  const cooldownKey=new Request(url.origin+"/api/match-provider-cooldown");
  try {
    if(edgeCache) {
      const cooldown=await edgeCache.match(cooldownKey);
      if(cooldown) return json({error:"مصدر بيانات المباريات وصل لحد الطلبات. انتظر دقيقة ثم جرّب مرة أخرى.",retryAfter:60},429,{"Retry-After":"60","Cache-Control":"no-store"});
      const cached=await edgeCache.match(cacheKey);
      if(cached) return new Response(cached.body,{status:cached.status,headers:cached.headers});
    }
  } catch {}
  const headers={"x-apisports-key":token};
  try {
    // One provider request per detail view. Events and lineups are intentionally omitted.
    const fixtureUrl=new URL("https://v3.football.api-sports.io/fixtures");
    fixtureUrl.searchParams.set("id",id);
    const fixtureResponse=await fetch(fixtureUrl.toString(),{headers});
    const fixtureData=await fixtureResponse.json().catch(()=>({}));

    if(!fixtureResponse.ok||hasProviderErrors(fixtureData?.errors)) {
      const status=fixtureResponse.status===429?429:fixtureResponse.status===403?403:502;
      if(status===429&&edgeCache) {
        try { await edgeCache.put(cooldownKey,new Response("rate-limited",{headers:{"Cache-Control":"public, max-age=0, s-maxage=60"}})); } catch {}
      }
      return json({error:status===429?"مصدر بيانات المباريات وصل لحد الطلبات. أوقفنا طلبات التفاصيل لمدة دقيقة لتجنب تكرار الخطأ.":status===403?"مفتاح API-Football غير صالح أو لا يملك صلاحية الوصول.":providerErrorMessage(fixtureData?.errors),providerStatus:fixtureResponse.status,details:fixtureData?.errors||undefined},status,status===429?{"Retry-After":"60","Cache-Control":"no-store"}:{});
    }

    const raw=Array.isArray(fixtureData.response)?fixtureData.response[0]:null;
    if(!raw)return json({error:"لم يتم العثور على المباراة في API-Football."},404);
    const match=normalizeFixture(raw);
    match.homeTeam.lineup=[];
    match.awayTeam.lineup=[];
    match.homeTeam.substitutes=[];
    match.awayTeam.substitutes=[];
    match.homeTeam.formation=null;
    match.awayTeam.formation=null;
    match.goals=[];
    match.bookings=[];
    match.substitutions=[];

    const payload=json({match,diagnostics:{lineupsAvailable:false,homeLineupCount:0,awayLineupCount:0,eventsAvailable:false,eventsCount:0,coverageWarning:"تم عرض بيانات المباراة الأساسية لتقليل استهلاك حد API؛ تفاصيل الأحداث والتشكيلات غير محمّلة."},updatedAt:new Date().toISOString()},200,{"Cache-Control":"public, max-age=0, s-maxage=300"});
    if(edgeCache) { try { await edgeCache.put(cacheKey,payload.clone()); } catch {} }
    return payload;

  } catch {
    return json({error:"تعذر الاتصال بـ API-Football."},502);
  }
}

function normalizePlayers(rows) {
  if(!Array.isArray(rows))return [];
  return rows.map(row=>{
    const p=row.player||row;
    return {id:p.id,name:p.name||"لاعب",position:p.pos||p.position||"",shirtNumber:p.number??null,grid:p.grid||null};
  });
}
function normalizeFixture(f) {
  return {
    id:f.fixture?.id,utcDate:f.fixture?.date,status:mapStatus(f.fixture?.status?.short),
    venue:f.fixture?.venue?.name||null,minute:f.fixture?.status?.elapsed??null,
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
function hasProviderErrors(errors) {
  if(errors==null)return false;
  if(Array.isArray(errors))return errors.length>0;
  if(typeof errors==="object")return Object.values(errors).some(v=>v!==null&&v!==undefined&&v!==""&&v!==false);
  return Boolean(errors);
}
function providerErrorMessage(errors) {
  const raw=typeof errors==="object"?Object.values(errors).filter(Boolean).map(v=>typeof v==="string"?v:JSON.stringify(v)).join("، "):String(errors||"");
  const suffix=raw?" (رد API-Football: "+raw.slice(0,500)+")":"";
  if(/plan|subscription|access|limit|free|quota/i.test(raw))return "رفض API-Football طلب تفاصيل المباراة بسبب قيود الخطة أو حد الاستخدام"+suffix;
  if(/token|key|authori|credential/i.test(raw))return "مفتاح API-Football غير صالح أو غير مخوّل"+suffix;
  return "تعذر جلب تفاصيل المباراة من API-Football"+suffix;
}
function json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
}
