import { DataUpdater } from "./data-updater.js";

const button = document.getElementById("acwi-update-button");
const status = document.getElementById("acwi-update-status");

if (button && status) {
    button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "Prüfe auf neue ACWI-Handelstage …";

        try {
            const updater = new DataUpdater();

            const result = await updater.process([]);

            if (!result.newData || result.newData.length === 0) {
                status.textContent = "Keine neuen ACWI-Handelstage vorhanden.";
                return;
            }

            if (result.updated) {
                const first = result.newData[0].date;
                const last = result.newData[result.newData.length - 1].date;
                status.textContent =
                    `ACWI-Daten automatisch übernommen: ${result.newData.length} neue Handelstage ` +
                    `(${first} bis ${last}). Die private V25.1-Berechnung wurde angestoßen.`;
            }
        } catch (error) {
            console.error(error);
            status.textContent =
                "Die ACWI-Aktualisierung konnte nicht durchgeführt werden. " +
                "Die bestehende Statusanzeige bleibt unverändert.";
        } finally {
            button.disabled = false;
        }
    });
    
    // Beim Laden der Marktkompass-Seite automatisch auf neue ACWI-Daten prüfen.
    // Der vorhandene Button bleibt für eine erneute manuelle Prüfung verfügbar.
    const runAutomaticCheck = async () => {
        button.disabled = true;
        status.textContent = "Prüfe automatisch auf neue ACWI-Handelstage …";

        try {
            const updater = new DataUpdater();
            const result = await updater.process([]);

            if (!result.newData || result.newData.length === 0) {
                status.textContent = "ACWI-Daten sind aktuell. Keine neuen Handelstage vorhanden.";
                return;
            }

            const first = result.newData[0].date;
            const last = result.newData[result.newData.length - 1].date;
            status.textContent =
                `ACWI-Daten automatisch übernommen: ${result.newData.length} neue Handelstage (${first} bis ${last}). V25.1-Berechnung angestoßen.`;
        } catch (error) {
            console.error(error);
            status.textContent =
                "Automatische ACWI-Prüfung fehlgeschlagen. Der bisherige Marktstatus bleibt unverändert.";
        } finally {
            button.disabled = false;
        }
    };

    // Die bereits vorhandene Schaltfläche nutzt denselben automatischen Ablauf.
    button.addEventListener("click", runAutomaticCheck);
    runAutomaticCheck();
}
