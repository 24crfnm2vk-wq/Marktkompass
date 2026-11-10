import { DataUpdater } from "./data-updater.js";

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
            return;
        }

        const first = result.newData[0].date;
        const last = result.newData[result.newData.length - 1].date;

        if (status) {
            status.textContent = result.approval?.duplicate
                ? (result.approval?.calculationStarted
                    ? `ACWI-Daten ${result.newData.length} Handelstage (${first} bis ${last}) waren bereits gespeichert. Da die Veröffentlichung noch zurücklag, wurde die Berechnung erneut angestoßen.`
                    : `ACWI-Daten ${result.newData.length} Handelstage (${first} bis ${last}) waren bereits gespeichert und veröffentlicht. Keine erneute Berechnung erforderlich.`)
                : `ACWI-Daten automatisch übernommen: ${result.newData.length} neue Handelstage (${first} bis ${last}). V25.1-Berechnung angestoßen.`;
        }
    } catch (error) {
        console.error("ACWI-Aktualisierung:", error);
        if (status) {
            status.textContent =
                "Automatische ACWI-Prüfung fehlgeschlagen. Der bisherige Marktstatus bleibt unverändert.";
        }
    } finally {
        if (button) button.disabled = false;
    }
}

if (button) {
    button.addEventListener("click", checkAndUpdateAcwi);
}

// Automatische Prüfung beim Laden der Marktkompass-Seite.
checkAndUpdateAcwi();
