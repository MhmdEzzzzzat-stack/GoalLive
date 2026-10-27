const state={date:new Date(),filter:"all",matches:[],loading:false,lastUpdated:null};
const $=s=>document.querySelector(s);
const list=$("#matches-list"),statusEl=$("#status-message"),empty=$("#empty-state");
const fmtDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function labelDate(d){const now=new Date();const yesterday=new Date(now);yesterday.setDate(now.getDate()-1);const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1);const key=fmtDate(d);if(key===fmtDate(now))return"اليوم";if(key===fmtDate(yesterday))return"أمس";if(key===fmtDate(tomorrow))return"غدًا";return new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(d)}
function time(iso){if(!iso)return"غير محدد";return new Intl.DateTimeFormat("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Africa/Cairo"}).format(new Date(iso))}
function fullDate(d){return new Intl.DateTimeFormat("ar-EG",{weekday:"long",day:"numeric",month:"long"}).format(d)}
function status(m){const s=m.status;if(["IN_PLAY","PAUSED","LIVE","EXTRA_TIME","PENALTY_SHOOTOUT"].includes(s))return{text:s==="PAUSED"?"استراحة":"مباشر",kind:"live",group:"live"};if(["FINISHED","AWARDED","CANCELLED"].includes(s))return{text:s==="CANCELLED"?"أُلغيت":"انتهت",kind:"",group:"finished"};if(s==="POSTPONED")return{text:"مؤجلة",kind:"postponed",group:"scheduled"};return{text:time(m.utcDate),kind:"",group:"scheduled"}}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function officialUrl(m){const c=m.competition?.code;return({PL:"https://www.premierleague.com/",PD:"https://www.laliga.com/",CL:"https://www.uefa.com/uefachampionsleague/",BL1:"https://www.bundesliga.com/",SA:"https://www.legaseriea.it/",FL1:"https://www.ligue1.com/"})[c]||"https://www.uefa.com/"}
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
function addPhaseOneElements(){if($("#phase-live-strip"))return;const hero=$(".hero-card"),fixtures=$(".fixtures-panel");if(!hero||!fixtures)return;const strip=document.createElement("div");strip.id="phase-live-strip";strip.className="phase-live-strip";strip.innerHTML='<i class="live-dot"></i><div><strong>مركز المباريات المباشر</strong><span>نتابع الحالات والنتائج المتاحة من مصدر البيانات لحظة بلحظة.</span></div><b class="count">0 مباشر</b>';hero.insertAdjacentElement("afterend",strip);const banner=document.createElement("div");banner.id="phase-date-banner";banner.className="phase-date-banner";banner.innerHTML='<div><b id="phase-date-label">اليوم</b><span id="phase-date-full"></span></div><span class="phase-count" id="phase-match-count">0 مباراة</span>';fixtures.insertBefore(banner,fixtures.firstElementChild?.nextElementSibling||fixtures.firstChild)}
function renderLiveStrip(){const live=state.matches.filter(m=>status(m).group==="live");const strip=$("#phase-live-strip");if(strip){strip.classList.toggle("has-live",live.length>0);strip.querySelector(".count").textContent=`${live.length} مباشر`;strip.title=live.length?"اضغط للانتقال إلى المباريات":"لا توجد مباريات مباشرة في البيانات الحالية";strip.onclick=()=>{if(live.length)document.querySelector("#matches")?.scrollIntoView({behavior:"smooth",block:"start"})}}}
function renderDateBanner(){const label=$("#phase-date-label"),full=$("#phase-date-full"),count=$("#phase-match-count");if(label)label.textContent=labelDate(state.date);if(full)full.textContent=` • ${fullDate(state.date)}`;if(count)count.textContent=`${state.matches.length} ${state.matches.length===1?"مباراة":"مباريات"}`}
function render(){
 const shown=state.matches.filter(m=>state.filter==="all"||status(m).group===state.filter);
 list.innerHTML="";empty.hidden=shown.length>0;
 shown.forEach(m=>{
  const st=status(m),h=m.homeTeam||{},a=m.awayTeam||{},hs=m.score?.fullTime?.home??m.score?.regularTime?.home,as=m.score?.fullTime?.away??m.score?.regularTime?.away;
  const scored=hs!==null&&hs!==undefined&&as!==null&&as!==undefined;
  const card=document.createElement("article");card.className=`match-card${st.group==="live"?" is-live":""}`;
  const scoreLabel=st.group==="live"?"مباشر":scored?"النتيجة":"بتوقيت مصر";
  card.innerHTML=`<div class="match-top"><span class="competition"><i class="comp-dot"></i><span>${esc(m.competition?.name||"بطولة")}</span></span><span class="match-status ${st.kind}">${esc(st.text)}</span></div>
  <div class="match-body"><div class="team">${h.crest?`<img class="team-crest" src="${esc(h.crest)}" alt="${esc(h.name||"")}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(h.name||"الفريق الأول")}</span></div>
  <div class="score">${scored?`${hs} - ${as}`:"—"}<small>${scoreLabel}</small></div>
  <div class="team">${a.crest?`<img class="team-crest" src="${esc(a.crest)}" alt="${esc(a.name||"")}" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(a.name||"الفريق الثاني")}</span></div></div>
  <div class="match-bottom"><span class="match-time">${st.group==="live"?`الحالة: ${esc(st.text)}`:scored?`موعد المباراة: ${time(m.utcDate)}`:`البداية: ${time(m.utcDate)}`}</span><a class="official-link" href="${officialUrl(m)}" target="_blank" rel="noopener noreferrer">معلومات رسمية ↗</a></div>`;
  list.appendChild(card);
 });
 const live=state.matches.filter(m=>status(m).group==="live");
 $("#live-summary").innerHTML=live.length?live.slice(0,3).map(m=>`<div class="live-match"><div class="live-comp">${esc(m.competition?.name||"مباراة مباشرة")}</div><div class="live-teams"><div class="live-team">${esc(m.homeTeam?.name||"الفريق الأول")}</div><div class="live-score">${m.score?.fullTime?.home??0} - ${m.score?.fullTime?.away??0}<small>مباشر</small></div><div class="live-team">${esc(m.awayTeam?.name||"الفريق الثاني")}</div></div></div>`).join(""):'<div class="live-placeholder">⚽<span>لا توجد مباراة مباشرة<br>في البيانات المتاحة حاليًا.</span></div>';
 renderLiveStrip();renderDateBanner();
}
function setLoading(on){state.loading=on;const refresh=$("#refresh-btn");if(refresh)refresh.disabled=on;statusEl.className=`status-message${on?" loading":""}`;if(on)statusEl.textContent="جارٍ تحديث مركز المباريات…"}
async function load({quiet=false}={}){
 if(state.loading)return;setLoading(true);
 if(!quiet){statusEl.textContent="جارٍ تحميل مباريات اليوم…"}
 try{
  const res=await fetch(`/api/matches?date=${encodeURIComponent(fmtDate(state.date))}`,{headers:{Accept:"application/json"},cache:"no-store"});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||"تعذر تحميل البيانات");
  state.matches=Array.isArray(data.matches)?data.matches:[];state.lastUpdated=new Date();
  statusEl.className="status-message";
  statusEl.textContent=state.matches.length?`تم تحميل ${state.matches.length} مباراة • آخر تحديث ${time(state.lastUpdated.toISOString())}`:"لا توجد مباريات في مصدر البيانات لهذا اليوم، أو أن البطولة غير متاحة في خطتك.";
  const updated=$("#updated-at");if(updated)updated.textContent=`آخر تحديث ${time(state.lastUpdated.toISOString())}`;
  const today=$("#today-btn");if(today)today.textContent=labelDate(state.date);render();
 }catch(e){statusEl.className="status-message error";statusEl.textContent=`${e.message}. تأكد من إعداد مفتاح API ونشر الموقع على Cloudflare Pages.`;if(!state.matches.length)empty.hidden=false;renderLiveStrip()}
 finally{state.loading=false;const refresh=$("#refresh-btn");if(refresh)refresh.disabled=false}
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.filter=b.dataset.filter;render()}));
$("#prev-day")?.addEventListener("click",()=>{state.date.setDate(state.date.getDate()-1);load()});
$("#next-day")?.addEventListener("click",()=>{state.date.setDate(state.date.getDate()+1);load()});
$("#today-btn")?.addEventListener("click",()=>{state.date=new Date();load()});
$("#refresh-btn")?.addEventListener("click",()=>load());
$("#year")&&($("#year").textContent=new Date().getFullYear());
$("#theme-toggle")?.addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("goallive-theme",document.body.classList.contains("light")?"light":"dark")});
if(localStorage.getItem("goallive-theme")==="light")document.body.classList.add("light");
$("#mobile-menu")?.addEventListener("click",()=>document.querySelector(".main-nav")?.classList.toggle("nav-open"));
injectPhaseOneStyle();addPhaseOneElements();load();setInterval(()=>{if(fmtDate(state.date)===fmtDate(new Date()))load({quiet:true})},60000);
