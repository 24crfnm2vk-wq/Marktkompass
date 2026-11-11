import { DataUpdater } from "./data-updater.js";
import { waitForPublishedAcwi } from "./acwi-publication.js";

const button = document.getElementById("acwi-update-button");
const status = document.getElementById("acwi-update-status");

async function checkAndUpdateAcwi() {
    if (button) button.disabled = true;
    if (status) status.textContent = "Prüfe automatisch auf neue ACWI-Handelstage …";

    try {
        const updater = new DataUpdater();
        const result = await updater.process([]);

        if (!result.newData || result.newData.length === 0) {
            if (status) status.textContent = "ACWI-Daten sind aktuell. Keine neuen Handelstage vorhanden.";
            window.dispatchEvent(new Event("marktkompass:acwi-ready"));
            return true;
        }

        const first = result.newData[0].date;
        const latest = result.newData[result.newData.length - 1];

        if (status) {
            status.textContent =
                `ACWI-Daten ${result.newData.length} Handelstage (${first} bis ${latest.date}) serverseitig übernommen. Warte auf die Veröffentlichung des neuen Marktstands …`;
        }

        await waitForPublishedAcwi({
            date: latest.date,
            close: latest.close,
            timeoutMs: 180000,
            intervalMs: 5000
        });

        if (status) {
            status.textContent = result.approval?.duplicate
                ? `ACWI-Daten ${result.newData.length} Handelstage (${first} bis ${latest.date}) waren bereits gespeichert. Der veröffentlichte Marktstand wurde erfolgreich abgeglichen.`
                : `ACWI-Daten automatisch übernommen und veröffentlicht: ${result.newData.length} Handelstage (${first} bis ${latest.date}). V25.1 ist aktualisiert.`;
        }

        window.dispatchEvent(new Event("marktkompass:acwi-ready"));
        return true;
    } catch (error) {
        console.error("ACWI-Aktualisierung:", error);
        if (status) {
            status.textContent =
                "ACWI-Prüfung oder Veröffentlichung noch nicht abgeschlossen. Die Intraday-Prüfung bleibt bis zum erfolgreichen Abgleich ausgesetzt.";
        }
        return false;
    } finally {
        if (button) button.disabled = false;
    }
}

function startAcwiCheck() {
    const promise = checkAndUpdateAcwi();
    window.marktkompassAcwiReady = promise;
    return promise;
}

if (button) {
    button.addEventListener("click", startAcwiCheck);
}

// Die Intraday-Prüfung wartet auf diesen vollständigen Ablauf:
// automatische Übernahme und anschließende Veröffentlichung in status.json.
window.marktkompassAcwiReady = startAcwiCheck();
