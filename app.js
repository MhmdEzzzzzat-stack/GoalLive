const state={date:new Date(),filter:"all",matches:[],loading:false,lastUpdated:null,apiCooldownUntil:0,favoritesOnly:false,favoriteIds:[],search:""};
const $=s=>document.querySelector(s);
const list=$("#matches-list"),statusEl=$("#status-message"),empty=$("#empty-state");
try{state.favoriteIds=JSON.parse(localStorage.getItem("goallive-favorites")||"[]").map(String)}catch{state.favoriteIds=[]}
function isFavorite(id){return state.favoriteIds.includes(String(id))}
function saveFavorites(){try{localStorage.setItem("goallive-favorites",JSON.stringify(state.favoriteIds))}catch{}const count=$("#favorites-count");if(count)count.textContent=String(state.favoriteIds.length)}
function toggleFavorite(id){const key=String(id);state.favoriteIds=isFavorite(key)?state.favoriteIds.filter(x=>x!==key):[...state.favoriteIds,key];saveFavorites();render()}
const fmtDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function labelDate(d){const now=new Date();const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);const key=fmtDate(d);if(key===fmtDate(now))return"اليوم";if(key===fmtDate(yesterday))return"أمس";if(key===fmtDate(tomorrow))return"غدًا";return new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(d)}
function time(iso){if(!iso)return"غير محدد";return new Intl.DateTimeFormat("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Africa/Cairo"}).format(new Date(iso))}
function fullDate(d){return new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long"}).format(d)}
function status(m){const s=m.status;if(["IN_PLAY","PAUSED","LIVE","EXTRA_TIME","PENALTY_SHOOTOUT"].includes(s))return{text:s==="PAUSED"?"استراحة":"مباشر",kind:"live",group:"live"};if(["FINISHED","AWARDED","CANCELLED"].includes(s))return{text:s==="CANCELLED"?"أُلغيت":"انتهت",kind:"",group:"finished"};if(s==="POSTPONED")return{text:"مؤجلة",kind:"postponed",group:"scheduled"};return{text:time(m.utcDate),kind:"",group:"scheduled"}}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function isEgyptianCompetition(m){const c=String(m.competition?.code||"").toUpperCase(),n=String(m.competition?.name||"").toLocaleLowerCase();return /egypt|egyptian|مصر|المصري/.test(n)||["EGY","EGPL","EGYPT"].includes(c)}
function officialWatchSearchUrl(m){const home=m.homeTeam?.name||"",away=m.awayTeam?.name||"",league=m.competition?.name||"";const q=`${home} vs ${away} ${league} where to watch broadcast channel`;return "https://www.google.com/search?q="+encodeURIComponent(q)}
function videoSearchUrl(m){const home=m.homeTeam?.name||"",away=m.awayTeam?.name||"",league=m.competition?.name||"";const live=status(m).group==="live"?"live stream":"match preview highlights";const q=`${home} vs ${away} ${league} ${live}`;return "https://www.youtube.com/results?search_query="+encodeURIComponent(q)} vs ${away} ${league} official live stream`;return "https://www.youtube.com/results?search_query="+encodeURIComponent(q)}
function injectPhaseOneStyle(){if($("#phase-one-style"))return;const style=document.createElement("style");style.id="phase-one-style";style.textContent=`
:root{--gl-glow:rgba(37,229,138,.16)}
body{background:radial-gradient(circle at 50% -12%,rgba(37,229,138,.10),transparent 30%),radial-gradient(circle at 8% 30%,rgba(45,111,180,.08),transparent 26%),var(--bg)}
.topline{height:32px;letter-spacing:.15px}.header{box-shadow:0 10px 35px rgba(0,0,0,.16)}
.logo-ball{box-shadow:0 0 24px rgba(37,229,138,.10),inset 0 0 18px rgba(37,229,138,.08)}
.panel,.hero-card{box-shadow:0 18px 55px rgba(0,0,0,.20)}
.panel{border-color:rgba(56,91,120,.62)}
.hero-card{min-height:325px;background:radial-gradient(circle at 12% 80%,rgba(37,229,138,.16),transparent 32%),linear-gradient(115deg,#0b2539,#09211f 52%,#08192b)}
.hero-card:after{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,transparent 0 62%,rgba(37,229,138,.035));}
.hero-content{max-width:62%}.hero-card h1{font-size:clamp(34px,4vw,52px);text-shadow:0 8px 30px rgba(0,0,0,.25)}
.hero-tag{box-shadow:0 0 25px rgba(37,229,138,.07)}
.btn-primary{transition:transform .18s,box-shadow .18s}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(37,229,138,.22)}
.hero-art{filter:drop-shadow(0 20px 35px rgba(0,0,0,.18))}.hero-football{animation:glFloat 5s ease-in-out infinite}@keyframes glFloat{0%,100%{transform:rotate(-20deg) translateY(0)}50%{transform:rotate(-16deg) translateY(-7px)}}
.fixture-heading{align-items:end}.date-picker button{transition:.18s}.date-picker button:hover{border-color:#37634f;background:#123329}.date-picker #today-btn{min-width:76px}
.fixture-tabs{scrollbar-width:none}.fixture-tabs::-webkit-scrollbar{display:none}.tab{transition:.18s}.tab:hover{color:#dce9f6;background:#0b2538}
.match-card{position:relative;overflow:hidden;border-radius:13px;padding:13px 14px;background:linear-gradient(110deg,rgba(13,35,55,.98),rgba(7,23,39,.98));transition:transform .2s,border-color .2s,box-shadow .2s}.match-card:before{content:"";position:absolute;top:0;bottom:0;right:0;width:3px;background:transparent;transition:.2s}.match-card:hover{transform:translateY(-2px);border-color:#39735c;box-shadow:0 10px 28px rgba(0,0,0,.18)}.match-card.is-live{border-color:rgba(255,86,103,.42);box-shadow:0 0 0 1px rgba(255,86,103,.06),0 10px 30px rgba(255,86,103,.06)}.match-card.is-live:before{background:var(--red)}
.match-top{padding-bottom:9px}.match-status.live{animation:livePulse 1.7s infinite}@keyframes livePulse{0%,100%{box-shadow:0 0 0 0 rgba(255,86,103,.10)}50%{box-shadow:0 0 0 5px rgba(255,86,103,.04)}}
.match-body{min-height:72px;padding:13px 0}.team{font-size:11px}.team-crest{width:34px;height:34px;padding:2px;border-radius:9px;background:#0e263b}.crest-placeholder{width:34px;height:34px}.score{font-size:21px}.score small{font-size:8px}.match-bottom{padding-top:9px}.official-link{padding:4px 7px;border-radius:6px;background:rgba(37,229,138,.07)}
.status-message{padding:11px 17px 2px}.status-message.loading{color:#b9ccdd}.status-message.error{padding-bottom:4px}
.live-panel{position:relative}.live-panel:before{content:"";position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,var(--red),transparent);opacity:.8}.live-summary{min-height:125px}.live-match{border-radius:10px;padding:12px 9px;margin:4px 0;background:rgba(255,255,255,.018)}.live-score{color:#fff}.live-score small{letter-spacing:.4px}.live-team{line-height:1.45}
.phase-live-strip{margin:0 0 18px;border:1px solid rgba(255,86,103,.25);border-radius:14px;background:linear-gradient(100deg,rgba(68,20,32,.72),rgba(10,26,42,.96));padding:12px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 35px rgba(0,0,0,.16)}.phase-live-strip .live-dot{width:9px;height:9px;border-radius:50%;background:var(--red);box-shadow:0 0 0 5px rgba(255,86,103,.10);flex:none}.phase-live-strip strong{font-size:11px}.phase-live-strip span{color:#9fb2c5;font-size:9px}.phase-live-strip .count{margin-right:auto;color:#ff8793;font-weight:900;font-size:10px}.phase-live-strip.has-live{cursor:pointer}.phase-live-strip.has-live:hover{border-color:rgba(255,86,103,.45)}
.phase-date-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding:11px 13px;border-radius:11px;background:linear-gradient(100deg,rgba(16,45,63,.72),rgba(10,27,43,.58));border:1px solid rgba(37,229,138,.10)}.phase-date-banner b{font-size:11px}.phase-date-banner span{font-size:9px;color:#7892aa}.phase-count{color:var(--green)!important;font-weight:800}
.empty-state{border-top:1px solid rgba(255,255,255,.03)}
@media(max-width:1100px){.layout{grid-template-columns:1fr 1.7fr}.right-column{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr}.hero-content{max-width:65%}.hero-art{width:45%;opacity:.65}}
@media(max-width:780px){.header{height:64px;padding:0 14px;gap:10px}.main-nav{position:absolute;top:64px;right:10px;left:10px;height:auto;display:none;flex-direction:column;align-items:stretch;background:#081827;border:1px solid #1b3450;border-radius:12px;box-shadow:0 18px 45px rgba(0,0,0,.35);padding:6px;z-index:50}.main-nav.nav-open{display:flex}.main-nav a{height:42px;padding:0 12px;border-radius:8px}.main-nav a.selected:after{display:none}.main-nav a.selected{background:#103a31}.mobile-only{display:block}.layout{display:flex;padding:14px 12px 30px;gap:14px}.left-column,.right-column{display:contents}.center-column{display:flex;gap:14px}.hero-card{min-height:420px;padding:25px 19px;align-items:flex-start}.hero-content{max-width:100%;padding-top:4px}.hero-card h1{font-size:37px}.hero-content>p{max-width:300px}.hero-art{width:100%;height:55%;top:45%;left:0;opacity:.42}.hero-footnote{right:16px;left:16px;text-align:center}.phase-live-strip{margin-bottom:14px}.fixtures-panel{order:2}.news-section{order:3}.left-column>*{order:4}.right-column>*{order:5}.panel-title{padding:15px}.fixture-heading{align-items:center}.date-picker{gap:4px}.date-picker #today-btn{min-width:68px}.match-card{padding:11px}.match-body{grid-template-columns:minmax(0,1fr) 62px minmax(0,1fr);gap:4px}.team{font-size:10px;gap:5px}.team-crest,.crest-placeholder{width:30px;height:30px}.score{font-size:18px}.panel-foot{flex-direction:column}.right-column{display:flex}.right-column .live-panel{order:0}.right-column .table-panel{order:1}.right-column .watch-panel{order:2}}
@media(max-width:430px){.logo{font-size:20px}.logo-ball{width:36px;height:36px;font-size:19px}.logo small{display:none}.header-actions{margin-right:auto}.hero-card{min-height:400px}.hero-card h1{font-size:32px}.hero-buttons{width:100%}.btn-primary,.btn-ghost{justify-content:center;width:100%}.date-picker button{min-width:28px}.date-picker #today-btn{padding:0 8px}.match-top{font-size:8px}.match-bottom{font-size:8px}.team-name{line-height:1.35}.right-column .panel{width:100%}}
`;document.head.appendChild(style)}
function addPhaseOneElements(){const heroLive=$(".hero-live-card");if(heroLive)heroLive.remove();const strip=$("#phase-live-strip");if(strip)strip.remove();const fixtures=$(".fixtures-panel");if(!fixtures||$("#phase-date-banner"))return;const banner=document.createElement("div");banner.id="phase-date-banner";banner.className="phase-date-banner";banner.innerHTML='<div><b id="phase-date-label">اليوم</b><span id="phase-date-full"></span></div><span class="phase-count" id="phase-match-count">0 مباراة</span>';fixtures.insertBefore(banner,fixtures.firstElementChild?.nextElementSibling||fixtures.firstChild)}
function renderLiveStrip(){}
function renderDateBanner(){const label=$("#phase-date-label"),full=$("#phase-date-full"),count=$("#phase-match-count");if(label)label.textContent=labelDate(state.date);if(full)full.textContent=` • ${fullDate(state.date)}`;if(count)count.textContent=`${state.matches.length} ${state.matches.length===1?"مباراة":"مباريات"}`}
function render(){
 const query=state.search.trim().toLocaleLowerCase();
 const shown=state.matches.filter(m=>{
  const matchesStatus=state.filter==="all"||status(m).group===state.filter;
  const matchesFavorite=!state.favoritesOnly||isFavorite(m.id);
  const searchable=[m.homeTeam?.name,m.awayTeam?.name,m.competition?.name].filter(Boolean).join(" ").toLocaleLowerCase();
  return matchesStatus&&matchesFavorite&&(!query||searchable.includes(query));
 });
 list.innerHTML="";empty.hidden=shown.length>0;
 shown.forEach(m=>{
  const st=status(m),h=m.homeTeam||{},a=m.awayTeam||{},hs=m.score?.fullTime?.home??m.score?.regularTime?.home,as=m.score?.fullTime?.away??m.score?.regularTime?.away;
  const scored=hs!==null&&hs!==undefined&&as!==null&&as!==undefined;
  const card=document.createElement("article");card.className=`match-card${st.group==="live"?" is-live":""}`;card.tabIndex=0;card.setAttribute("role","button");card.setAttribute("aria-label",`تفاصيل مباراة ${h.name||"الفريق الأول"} ضد ${a.name||"الفريق الثاني"}`);card.dataset.matchId=m.id;
  const scoreLabel=st.group==="live"?"مباشر":scored?"النتيجة":"بتوقيت مصر";
  card.innerHTML=`<div class="match-top"><span class="competition"><i class="comp-dot"></i><span>${esc(m.competition?.name||"بطولة")}</span></span><span class="match-top-actions"><button class="favorite-match${isFavorite(m.id)?" is-favorite":""}" type="button" aria-label="${isFavorite(m.id)?"إزالة من المفضلة":"إضافة للمفضلة"}" aria-pressed="${isFavorite(m.id)}" title="${isFavorite(m.id)?"إزالة من المفضلة":"إضافة للمفضلة"}">${isFavorite(m.id)?"★":"☆"}</button><span class="match-status ${st.kind}">${esc(st.text)}</span></span></div>
  <div class="match-body"><div class="team">${h.crest?`<img class="team-crest" src="${esc(h.crest)}" alt="${esc(h.name||"")}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(h.name||"الفريق الأول")}</span></div>
  <div class="score">${scored?`${hs} - ${as}`:"—"}<small>${scoreLabel}</small></div>
  <div class="team">${a.crest?`<img class="team-crest" src="${esc(a.crest)}" alt="${esc(a.name||"")}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(a.name||"الفريق الثاني")}</span></div></div>
  <div class="match-bottom"><span class="match-time">${st.group==="live"?`الحالة: ${esc(st.text)}`:scored?`موعد المباراة: ${time(m.utcDate)}`:`البداية: ${time(m.utcDate)}`}</span><div class="match-actions"><a class="watch-match-btn" href="${officialWatchSearchUrl(m)}" target="_blank" rel="noopener noreferrer" aria-label="اعرف القنوات الناقلة لمباراة ${esc(h.name||"الفريق الأول")} ضد ${esc(a.name||"الفريق الثاني")}">📺 اعرف القنوات الناقلة</a><a class="watch-secondary-btn" href="${videoSearchUrl(m)}" target="_blank" rel="noopener noreferrer">${st.group==="live"?"بحث عن بث على YouTube":"معاينة المباراة على YouTube"} ↗</a></div></div>`;
  card.querySelector(".favorite-match")?.addEventListener("click",e=>{e.stopPropagation();toggleFavorite(m.id)});
  card.addEventListener("click",e=>{if(e.target.closest("a,button"))return;if(m.id!=null)openMatchDetail(m.id)});card.addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&m.id!=null){e.preventDefault();openMatchDetail(m.id)}});list.appendChild(card);
 });
 const live=state.matches.filter(m=>status(m).group==="live");
 $("#live-summary").innerHTML=live.length?live.slice(0,3).map(m=>`<div class="live-match"><div class="live-comp">${esc(m.competition?.name||"مباراة مباشرة")}</div><div class="live-teams"><div class="live-team">${esc(m.homeTeam?.name||"الفريق الأول")}</div><div class="live-score">${m.score?.fullTime?.home??0} - ${m.score?.fullTime?.away??0}<small>مباشر</small></div><div class="live-team">${esc(m.awayTeam?.name||"الفريق الثاني")}</div></div></div>`).join(""):'<div class="live-placeholder">⚽<span>لا توجد مباراة مباشرة<br>في البيانات المتاحة حاليًا.</span></div>';
 const favFilter=$("#favorites-filter");if(favFilter){favFilter.classList.toggle("active",state.favoritesOnly);favFilter.setAttribute("aria-pressed",String(state.favoritesOnly))}
 saveFavorites();renderLiveStrip();renderDateBanner();
}
function setLoading(on){state.loading=on;const refresh=$("#refresh-btn");if(refresh)refresh.disabled=on;statusEl.className=`status-message${on?" loading":""}`;if(on)statusEl.textContent="جارٍ تحديث مركز المباريات…"}
let activeMatchesController=null,activeMatchesDate="";
async function load({quiet=false}={}){
 const requestedDate=fmtDate(state.date);
 if(state.loading&&activeMatchesDate===requestedDate)return;
 if(Date.now()<state.apiCooldownUntil){
  if(!quiet)statusEl.textContent=`تم إيقاف التحديث مؤقتًا لتجنب تجاوز حد الطلبات. جرّب بعد ${Math.ceil((state.apiCooldownUntil-Date.now())/60000)} دقائق.`;
  return;
 }
 if(activeMatchesController)activeMatchesController.abort();
 const controller=new AbortController();activeMatchesController=controller;activeMatchesDate=requestedDate;
 const timeout=setTimeout(()=>controller.abort(),12000);
 setLoading(true);
 if(!quiet){statusEl.className="status-message loading";statusEl.textContent="جارٍ تحميل مباريات "+labelDate(state.date)+"…"}
 try{
  const res=await fetch(`/api/matches?date=${encodeURIComponent(requestedDate)}`,{headers:{Accept:"application/json"},signal:controller.signal,cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(res.status===429){
   const retrySeconds=Math.max(300,Number(res.headers.get("Retry-After"))||300);
   state.apiCooldownUntil=Date.now()+retrySeconds*1000;
   throw new Error("وصل مصدر البيانات إلى حد الطلبات. أوقفنا المحاولات مؤقتًا لتجنب استهلاك الحد أكثر");
  }
  if(!res.ok)throw new Error(data.error||"تعذر تحميل البيانات");
  if(controller!==activeMatchesController||requestedDate!==fmtDate(state.date))return;
  state.apiCooldownUntil=0;state.matches=Array.isArray(data.matches)?data.matches:[];state.lastUpdated=new Date();
  statusEl.className="status-message";
  statusEl.textContent=state.matches.length?`تم تحميل ${state.matches.length} مباراة • آخر تحديث ${time(state.lastUpdated.toISOString())}`:"لا توجد مباريات في مصدر البيانات لهذا اليوم، أو أن البطولة غير متاحة في خطتك.";
  const updated=$("#updated-at");if(updated)updated.textContent=`آخر تحديث ${time(state.lastUpdated.toISOString())}`;
  const today=$("#today-btn");if(today)today.textContent=labelDate(state.date);render();
 }catch(e){
  if(controller!==activeMatchesController)return;
  if(e.name==="AbortError"){
   statusEl.className="status-message error";statusEl.textContent="استغرق تحميل المباريات وقتًا طويلًا. جرّب تحديث البيانات مرة أخرى.";
  }else{
   statusEl.className="status-message error";
   statusEl.textContent=e.message.includes("حد الطلبات")?`${e.message}. سيُستأنف التحديث بعد انتهاء فترة الانتظار.`:`${e.message}. راجع إعداد مفتاح API ونشر Cloudflare Pages.`;
  }
  if(!state.matches.length)empty.hidden=false;renderLiveStrip()
 }finally{
  clearTimeout(timeout);
  if(controller===activeMatchesController){state.loading=false;activeMatchesController=null;activeMatchesDate="";const refresh=$("#refresh-btn");if(refresh)refresh.disabled=false}
 }
}
function injectPhaseTwoStyle(){if($("#phase-two-style"))return;const s=document.createElement("style");s.id="phase-two-style";s.textContent=`
.match-card{cursor:pointer}.match-card:focus-visible{outline:2px solid var(--green);outline-offset:3px}
.match-detail-backdrop[hidden]{display:none!important}.match-detail-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(2,9,17,.82);backdrop-filter:blur(8px);display:grid;place-items:center;padding:16px;overflow-y:auto}
.match-detail-dialog{position:relative;width:min(760px,100%);max-height:min(88vh,900px);overflow:auto;background:linear-gradient(145deg,#0d2236,#071522);border:1px solid rgba(95,145,178,.28);border-radius:20px;box-shadow:0 30px 100px rgba(0,0,0,.5);color:#eaf2fa}
.match-detail-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:rgba(8,24,39,.96);border-bottom:1px solid rgba(255,255,255,.07)}
.match-detail-head h2{font-size:15px;margin:0}.match-detail-close{width:36px;height:36px;border:1px solid #294157;border-radius:10px;background:#102b40;color:#fff;font-size:22px;cursor:pointer}
.match-detail-content{padding:18px}.detail-hero{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;padding:20px 12px;border:1px solid rgba(255,255,255,.07);border-radius:16px;background:radial-gradient(circle at 50% 0,rgba(37,229,138,.08),transparent 65%),rgba(255,255,255,.018);text-align:center}
.detail-team{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:13px;font-weight:800}.detail-team img{width:58px;height:58px;object-fit:contain}.detail-score{font-size:clamp(25px,5vw,38px);font-weight:900;white-space:nowrap}.detail-score small{display:block;font-size:10px;color:#94a9bc;font-weight:600;margin-top:5px}
.detail-meta{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin:13px 0 20px}.detail-chip{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:999px;padding:7px 10px;color:#b9c9d8;font-size:11px}
.detail-section{margin-top:18px}.detail-section h3{font-size:13px;margin:0 0 10px;display:flex;align-items:center;gap:8px}.detail-section h3:before{content:"";width:3px;height:16px;background:var(--green);border-radius:4px}.detail-event-list{display:grid;gap:8px}.detail-event{display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.035);font-size:12px}.detail-event time{color:var(--green);font-weight:900;min-width:40px}.detail-event small{display:block;color:#8fa5b9;margin-top:3px}.detail-empty{padding:14px;border:1px dashed rgba(255,255,255,.12);border-radius:10px;color:#8298ac;font-size:12px;text-align:center}.detail-lineups{display:grid;grid-template-columns:1fr 1fr;gap:12px}.detail-lineup{padding:12px;border-radius:12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06)}.detail-lineup h4{font-size:12px;margin:0 0 9px}.detail-player{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.045);font-size:11px}.detail-player:last-child{border:0}.detail-player span:last-child{color:#91a7bb}.detail-footer{margin-top:18px;color:#718ba1;font-size:10px;line-height:1.7}
.detail-loading{padding:44px 12px;text-align:center;color:#a6bacb}.detail-loading i{display:block;width:26px;height:26px;margin:0 auto 12px;border:2px solid #28445a;border-top-color:var(--green);border-radius:50%;animation:detailSpin .8s linear infinite}@keyframes detailSpin{to{transform:rotate(360deg)}}
@media(max-width:520px){.match-detail-backdrop{padding:8px}.match-detail-dialog{max-height:94vh;border-radius:15px}.match-detail-content{padding:12px}.detail-hero{gap:5px;padding:16px 6px}.detail-team{font-size:11px}.detail-team img{width:42px;height:42px}.detail-lineups{grid-template-columns:1fr}}
`;document.head.appendChild(s)}
const safeArray=v=>Array.isArray(v)?v:[];
function eventMinute(e){return e.minute!=null?`${e.minute}'`:e.injuryTime!=null?`${e.minute||90}+${e.injuryTime}'`:"—"}
function eventLabel(e){return e.player?.name||e.scorer?.name||e.team?.name||e.type||"حدث المباراة"}
function detailEvents(m){const goals=safeArray(m.goals),bookings=safeArray(m.bookings),subs=safeArray(m.substitutions);const events=[...goals.map(e=>({...e,_kind:"goal"})),...bookings.map(e=>({...e,_kind:"card"})),...subs.map(e=>({...e,_kind:"sub"}))];events.sort((a,b)=>(Number(a.minute)||0)-(Number(b.minute)||0));if(!events.length)return '<div class="detail-empty">لا توجد أحداث تفصيلية متاحة لهذه المباراة حتى الآن.</div>';return `<div class="detail-event-list">${events.map(e=>{const label=e._kind==="goal"?"⚽ هدف":e._kind==="card"?"🟨 بطاقة":"🔁 تبديل";const who=e.player?.name||e.scorer?.name||e.team?.name||"لاعب";const extra=e._kind==="sub"?[e.playerOut?.name,e.playerIn?.name].filter(Boolean).join(" ← "):e._kind==="goal"?(e.type||""):e.card||"";return `<div class="detail-event"><time>${esc(eventMinute(e))}</time><div><b>${label}</b> · ${esc(who)}<small>${esc([e.team?.name,extra].filter(Boolean).join(" • "))}</small></div></div>`}).join("")}</div>`}
function detailLineups(m){const home=safeArray(m.homeTeam?.lineup),away=safeArray(m.awayTeam?.lineup);if(!home.length&&!away.length)return '<div class="detail-empty">التشكيلات الرسمية غير متاحة من مصدر البيانات لهذه المباراة.</div>';const side=(team,players)=>`<div class="detail-lineup"><h4>${esc(team?.name||"الفريق")}</h4>${players.length?players.map(p=>`<div class="detail-player"><span>${esc(p.name||"لاعب")}</span><span>${esc(p.position||"")}${p.shirtNumber!=null?" #"+esc(p.shirtNumber):""}</span></div>`).join(""):'<div class="detail-empty">لا توجد بيانات</div>'}</div>`;return `<div class="detail-lineups">${side(m.homeTeam,home)}${side(m.awayTeam,away)}</div>`}
function detailMarkup(m){const h=m.homeTeam||{},a=m.awayTeam||{},s=m.score||{},home=s.fullTime?.home??s.regularTime?.home,away=s.fullTime?.away??s.regularTime?.away;const score=home!=null&&away!=null?`${home} - ${away}`:"—";const st=status(m);return `<div class="detail-hero"><div class="detail-team">${h.crest?`<img src="${esc(h.crest)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:"⚽"}<span>${esc(h.name||"الفريق الأول")}</span></div><div class="detail-score">${score}<small>${esc(st.text)}</small></div><div class="detail-team">${a.crest?`<img src="${esc(a.crest)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:"⚽"}<span>${esc(a.name||"الفريق الثاني")}</span></div></div><div class="detail-meta"><span class="detail-chip">${esc(m.competition?.name||"بطولة")}</span><span class="detail-chip">${esc(time(m.utcDate))} بتوقيت القاهرة</span><span class="detail-chip">${esc(m.venue||"الملعب غير متاح")}</span></div><section class="detail-section"><h3>أحداث المباراة</h3>${detailEvents(m)}</section><section class="detail-section"><h3>التشكيلات</h3>${detailLineups(m)}</section><p class="detail-footer">تعتمد التفاصيل على البيانات التي يتيحها مزوّد GoalLive؛ قد لا تتوفر الأحداث أو التشكيلات لكل البطولات أو الخطط.</p>`}
function ensureDetailModal(){let backdrop=$("#match-detail-backdrop");if(backdrop)return backdrop;backdrop=document.createElement("div");backdrop.id="match-detail-backdrop";backdrop.className="match-detail-backdrop";backdrop.hidden=true;backdrop.innerHTML='<section class="match-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="match-detail-title"><header class="match-detail-head"><h2 id="match-detail-title">تفاصيل المباراة</h2><button class="match-detail-close" type="button" aria-label="إغلاق التفاصيل">×</button></header><div class="match-detail-content"><div class="detail-loading"><i></i>جارٍ تحميل تفاصيل المباراة…</div></div></section>';document.body.appendChild(backdrop);backdrop.addEventListener("click",e=>{if(e.target===backdrop||e.target.closest(".match-detail-close"))closeDetail()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeDetail()});return backdrop}
function closeDetail(){const b=$("#match-detail-backdrop");if(b)b.hidden=true;document.body.style.overflow=""}
async function openMatchDetail(id){const b=ensureDetailModal(),content=b.querySelector(".match-detail-content");b.hidden=false;document.body.style.overflow="hidden";content.innerHTML='<div class="detail-loading"><i></i>جارٍ تحميل تفاصيل المباراة…</div>';try{const res=await fetch(`/api/match?id=${encodeURIComponent(id)}`,{headers:{Accept:"application/json"},cache:"no-store"});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"تعذر تحميل تفاصيل المباراة");const m=data.match||data;$("#match-detail-title").textContent=`${m.homeTeam?.name||"الفريق الأول"} × ${m.awayTeam?.name||"الفريق الثاني"}`;content.innerHTML=detailMarkup(m)}catch(e){content.innerHTML=`<div class="detail-empty">${esc(e.message)}<br>قد تكون التفاصيل غير متاحة في خطة البيانات الحالية.</div>`}}

injectPhaseTwoStyle();
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.filter=b.dataset.filter;render()}));
$("#prev-day")?.addEventListener("click",()=>{state.date.setDate(state.date.getDate()-1);load()});
$("#next-day")?.addEventListener("click",()=>{state.date.setDate(state.date.getDate()+1);load()});
$("#today-btn")?.addEventListener("click",()=>{state.date=new Date();load()});
$("#refresh-btn")?.addEventListener("click",()=>load());
$("#match-search")?.addEventListener("input",e=>{state.search=e.target.value;render()});
$("#favorites-filter")?.addEventListener("click",()=>{state.favoritesOnly=!state.favoritesOnly;render()});
$("#year")&&($("#year").textContent=new Date().getFullYear());
$("#theme-toggle")?.addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("goallive-theme",document.body.classList.contains("light")?"light":"dark")});
if(localStorage.getItem("goallive-theme")==="light")document.body.classList.add("light");
$("#mobile-menu")?.addEventListener("click",()=>document.querySelector(".main-nav")?.classList.toggle("nav-open"));
injectPhaseOneStyle();addPhaseOneElements();load();setInterval(()=>{if(document.visibilityState==="visible"&&fmtDate(state.date)===fmtDate(new Date())&&Date.now()>=state.apiCooldownUntil)load({quiet:true})},120000);
