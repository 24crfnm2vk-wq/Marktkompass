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

            if (result.cancelled) {
                status.textContent = "Die neuen ACWI-Daten wurden nicht freigegeben.";
                return;
            }

            if (result.updated) {
                const first = result.newData[0].date;
                const last = result.newData[result.newData.length - 1].date;
                status.textContent =
                    `ACWI-Erweiterung freigegeben: ${result.newData.length} neue Handelstage ` +
                    `(${first} bis ${last}). Die private V25.1-Berechnung wird nun angestoßen.`;
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
}
