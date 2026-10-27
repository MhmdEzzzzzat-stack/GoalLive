const state={date:new Date(),filter:"all",matches:[],loading:false};
const $=s=>document.querySelector(s);
const list=$("#matches-list"),statusEl=$("#status-message"),empty=$("#empty-state");
const fmtDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function labelDate(d){const now=new Date(),tom=new Date();tom.setDate(now.getDate()+1);if(fmtDate(d)===fmtDate(now))return"اليوم";if(fmtDate(d)===fmtDate(tom))return"غدًا";return new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(d)}
function time(iso){if(!iso)return"غير محدد";return new Intl.DateTimeFormat("ar-EG",{hour:"2-digit",minute:"2-digit",hour12:true,timeZone:"Africa/Cairo"}).format(new Date(iso))}
function status(m){const s=m.status;if(["IN_PLAY","PAUSED","LIVE","EXTRA_TIME","PENALTY_SHOOTOUT"].includes(s))return{text:s==="PAUSED"?"استراحة":"مباشر",kind:"live",group:"live"};if(["FINISHED","AWARDED","CANCELLED"].includes(s))return{text:s==="CANCELLED"?"أُلغيت":"انتهت",kind:"",group:"finished"};if(s==="POSTPONED")return{text:"مؤجلة",kind:"",group:"scheduled"};return{text:time(m.utcDate),kind:"",group:"scheduled"}}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function officialUrl(m){const c=m.competition?.code;return({PL:"https://www.premierleague.com/",PD:"https://www.laliga.com/",CL:"https://www.uefa.com/uefachampionsleague/",BL1:"https://www.bundesliga.com/",SA:"https://www.legaseriea.it/",FL1:"https://www.ligue1.com/"})[c]||"https://www.uefa.com/"}
function render(){
 const shown=state.matches.filter(m=>state.filter==="all"||status(m).group===state.filter);
 list.innerHTML="";empty.hidden=shown.length>0;
 shown.forEach(m=>{
  const st=status(m),h=m.homeTeam||{},a=m.awayTeam||{},hs=m.score?.fullTime?.home??m.score?.regularTime?.home,as=m.score?.fullTime?.away??m.score?.regularTime?.away;
  const scored=hs!==null&&hs!==undefined&&as!==null&&as!==undefined;
  const card=document.createElement("article");card.className="match-card";
  card.innerHTML=`<div class="match-top"><span class="competition"><i class="comp-dot"></i><span>${esc(m.competition?.name||"بطولة")}</span></span><span class="match-status ${st.kind}">${esc(st.text)}</span></div>
  <div class="match-body"><div class="team">${h.crest?`<img class="team-crest" src="${esc(h.crest)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(h.name||"الفريق الأول")}</span></div>
  <div class="score">${scored?`${hs} - ${as}`:"—"}<small>${scored?"النتيجة":"بتوقيت مصر"}</small></div>
  <div class="team">${a.crest?`<img class="team-crest" src="${esc(a.crest)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:'<span class="crest-placeholder">⚽</span>'}<span class="team-name">${esc(a.name||"الفريق الثاني")}</span></div></div>
  <div class="match-bottom"><span class="match-time">${scored?`موعد المباراة: ${time(m.utcDate)}`:`البداية: ${time(m.utcDate)}`}</span><a class="official-link" href="${officialUrl(m)}" target="_blank" rel="noopener noreferrer">معلومات رسمية ↗</a></div>`;
  list.appendChild(card);
 });
 const live=state.matches.filter(m=>status(m).group==="live");
 $("#live-summary").innerHTML=live.length?live.slice(0,3).map(m=>`<div class="live-match"><div class="live-comp">${esc(m.competition?.name||"مباراة مباشرة")}</div><div class="live-teams"><div class="live-team">${esc(m.homeTeam?.name||"الفريق الأول")}</div><div class="live-score">${m.score?.fullTime?.home??0} - ${m.score?.fullTime?.away??0}<small>مباشر</small></div><div class="live-team">${esc(m.awayTeam?.name||"الفريق الثاني")}</div></div></div>`).join(""):'<div class="live-placeholder">⚽<span>لا توجد مباراة مباشرة<br>في البيانات المتاحة حاليًا.</span></div>';
}
async function load({quiet=false}={}){
 if(state.loading)return;state.loading=true;$("#refresh-btn").disabled=true;
 if(!quiet){statusEl.className="status-message";statusEl.textContent="جارٍ تحميل المباريات…"}
 try{
  const res=await fetch(`/api/matches?date=${encodeURIComponent(fmtDate(state.date))}`,{headers:{Accept:"application/json"}});
  const data=await res.json();if(!res.ok)throw new Error(data.error||"تعذر تحميل البيانات");
  state.matches=Array.isArray(data.matches)?data.matches:[];
  statusEl.className="status-message";
  statusEl.textContent=state.matches.length?`تم تحميل ${state.matches.length} مباراة • آخر تحديث ${time(new Date().toISOString())}`:"لا توجد مباريات في مصدر البيانات لهذا اليوم، أو أن البطولة غير متاحة في خطتك.";
  $("#updated-at").textContent=`آخر تحديث ${time(new Date().toISOString())}`;
  $("#today-btn").textContent=labelDate(state.date);render();
 }catch(e){statusEl.className="status-message error";statusEl.textContent=`${e.message}. تأكد من إعداد مفتاح API ونشر الموقع على Cloudflare Pages.`;if(!state.matches.length)empty.hidden=false}
 finally{state.loading=false;$("#refresh-btn").disabled=false}
}
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.filter=b.dataset.filter;render()}));
$("#prev-day").addEventListener("click",()=>{state.date.setDate(state.date.getDate()-1);load()});
$("#next-day").addEventListener("click",()=>{state.date.setDate(state.date.getDate()+1);load()});
$("#today-btn").addEventListener("click",()=>{state.date=new Date();load()});
$("#refresh-btn").addEventListener("click",()=>load());
$("#year").textContent=new Date().getFullYear();
$("#theme-toggle").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("goallive-theme",document.body.classList.contains("light")?"light":"dark")});
if(localStorage.getItem("goallive-theme")==="light")document.body.classList.add("light");
$("#mobile-menu").addEventListener("click",()=>document.querySelector(".main-nav").classList.toggle("nav-open"));
load();setInterval(()=>{if(fmtDate(state.date)===fmtDate(new Date()))load({quiet:true})},60000);
