export async function waitForPublishedAcwi({
    date,
    close,
    timeoutMs = 180000,
    intervalMs = 5000,
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
} = {}) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
        throw new Error("Für die Veröffentlichungsprüfung fehlt ein gültiges ACWI-Datum.");
    }

    const expectedClose = Number(close);
    if (!Number.isFinite(expectedClose) || expectedClose <= 0) {
        throw new Error("Für die Veröffentlichungsprüfung fehlt ein gültiger ACWI-Schlusswert.");
    }

    const deadline = now() + timeoutMs;
    let lastState = "Die öffentliche status.json konnte noch nicht abgeglichen werden.";

    while (now() <= deadline) {
        try {
            const response = await fetchImpl(
                `./status.json?t=${now()}`,
                { cache: "no-store" }
            );

            if (!response.ok) {
                lastState = `status.json antwortet mit HTTP ${response.status}.`;
            } else {
                const status = await response.json();
                const publishedDate = String(status?.date || "");

                if (
                    /^\d{4}-\d{2}-\d{2}$/.test(publishedDate) &&
                    publishedDate > date
                ) {
                    // Ein späterer veröffentlichter Stand ersetzt den angefragten Tag.
                    // Der Worker prüft vor Intraday zusätzlich den exakten neuesten ACWI-Wert.
                    return status;
                }

                if (
                    publishedDate === date &&
                    Number.isFinite(Number(status?.acwi)) &&
                    Number(status.acwi) === expectedClose
                ) {
                    return status;
                }

                lastState = `Veröffentlicht ist bisher ${publishedDate || "kein gültiges Datum"}; erwartet wird ${date} mit ACWI ${expectedClose}.`;
            }
        } catch (error) {
            lastState = error instanceof Error ? error.message : String(error);
        }

        const remaining = deadline - now();
        if (remaining <= 0) break;
        await sleep(Math.min(intervalMs, remaining));
    }

    throw new Error(
        `Der ACWI-Datenstand ${date} wurde innerhalb von ${Math.round(timeoutMs / 1000)} Sekunden nicht exakt veröffentlicht. ${lastState}`
    );
}
