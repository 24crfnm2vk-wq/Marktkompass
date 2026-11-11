import { DataUpdater } from "./data-updater.js";

const WORKER = "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
const button = document.getElementById("start-test");
const resultBox = document.getElementById("result");
const logList = document.getElementById("log");

function log(message, kind = "") {
    const item = document.createElement("li");
    item.textContent = message;
    if (kind) item.className = kind;
    logList.appendChild(item);
}

function setResult(message, kind = "") {
    resultBox.textContent = message;
    resultBox.className = kind;
}

async function getJson(url, options = {}) {
    const response = await fetch(url, {
        cache: "no-store",
        ...options
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error || `HTTP-Fehler ${response.status}`);
    }
    return payload;
}

async function waitForStatus(matches, description) {
    const deadline = Date.now() + 180000;

    while (Date.now() < deadline) {
        const status = await getJson(`./status.json?ts=${Date.now()}`);
        if (matches(status)) return status;
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error(`Zeitüberschreitung: ${description} wurde nicht innerhalb von 3 Minuten veröffentlicht.`);
}

function sameNumber(a, b) {
    return Number.isFinite(Number(a)) &&
        Number.isFinite(Number(b)) &&
        Math.abs(Number(a) - Number(b)) <= 1e-8;
}

async function startTest() {
    button.disabled = true;
    logList.replaceChildren();
    setResult("Test läuft …");

    try {
        log("1. ACWI-Datenprüfung wird abgeschlossen.");
        const updater = new DataUpdater();
        const acwi = await updater.process([]);
        log(
            acwi.newData?.length
                ? `ACWI-Erweiterung freigegeben: ${acwi.newData.length} neue Handelstage bis ${acwi.newData.at(-1).date}.`
                : `Keine neuen ACWI-Handelstage. Veröffentlichter Datenstand: ${acwi.publishedDate}.`
        );

        log("2. Intraday-VIX und regulärer Schlusskurs werden geprüft.");
        const candidate = await getJson(`${WORKER}/intraday-candidate?t=${Date.now()}`);

        if (candidate.version !== "intraday-vix-candidate-v1") {
            throw new Error("Unerwartetes Antwortformat des Workers.");
        }

        if (candidate.available !== true) {
            if (candidate.regularRefreshRequired === true) {
                log(
                    `Regulärer Schlusskurs ${candidate.regularDate} vorhanden; Intraday hat keinen Vorrang.`,
                    "warn"
                );
                const refresh = await getJson(`${WORKER}/intraday-approve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        version: "intraday-vix-approval-v1",
                        mode: "regular-refresh"
                    })
                });

                if (refresh.calculationStarted === true) {
                    log("Reguläre V25.1-Neuberechnung wurde angestoßen.");
                } else if (refresh.calculationPending === true) {
                    log("Reguläre Neuberechnung läuft bereits; kein zweiter Lauf wird gestartet.");
                } else {
                    log("Regulärer Datenstand ist bereits aktuell.");
                }

                await waitForStatus(
                    status =>
                        status.date === candidate.regularDate &&
                        status.isIntraday !== true &&
                        sameNumber(status.acwi, candidate.acwiClose) &&
                        sameNumber(status.vix, candidate.regularVix),
                    "regulärer ACWI-/VIX-Datenstand"
                );
                log("Regulärer Status wurde erfolgreich veröffentlicht.", "ok");
                setResult("Test erfolgreich: regulärer Schlusskurs hat Vorrang.", "ok");
                return;
            }

            log(candidate.message || "Regulärer Datenstand ist aktuell.", "ok");
            setResult("Test erfolgreich: regulärer Datenstand ist bereits aktuell.", "ok");
            return;
        }

        if (
            !Number.isFinite(Number(candidate.vix)) ||
            Number(candidate.vix) <= 0 ||
            !candidate.timestamp ||
            !candidate.acwiDate ||
            !candidate.id ||
            !Number.isFinite(Number(candidate.acwiClose))
        ) {
            throw new Error("Der Intraday-Kandidat enthält unvollständige Daten.");
        }

        log(`Intraday-VIX: ${Number(candidate.vix).toFixed(2)} Punkte.`);
        log(`Anbieter-Zeitstempel: ${candidate.timestamp}.`);
        log(`Zugehöriger ACWI-Datenstand: ${candidate.acwiDate} / ${candidate.acwiClose} Punkte.`);
        log(
            candidate.cooldownActive
                ? `15-Minuten-Cooldown aktiv; zentraler Cache verwendet. Nächste Abfrage frühestens: ${candidate.nextCheckAt}.`
                : "15-Minuten-Cooldown abgelaufen oder ACWI-Datenstand geändert; aktuelle Quelle wurde geprüft."
        );

        if (candidate.alreadyPublished === true) {
            log("Genau dieser Intraday-Wert ist mit diesem ACWI-Schlusswert bereits veröffentlicht.", "ok");
            setResult("Test erfolgreich: kein doppelter Berechnungslauf erforderlich.", "ok");
            return;
        }

        log("3. Intraday-Kandidat wird serverseitig bestätigt.");
        const approval = await getJson(`${WORKER}/intraday-approve`, {
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

        if (approval.calculationStarted === true) {
            log("V25.1-Berechnung wurde angestoßen.");
        } else if (approval.calculationPending === true) {
            log("Berechnung dieses Kandidaten läuft bereits; kein zweiter Lauf wird gestartet.");
        } else {
            log("Berechnung ist bereits abgeschlossen.");
        }

        log("4. Veröffentlichung des Ergebnisses wird geprüft.");
        await waitForStatus(
            status =>
                status.date === candidate.acwiDate &&
                status.isIntraday === true &&
                status.intradayTimestamp === candidate.timestamp &&
                sameNumber(status.vix, candidate.vix) &&
                sameNumber(status.acwi, candidate.acwiClose),
            "Intraday-Status"
        );

        log("Intraday-Status wurde mit exakt diesem ACWI- und VIX-Datenstand veröffentlicht.", "ok");
        setResult("Test erfolgreich: Intraday-VIX und ACWI wurden gemeinsam veröffentlicht.", "ok");
    } catch (error) {
        console.error("Kontrollierter Intraday-Test:", error);
        log(error instanceof Error ? error.message : String(error), "error");
        setResult("Test nicht vollständig abgeschlossen. Der bisherige veröffentlichte Status bleibt maßgeblich.", "error");
    } finally {
        button.disabled = false;
    }
}

button.addEventListener("click", startTest);
