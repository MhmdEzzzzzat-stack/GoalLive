/* Small quality-of-life enhancements; match data remains sourced by app.js */
(()=> {
  const nav=document.querySelector(".main-nav");
  const menu=document.querySelector("#mobile-menu");
  nav?.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>nav.classList.remove("nav-open")));
  menu?.addEventListener("click",()=>menu.setAttribute("aria-expanded",String(nav?.classList.contains("nav-open"))));
  if(menu) menu.setAttribute("aria-expanded","false");
  const top=document.createElement("button");
  top.id="goallive-back-top";top.type="button";top.className="";top.setAttribute("aria-label","العودة إلى أعلى الصفحة");top.title="العودة للأعلى";top.textContent="↑";
  document.body.appendChild(top);
  const updateTop=()=>top.classList.toggle("is-visible",window.scrollY>420);
  window.addEventListener("scroll",updateTop,{passive:true});updateTop();
  top.addEventListener("click",()=>window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}));
  const line=document.querySelector(".topline");
  if(line&&!document.querySelector("#goallive-clock")){
    const sep=document.createElement("span");sep.className="topline-sep";sep.textContent="|";
    const clock=document.createElement("time");clock.id="goallive-clock";clock.setAttribute("aria-label","الوقت الحالي في القاهرة");
    line.append(sep,clock);
    const formatter=new Intl.DateTimeFormat("ar-EG",{timeZone:"Africa/Cairo",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});
    const tick=()=>{clock.textContent=formatter.format(new Date())+" القاهرة";clock.dateTime=new Date().toISOString()};
    tick();setInterval(tick,1000);
  }
  if("IntersectionObserver" in window){
    const links=[...document.querySelectorAll(".main-nav a[href^='#']")];
    const targets=links.map(a=>document.querySelector(a.getAttribute("href"))).filter(Boolean);
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(!visible)return;
      links.forEach(a=>{const active=a.getAttribute("href")==="#"+visible.target.id;a.classList.toggle("selected",active);if(active)a.setAttribute("aria-current","location");else a.removeAttribute("aria-current")});
    },{rootMargin:"-18% 0px -68% 0px",threshold:[0,.1,.25,.5]});
    targets.forEach(target=>observer.observe(target));
  }
})();