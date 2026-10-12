const ICONS = {
  green: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 9"></path></svg>',
  yellow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg>',
  blue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16 6-6 4 3 6-8"></path><path d="M14 5h6v6"></path></svg>',
  red: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4"></path><path d="M12 16.5h.01"></path></svg>'
};
const PHASES = {
  'NORMAL': { color: 'green', label: 'GRÜN', title: 'NORMAL', description: 'Der Markt befindet sich außerhalb einer erkannten Stressphase. Keine historische Referenzanzeige.' },
  'WARNUNG': { color: 'yellow', label: 'GELB', title: 'WARNUNG', description: 'Erhöhte Aufmerksamkeit ist angebracht. Eine historische Referenz wird in diesem Zustand nicht allein wegen der gelben Farbe angezeigt.' },
  'STABILISIERUNG': { color: 'yellow', label: 'GELB', title: 'STABILISIERUNG', description: 'Der Markt zeigt erste Anzeichen einer Stabilisierung. Ein vergleichbarer historischer Verlauf dient als Orientierung, sofern vorhanden.' },
  'ERSTE VERBESSERUNG': { color: 'yellow', label: 'GELB', title: 'ERSTE VERBESSERUNG', description: 'Die Entwicklung verbessert sich, die Erholung ist aber noch nicht bestätigt.' },
  'STRUKTURELLE VERBESSERUNG': { color: 'yellow', label: 'GELB', title: 'STRUKTURELLE VERBESSERUNG', description: 'Die Verbesserung ist struktureller; die bestätigte Erholung ist noch nicht erreicht.' },
  'ERHOLUNG BESTÄTIGT': { color: 'blue', label: 'BLAU', title: 'ERHOLUNG BESTÄTIGT', description: 'Die vereinbarten Kriterien für eine bestätigte Erholung sind erfüllt.' },
  'STRESS': { color: 'red', label: 'ROT', title: 'STRESS', description: 'Erkannte Stressphase. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'STRESS HOCH': { color: 'red', label: 'ROT', title: 'STRESS HOCH', description: 'Erhöhte Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'STRESS EXTREM': { color: 'red', label: 'ROT', title: 'STRESS EXTREM', description: 'Extreme Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' },
  'AUSSERGEWÖHNLICHER STRESS': { color: 'red', label: 'ROT', title: 'AUSSERGEWÖHNLICHER STRESS', description: 'Außergewöhnliche Stressintensität. Ein vergleichbarer historischer Verlauf wird angezeigt, sofern vorhanden.' }
};
const REFERENCE_STATES = new Set(['STABILISIERUNG','ERSTE VERBESSERUNG','STRUKTURELLE VERBESSERUNG','ERHOLUNG BESTÄTIGT','STRESS','STRESS HOCH','STRESS EXTREM','AUSSERGEWÖHNLICHER STRESS']);

async function loadStatus(){
  const root=document.getElementById('app');
  try{
    const r=await fetch('status.json?ts='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('Statusdatei nicht verfügbar.');
    const s=await r.json();
    const phase=PHASES[s.state]||{color:'gray',label:s.trafficLight||'UNBEKANNT',title:`Status – ${s.state||'unbekannt'}`,description:'Für diesen Zustand ist keine spezielle Darstellung definiert.'};
    const showReference=REFERENCE_STATES.has(s.state);
    const formatPercent=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'–':`${Number(value)>0?'+':''}${Number(value).toFixed(2)} %`;
    const formatNumber=value=>value===null||value===undefined||!Number.isFinite(Number(value))?'–':Number(value).toFixed(2);
    let reference='';
    const h=s.historicalReference;
    if(showReference&&h&&h.found===true){
      reference=`<div class="card"><div class="label">Historischer Referenzverlauf</div>
        <div class="row">Vergleichbarer Zeitpunkt: <b>${h.date||'–'}</b></div>
        <div class="row">Stressereignis begann: ${h.stressStart||'–'}</div>
        <div class="row">Stressniveau damals: ${formatPercent(h.stressLevel)}</div>
        <div class="row">ACWI seit Stressbeginn: ${formatPercent(h.acwiChangeSinceStart)}</div>
        <div class="row">Abstand zur SMA200: ${formatPercent(h.distanceToSma200)}</div>
        <div class="row">VIX: ${formatNumber(h.vix)} Punkte</div>
        <small>Zusatzinformation zur historischen Einordnung – keine Prognose und kein Kauf- oder Verkaufssignal.</small></div>`;
    } else if(showReference){
      reference='<div class="card"><div class="label">Historischer Referenzverlauf</div><div class="row">Kein vergleichbarer Fall für diese Situation gefunden.</div></div>';
    }
    const distance=Number(s.distance);
    const distanceText=Number.isFinite(distance)?`${distance>0?'+':''}${distance.toFixed(2)} %`:'–';
    const distanceStyle=Number.isFinite(distance)&&distance<0?' style="color:red"':'';
    root.innerHTML=`
      <div class="card">
        <div class="phase-banner">
          <div class="phase-icon phase-${phase.color}">${ICONS[phase.color]||''}</div>
          <div><div class="phase-title">${phase.title}</div><p class="phase-description">${phase.description}</p></div>
        </div>
        <div><b>Version:</b> ${s.version||'–'}</div>
        <div><b>Datenstand:</b> ${s.date||'–'}</div>
      </div>
      <div class="card">
        <div class="row"><span class="label">MSCI ACWI:</span> ${formatNumber(s.acwi)} Punkte</div>
        <div class="row"><span class="label">SMA200:</span> ${formatNumber(s.sma200)} Punkte</div>
        <div class="row"><span class="label">Abstand zur SMA200:</span> <span${distanceStyle}>${distanceText}</span></div>
        <div class="row"><span class="label">VIX:</span> ${formatNumber(s.vix)} Punkte</div>
        <div class="row"><span class="label">VIX Tagesveränderung:</span> ${formatPercent(s.vixChange)}</div>
      </div>${reference}`;
  }catch(e){root.innerHTML='<div class="card error">Aktueller Marktstatus konnte nicht geladen werden.</div>';}
}
loadStatus();
// Öffentliche Anzeige regelmäßig aktualisieren; Datenfreigabe bleibt in acwi-update.js.

setInterval(loadStatus, 5000);
