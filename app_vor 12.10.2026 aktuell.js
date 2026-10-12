async function loadStatus(){
  const root=document.getElementById("app");
  try{
    const r=await fetch("status.json?ts="+Date.now(),{cache:"no-store"});
    if(!r.ok) throw new Error("Statusdatei nicht verfügbar.");
    const s=await r.json();

    const cls=s.trafficLight==="GRÜN"?"green":s.trafficLight==="GELB"?"yellow":s.trafficLight==="ROT"?"red":"gray";

    const formatReferencePercent = value =>
      value === null || value === undefined || !Number.isFinite(Number(value))
        ? "–"
        : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)} %`;
    const formatReferenceNumber = value =>
      value === null || value === undefined || !Number.isFinite(Number(value))
        ? "–"
        : Number(value).toFixed(2);

    let reference="";
    const stressStates = ["STRESS", "STRESS HOCH", "STRESS EXTREM", "AUSSERGEWÖHNLICHER STRESS"];
    const isStress = stressStates.includes(s.state);
    if(isStress && s.historicalReference && s.historicalReference.found === false){
      reference=`<div class="card">
        <div class="label">Historischer Referenzfall</div>
        <div class="row">Kein vergleichbarer Fall für diese Situation gefunden.</div>
      </div>`;
    } else if(isStress && s.historicalReference && s.historicalReference.found === true){
      const h=s.historicalReference;
      reference=`<div class="card">
        <div class="label">Historischer Referenzfall</div>
        <div class="row">Vergleichbarer Zeitpunkt: <b>${h.date}</b></div>
        <div class="row">Stressereignis begann: ${h.stressStart}</div>
        <div class="row">Stressniveau damals: ${formatReferencePercent(h.stressLevel)}</div>
        <div class="row">ACWI seit Stressbeginn: ${formatReferencePercent(h.acwiChangeSinceStart)}</div>
        <div class="row">Abstand zur SMA200: ${formatReferencePercent(h.distanceToSma200)}</div>
        <div class="row">VIX: ${formatReferenceNumber(h.vix)} Punkte</div>
        <small>Nur zur historischen Einordnung eines erkannten Stressereignisses; keine Prognose.</small>
      </div>`;
    }

    const distance = Number(s.distance);
    const distanceText = distance > 0
      ? `+${distance.toFixed(2)} %`
      : `${distance.toFixed(2)} %`;
    const distanceStyle = distance < 0 ? ' style="color:red"' : '';

    root.innerHTML=`
      <div class="card">
        <div><b>Version:</b> ${s.version}</div>
        <div><b>Datenstand:</b> ${s.date}</div>
        <div class="traffic"><span class="dot ${cls}"></span>Ampel: ${s.trafficLight}</div>
        <div class="row"><span class="label">Marktstatus:</span> ${s.state}</div>
      </div>
      <div class="card">
        <div class="row"><span class="label">MSCI ACWI:</span> ${Number(s.acwi).toFixed(2)} Punkte</div>
        <div class="row"><span class="label">SMA200:</span> ${Number(s.sma200).toFixed(2)} Punkte</div>
        <div class="row"><span class="label">Abstand zur SMA200:</span> <span${distanceStyle}>${distanceText}</span></div>
        <div class="row"><span class="label">VIX:</span> ${Number(s.vix).toFixed(2)} Punkte</div>
        <div class="row"><span class="label">VIX Tagesveränderung:</span> ${Number(s.vixChange).toFixed(2)} %</div>
      </div>
      ${reference}
    `;
  }catch(e){
    root.innerHTML='<div class="card error">Aktueller Marktstatus konnte nicht geladen werden.</div>';
  }
}
loadStatus();

// Automatische Aktualisierung der öffentlichen Anzeige.
// Prüfung der veröffentlichten status.json alle 5 Sekunden.
setInterval(loadStatus, 5000);
