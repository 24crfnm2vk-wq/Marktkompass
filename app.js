async function loadStatus(){
  const root=document.getElementById("app");
  try{
    const r=await fetch("status.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("Statusdatei nicht verfügbar.");
    const s=await r.json();

    const cls=s.trafficLight==="GRÜN"?"green":s.trafficLight==="GELB"?"yellow":s.trafficLight==="ROT"?"red":"gray";

    let reference="";
    if(s.historicalReference && s.historicalReference.found){
      const h=s.historicalReference;
      reference=`<div class="card">
        <div class="label">Historischer Referenzfall</div>
        <div class="row">Vergleichbarer Zeitpunkt: <b>${h.date}</b></div>
        <div class="row">Stressereignis begann: ${h.stressStart}</div>
        <div class="row">Stressniveau damals: ${h.stressLevel}</div>
        <div class="row">ACWI seit Stressbeginn: ${h.acwiChangeSinceStart}</div>
        <div class="row">Abstand zur SMA200: ${h.distanceToSma200}</div>
        <div class="row">VIX: ${h.vix}</div>
        <small>Nur zur historischen Einordnung eines erkannten Stressereignisses; keine Prognose.</small>
      </div>`;
    }

    root.innerHTML=`
      <div class="card">
        <div><b>Version:</b> ${s.version}</div>
        <div><b>Datenstand:</b> ${s.date}</div>
        <div class="traffic"><span class="dot ${cls}"></span>Ampel: ${s.trafficLight}</div>
        <div class="row"><span class="label">Marktstatus:</span> ${s.marketStatus}</div>
      </div>
      <div class="card">
        <div class="row"><span class="label">MSCI ACWI:</span> ${s.acwi}</div>
        <div class="row"><span class="label">SMA200:</span> ${s.sma200}</div>
        <div class="row"><span class="label">Abstand zur SMA200:</span> ${s.distanceToSma200}</div>
        <div class="row"><span class="label">VIX:</span> ${s.vix}</div>
        <div class="row"><span class="label">VIX Tagesveränderung:</span> ${s.vixDailyChange}</div>
      </div>
      ${reference}
    `;
  }catch(e){
    root.innerHTML='<div class="card error">Aktueller Marktstatus konnte nicht geladen werden.</div>';
  }
}
loadStatus();
