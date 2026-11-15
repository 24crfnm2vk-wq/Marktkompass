import { DataUpdater } from "./data-updater.js";

const status = document.getElementById("acwi-update-status");

async function updateAcwiAutomatically() {
    if (status) status.textContent = "ACWI-Daten werden automatisch geprüft …";

    try {
        const updater = new DataUpdater();
        const result = await updater.process([]);

        if (!result.newData || result.newData.length === 0) {
            if (status) status.textContent = "ACWI-Datenstand ist aktuell.";
            return;
        }

        if (result.updated) {
            const first = result.newData[0].date;
            const last = result.newData[result.newData.length - 1].date;
            if (status) {
                status.textContent =
                    `ACWI: ${result.newData.length} neue Handelstage (${first} bis ${last}) technisch geprüft und automatisch übernommen. Die private V25.1-Neuberechnung wurde angestoßen.`;
            }
        }
    } catch (error) {
        console.error("Automatische ACWI-Aktualisierung:", error);
        if (status) {
            status.textContent =
                "Automatische ACWI-Prüfung derzeit nicht möglich. Der zuletzt veröffentlichte Marktstatus bleibt unverändert.";
        }
    }
}

updateAcwiAutomatically();
