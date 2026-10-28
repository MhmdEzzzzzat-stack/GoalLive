export async function onRequestGet({request,env}) {
  const token=typeof env?.API_FOOTBALL_KEY==="string"?env.API_FOOTBALL_KEY.trim():"";
  if(!token)return json({error:"مفتاح API-Football غير مضبوط. أضف API_FOOTBALL_KEY في إعدادات Cloudflare Pages."},503);

  const url=new URL(request.url),id=url.searchParams.get("id");
  if(!id||!/^\d{1,12}$/.test(id))return json({error:"رقم المباراة غير صالح."},400);

  const headers={"x-apisports-key":token};
  try {
    const fixtureUrl=new URL("https://v3.football.api-sports.io/fixtures");
    fixtureUrl.searchParams.set("id",id);
    // Fixture data is essential; events and lineups are optional coverage and must not
    // make the whole details dialog fail if either endpoint is temporarily unavailable.
    const settled=await Promise.allSettled([
      fetch(fixtureUrl.toString(),{headers}),
      fetch("https://v3.football.api-sports.io/fixtures/events?fixture="+encodeURIComponent(id),{headers}),
      fetch("https://v3.football.api-sports.io/fixtures/lineups?fixture="+encodeURIComponent(id),{headers})
    ]);
    if(settled[0].status==="rejected") {
      return json({error:"تعذر الاتصال بمصدر بيانات المباراة. حاول مرة أخرى بعد قليل."},502);
    }
    const fixtureResponse=settled[0].value;
    const fixtureData=await fixtureResponse.json().catch(()=>({}));
    const optionalJson=async result=>{
      if(result.status!=="fulfilled"||!result.value.ok)return {response:[]};
      return result.value.json().catch(()=>({response:[]}));
    };
    const [eventsData,lineupsData]=await Promise.all([
      optionalJson(settled[1]),optionalJson(settled[2])
    ]);

    if(!fixtureResponse.ok||hasProviderErrors(fixtureData?.errors)) {
      const status=fixtureResponse.status===429?429:fixtureResponse.status===403?403:502;
      return json({error:status===429?"تم تجاوز حد طلبات API-Football. حاول لاحقًا.":status===403?"مفتاح API-Football غير صالح أو لا يملك صلاحية الوصول.":providerErrorMessage(fixtureData?.errors),providerStatus:fixtureResponse.status,details:fixtureData?.errors||undefined},status,status===429?{"Retry-After":"300"}:{});
    }

    const raw=Array.isArray(fixtureData.response)?fixtureData.response[0]:null;
    if(!raw)return json({error:"لم يتم العثور على المباراة في API-Football."},404);
    const match=normalizeFixture(raw);
    const lineupRows=Array.isArray(lineupsData.response)?lineupsData.response:[];
    const homeRaw=lineupRows.find(x=>String(x.team?.id)===String(raw.teams?.home?.id));
    const awayRaw=lineupRows.find(x=>String(x.team?.id)===String(raw.teams?.away?.id));
    match.homeTeam.lineup=normalizePlayers(homeRaw?.startXI);
    match.awayTeam.lineup=normalizePlayers(awayRaw?.startXI);
    match.homeTeam.substitutes=normalizePlayers(homeRaw?.substitutes);
    match.awayTeam.substitutes=normalizePlayers(awayRaw?.substitutes);
    match.homeTeam.formation=homeRaw?.formation||null;
    match.awayTeam.formation=awayRaw?.formation||null;

    const events=Array.isArray(eventsData.response)?eventsData.response:[];
    match.goals=events.filter(e=>e.type==="Goal").map(e=>({minute:e.time?.elapsed,player:{name:e.player?.name},team:{name:e.team?.name},type:e.detail,assist:{name:e.assist?.name}}));
    match.bookings=events.filter(e=>e.type==="Card").map(e=>({minute:e.time?.elapsed,player:{name:e.player?.name},team:{name:e.team?.name},card:e.detail}));
    match.substitutions=events.filter(e=>e.type==="subst"||e.type==="Subst").map(e=>({minute:e.time?.elapsed,team:{name:e.team?.name},playerOut:{name:e.player?.name},playerIn:{name:e.assist?.name}}));

    const eventsCount=match.goals.length+match.bookings.length+match.substitutions.length;
    return json({match,diagnostics:{lineupsAvailable:match.homeTeam.lineup.length>0||match.awayTeam.lineup.length>0,homeLineupCount:match.homeTeam.lineup.length,awayLineupCount:match.awayTeam.lineup.length,eventsAvailable:eventsCount>0,eventsCount,coverageWarning:lineupRows.length===0?"قد لا تكون التشكيلات متاحة لهذه البطولة أو المباراة.":null},updatedAt:new Date().toISOString()},200,{"Cache-Control":"public, max-age=20, s-maxage=30"});
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
function hasProviderErrors(errors) {\n  if(errors==null)return false;\n  if(Array.isArray(errors))return errors.length>0;\n  if(typeof errors==="object")return Object.values(errors).some(v=>v!==null&&v!==undefined&&v!==""&&v!==false);\n  return Boolean(errors);\n}\nfunction providerErrorMessage(errors) {\n  const raw=typeof errors==="object"?Object.values(errors).filter(Boolean).join("، "):String(errors||"");\n  if(/plan|subscription|access|limit|free/i.test(raw))return "مصدر البيانات رفض طلب التفاصيل بسبب صلاحيات الخطة أو حدود الوصول؛ راجع صلاحيات API-Football.";\n  if(/token|key|authori/i.test(raw))return "مفتاح API-Football غير صالح أو غير مخوّل لهذا الطلب.";\n  return "تعذر جلب تفاصيل المباراة من API-Football."+(raw?" ("+raw+")":"");\n}\nfunction json(data,status=200,extra={}) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}});
}
