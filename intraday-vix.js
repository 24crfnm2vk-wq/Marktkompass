import { getTurnstileToken } from "./turnstile-client.js";

const WORKER = "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
const button = document.getElementById("intraday-vix-check-button");
const status = document.getElementById("intraday-vix-status");

async function checkIntradayVix() {
    if (button) button.disabled = true;
    if (status) status.textContent = "Prüfe den aktuellsten verfügbaren VIX-Wert …";

    try {
        // Erst die automatische ACWI-Prüfung abschließen, damit der
        // aktuelle VIX mit dem jüngsten freigegebenen ACWI-Wert berechnet wird.
        if (window.marktkompassAcwiReady) {
            await window.marktkompassAcwiReady;
        }

        const response = await fetch(
            `${WORKER}/intraday-candidate?t=${Date.now()}`,
            { cache: "no-store" }
        );

        const candidate = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(candidate?.error || `Abfrage fehlgeschlagen (${response.status}).`);
        }

        if (candidate?.version !== "intraday-vix-candidate-v1") {
            throw new Error("Unerwartetes Format der Intraday-VIX-Antwort.");
        }

        if (candidate.available !== true) {
            if (candidate.regularRefreshRequired === true) {
                const refresh = await fetch(`${WORKER}/intraday-approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        version: "intraday-vix-approval-v1",
                        mode: "regular-refresh",
                        turnstileToken: await getTurnstileToken("intraday_approve")
                    })
                });
                const refreshResult = await refresh.json().catch(() => null);
                if (!refresh.ok || typeof refreshResult?.calculationStarted !== "boolean") {
                    throw new Error(refreshResult?.error || "Der aktuelle reguläre Datenstand konnte nicht geprüft werden.");
                }
                if (status) {
                    status.textContent = refreshResult.calculationStarted
                        ? "Regulärer ACWI-/VIX-Schlusskurs vorhanden. Aktuelle Berechnung wurde angestoßen."
                        : "Der reguläre ACWI-/VIX-Datenstand ist bereits aktuell.";
                }
            } else if (status) {
                status.textContent = candidate?.message || "Der reguläre Datenstand ist bereits aktuell.";
            }
            return;
        }

        if (
            !Number.isFinite(Number(candidate.vix)) ||
            Number(candidate.vix) <= 0 ||
            !candidate.timestamp ||
            !candidate.acwiDate ||
            !candidate.id
        ) {
            throw new Error("Der Intraday-VIX-Kandidat enthält unvollständige Daten.");
        }

        if (candidate.alreadyPublished === true) {
            if (status) {
                status.textContent =
                    "Der aktuelle Intraday-VIX-Wert ist bereits mit dem neuesten ACWI-Datenstand veröffentlicht.";
            }
            return;
        }

        // Der Kandidat wird nach erfolgreicher technischer Prüfung automatisch gespeichert.
        const approval = await fetch(`${WORKER}/intraday-approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                version: "intraday-vix-approval-v1",
                id: candidate.id,
                vix: Number(candidate.vix),
                timestamp: candidate.timestamp,
                acwiDate: candidate.acwiDate,
                turnstileToken: await getTurnstileToken("intraday_approve")
            })
        });

        const result = await approval.json().catch(() => null);

        if (!approval.ok || result?.accepted !== true) {
            throw new Error(result?.error || "Der Intraday-VIX-Wert konnte nicht automatisch gespeichert werden.");
        }

        if (status) {
            if (result.calculationStarted === false && result.calculationPending === true) {
                status.textContent =
                    "Die Berechnung dieses Intraday-Wertes wurde bereits angestoßen. Es wird kein zweiter Berechnungslauf gestartet.";
            } else if (result.calculationStarted === false) {
                status.textContent = "Der aktuellste Intraday-VIX-Wert und der ACWI-Datenstand sind bereits berechnet.";
            } else if (result.duplicate) {
                status.textContent = `Intraday-VIX ${Number(candidate.vix).toFixed(2)} Punkte mit dem neuesten ACWI-Wert vorläufig neu berechnet. Kein zusätzlicher historischer Messpunkt gespeichert.`;
            } else {
                status.textContent = `Intraday-VIX ${Number(candidate.vix).toFixed(2)} Punkte gespeichert. Vorläufige V25.1-Berechnung angestoßen.`;
            }
        }
    } catch (error) {
        console.error("Intraday-VIX:", error);
        if (status) {
            status.textContent =
                "Intraday-VIX konnte nicht geprüft oder gespeichert werden. " +
                "Der bisherige Marktstatus bleibt unverändert.";
        }
    } finally {
        if (button) button.disabled = false;
    }
}

if (button) {
    button.addEventListener("click", checkIntradayVix);
}

// Automatische Prüfung beim Laden; erneute Prüfung über den vorhandenen Button möglich.
checkIntradayVix();
