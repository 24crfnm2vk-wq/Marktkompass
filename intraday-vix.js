const WORKER = "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
const button = document.getElementById("intraday-vix-check-button");
const status = document.getElementById("intraday-vix-status");

async function checkIntradayVix() {
    if (button) button.disabled = true;
    if (status) status.textContent = "Prüfe automatisch, ob ein neuer Intraday-VIX-Wert vorliegt …";

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
            !candidate.acwiDate ||
            !candidate.id
        ) {
            if (status) {
                status.textContent = candidate?.message ||
                    "Derzeit liegt kein neuer Intraday-VIX-Wert vor. Der bisherige Marktstatus bleibt unverändert.";
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
                acwiDate: candidate.acwiDate
            })
        });

        const result = await approval.json().catch(() => null);

        if (!approval.ok || result?.accepted !== true) {
            throw new Error(result?.error || "Der Intraday-VIX-Wert konnte nicht automatisch gespeichert werden.");
        }

        if (status) {
            status.textContent = result.duplicate
                ? "Dieser Intraday-VIX-Messpunkt ist bereits gespeichert."
                : `Intraday-VIX ${Number(candidate.vix).toFixed(2)} Punkte automatisch gespeichert. Vorläufige V25.1-Berechnung angestoßen.`;
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
