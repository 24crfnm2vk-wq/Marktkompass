import { DataUpdater } from "./data-updater.js";

const button = document.getElementById("acwi-update-button");
const status = document.getElementById("acwi-update-status");
const STATUS_FILE = "./status.json";
const PUBLISH_WAIT_MS = 180000;
const POLL_INTERVAL_MS = 3000;

function sameNumber(a, b) {
    return Number.isFinite(Number(a)) &&
        Number.isFinite(Number(b)) &&
        Math.abs(Number(a) - Number(b)) <= 1e-8;
}

async function waitForPublishedAcwi(expectedDate, expectedClose) {
    const deadline = Date.now() + PUBLISH_WAIT_MS;

    while (Date.now() < deadline) {
        const response = await fetch(`${STATUS_FILE}?t=${Date.now()}`, {
            cache: "no-store"
        });

        if (response.ok) {
            const published = await response.json();
            if (
                published?.date === expectedDate &&
                sameNumber(published?.acwi, expectedClose)
            ) {
                return published;
            }
        }

        await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error("Der freigegebene ACWI-Datenstand wurde noch nicht veröffentlicht.");
}

async function checkAndUpdateAcwi() {
    if (button) button.disabled = true;
    if (status) status.textContent = "Prüfe automatisch auf neue ACWI-Handelstage …";

    let approvalAccepted = false;

    try {
        const updater = new DataUpdater();
        const result = await updater.process([], null, {
            confirmApproval: newData => {
                const first = newData[0].date;
                const last = newData.at(-1).date;
                const count = newData.length;

                return window.confirm(
                    `Es wurden ${count} neue ACWI-Handelstage gefunden.\n\n` +
                    `Zeitraum: ${first} bis ${last}\n\n` +
                    "Sollen diese Daten übernommen und die Marktberechnung anschließend aktualisiert werden?"
                );
            }
        });

        if (result.pendingApproval) {
            const first = result.newData[0].date;
            const last = result.newData.at(-1).date;
            if (status) {
                status.textContent =
                    `${result.newData.length} neue ACWI-Handelstage (${first} bis ${last}) liegen vor, wurden aber nicht übernommen. Der bisherige freigegebene Datenstand bleibt maßgeblich.`;
            }
            return result;
        }

        if (!result.newData || result.newData.length === 0) {
            if (status) {
                status.textContent = "ACWI-Daten sind aktuell. Keine neuen Handelstage vorhanden.";
            }
            return result;
        }

        approvalAccepted = true;
        const latest = result.newData.at(-1);

        if (status) {
            status.textContent =
                `ACWI-Freigabe bestätigt. Warte auf Veröffentlichung des Datenstands ${latest.date} …`;
        }

        await waitForPublishedAcwi(latest.date, latest.close);

        if (status) {
            status.textContent =
                `ACWI-Daten übernommen und veröffentlicht: ${result.newData.length} neue Handelstage bis ${latest.date}. Die Intraday-Prüfung kann jetzt fortgesetzt werden.`;
        }

        // Falls die Freigabe erst nach dem ersten Seitenaufruf erfolgt,
        // startet die Intraday-Prüfung erst nach bestätigter Veröffentlichung.
        window.dispatchEvent(new Event("marktkompass:acwi-published"));
        return result;

    } catch (error) {
        console.error("ACWI-Aktualisierung:", error);
        if (status) {
            status.textContent = approvalAccepted
                ? "ACWI-Daten wurden freigegeben, aber die Veröffentlichung konnte noch nicht bestätigt werden. Die Intraday-Prüfung bleibt bis zur Veröffentlichung ausgesetzt."
                : "Automatische ACWI-Prüfung fehlgeschlagen. Der bisherige Marktstatus bleibt unverändert.";
        }
        return approvalAccepted
            ? { publicationPending: true }
            : { error: true };
    } finally {
        if (button) button.disabled = false;
    }
}

if (button) {
    button.addEventListener("click", () => {
        window.marktkompassAcwiReady = checkAndUpdateAcwi();
    });
}

// Beim Öffnen zunächst nur Kandidaten prüfen und – falls vorhanden –
// ausdrücklich um Freigabe bitten. Intraday wartet auf dieses Ergebnis.
window.marktkompassAcwiReady = checkAndUpdateAcwi();
