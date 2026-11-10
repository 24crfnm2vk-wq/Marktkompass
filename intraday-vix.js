const WORKER = "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
const button = document.getElementById("intraday-vix-check-button");
const status = document.getElementById("intraday-vix-status");

function formatTimestamp(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
        ? date.toLocaleString("de-DE")
        : "Zeitstempel nicht verfügbar";
}

async function checkIntradayVix() {
    if (!button || !status) return;

    button.disabled = true;
    status.textContent = "Prüfe, ob ein neuer Intraday-VIX-Wert verfügbar ist …";

    try {
        const response = await fetch(
            `${WORKER}/intraday-candidate?t=${Date.now()}`,
            { cache: "no-store" }
        );

        const candidate = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(candidate?.error || `Abfrage fehlgeschlagen (${response.status}).`);
        }

        if (
            candidate?.version !== "intraday-vix-candidate-v1" ||
            candidate.available !== true ||
            !Number.isFinite(Number(candidate.vix)) ||
            Number(candidate.vix) <= 0 ||
            !candidate.timestamp ||
            !candidate.id
        ) {
            status.textContent = candidate?.message ||
                "Derzeit liegt kein neuer Intraday-VIX-Wert zur Bestätigung vor.";
            return;
        }

        const timestamp = formatTimestamp(candidate.timestamp);
        const message =
            "Ein neuer Intraday-VIX-Wert wurde bereitgestellt.\n\n" +
            `VIX-Wert: ${Number(candidate.vix).toFixed(2)} Punkte\n` +
            `Zeitstempel des Datenanbieters: ${timestamp}\n\n` +
            "Soll dieser Wert übernommen und eine vorläufige Neuberechnung gestartet werden?";

        if (!window.confirm(message)) {
            status.textContent = "Intraday-VIX nicht übernommen. Der bisherige Marktstatus bleibt unverändert.";
            return;
        }

        const approval = await fetch(`${WORKER}/intraday-approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                version: "intraday-vix-approval-v1",
                id: candidate.id,
                vix: Number(candidate.vix),
                timestamp: candidate.timestamp
            })
        });

        const result = await approval.json().catch(() => null);

        if (!approval.ok || result?.accepted !== true) {
            throw new Error(result?.error || "Der Intraday-VIX-Wert konnte nicht bestätigt werden.");
        }

        status.textContent =
            `Intraday-VIX ${Number(candidate.vix).toFixed(2)} bestätigt. ` +
            "Die vorläufige Berechnung wurde angestoßen.";
    } catch (error) {
        console.error("Intraday-VIX:", error);
        status.textContent =
            "Intraday-VIX konnte nicht geprüft oder übernommen werden. " +
            "Der bisherige Marktstatus bleibt unverändert.";
    } finally {
        button.disabled = false;
    }
}

if (button) {
    button.addEventListener("click", checkIntradayVix);
}

// Automatische Prüfung beim Laden der Marktkompass-Seite.
checkIntradayVix();
