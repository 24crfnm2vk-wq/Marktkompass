/**
 * ==========================================
 * Marktkompass
 * Daten-Updater
 * Version 2.0
 * ==========================================
 *
 * Aufgabe:
 * - lädt die aktuelle ACWI-Datei aus GitHub
 * - erkennt neue ACWI-Handelstage
 * - fragt vor der Übernahme nach
 * - speichert bestätigte neue Daten lokal
 * - verbindet Basisdaten + Erweiterungsdaten
 *
 * Die ursprüngliche CSV-Datei wird NICHT verändert.
 */

export class DataUpdater {

    constructor() {

        this.storageKey =
            "marktkompass.acwi.updates.v1";

        this.bridgeBaseUrl =
            "https://bitter-mountain-11f4.24crfnm2vk.workers.dev";
    }


    getLastDate(data) {

        if (!Array.isArray(data) || data.length === 0) {
            return null;
        }

        return data
            .map(row => row.date)
            .filter(Boolean)
            .sort()
            .at(-1);
    }


    async fetchACWIData() {

        const url =
            `${this.bridgeBaseUrl}/candidate?t=${Date.now()}`;

        const response =
            await fetch(url, {
                cache: "no-store"
            });

        if (!response.ok) {
            throw new Error(
                `Aktuelle ACWI-Kandidaten konnten nicht geladen werden (${response.status}).`
            );
        }

        const payload =
            await response.json();

        if (!payload || payload.version !== "acwi-candidate-v1" || !Array.isArray(payload.data)) {
            throw new Error(
                "Unerwartetes Format der ACWI-Kandidaten vom Server."
            );
        }

        return payload.data
            .map(row => ({
                date: String(row?.date ?? "").trim(),
                close: Number(row?.close)
            }))
            .filter(row =>
                /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
                Number.isFinite(row.close)
            );
    }


    async approveWithBridge(newData) {

        const response =
            await fetch(`${this.bridgeBaseUrl}/approve`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    version: "acwi-approval-v1",
                    data: newData
                })
            });

        const payload =
            await response.json().catch(() => null);

        if (!response.ok || !payload?.accepted) {
            const message =
                payload?.error ||
                payload?.message ||
                `Serverfreigabe fehlgeschlagen (${response.status}).`;

            throw new Error(message);
        }

        return payload;
    }

    loadStoredUpdates() {

        try {

            const stored =
                localStorage.getItem(
                    this.storageKey
                );


            if (!stored) {
                return [];
            }


            const data =
                JSON.parse(stored);


            if (!Array.isArray(data)) {
                return [];
            }


            return data;

        } catch (error) {

            console.error(
                "Fehler beim Laden der gespeicherten ACWI-Ergänzungen:",
                error
            );

            return [];
        }
    }


    saveUpdates(data) {

        if (!Array.isArray(data)) {

            throw new Error(
                "Die zu speichernden Daten sind kein Array."
            );
        }


        localStorage.setItem(
            this.storageKey,
            JSON.stringify(data)
        );
    }


    mergeStoredUpdates(baseData) {

        const storedUpdates =
            this.loadStoredUpdates();


        return this.mergeData(
            baseData,
            storedUpdates
        );
    }


    mergeData(baseData, additionalData) {

        const map =
            new Map();


        for (const row of baseData || []) {

            if (!row.date) {
                continue;
            }


            const close =
                Number(row.close);


            if (!Number.isFinite(close)) {
                continue;
            }


            map.set(
                row.date,
                {
                    date: row.date,
                    close
                }
            );
        }


        for (const row of additionalData || []) {

            if (!row.date) {
                continue;
            }


            const close =
                Number(row.close);


            if (!Number.isFinite(close)) {
                continue;
            }


            map.set(
                row.date,
                {
                    date: row.date,
                    close
                }
            );
        }


        return Array.from(
            map.values()
        )
            .sort(
                (a, b) =>
                    a.date.localeCompare(b.date)
            );
    }


    findNewData(existingData, externalData) {

        const lastDate =
            this.getLastDate(
                existingData
            );


        if (!lastDate) {

            return externalData || [];
        }


        return (externalData || [])
            .filter(row => {

                if (!row.date) {
                    return false;
                }


                return row.date > lastDate;
            })
            .map(row => ({

                date: row.date,

                close: Number(row.close)

            }))
            .filter(row =>
                Number.isFinite(row.close)
            );
    }


    validateData(data) {

        if (!Array.isArray(data)) {
            return false;
        }


        for (const row of data) {

            if (!row.date) {
                return false;
            }


            if (!Number.isFinite(
                Number(row.close)
            )) {

                return false;
            }
        }


        return true;
    }


    acceptNewData(
        existingData,
        newData
    ) {

        if (!this.validateData(newData)) {

            throw new Error(
                "Die neuen ACWI-Daten sind nicht plausibel."
            );
        }


        const storedUpdates =
            this.loadStoredUpdates();


        const combined =
            this.mergeData(
                storedUpdates,
                newData
            );


        this.saveUpdates(
            combined
        );


        return this.mergeData(
            existingData,
            combined
        );
    }


    async askForAcceptance(newData) {

        if (
            !newData ||
            newData.length === 0
        ) {

            return false;
        }


        const firstDate =
            newData[0].date;


        const lastDate =
            newData[newData.length - 1].date;


        const message =
            `${newData.length} neue ACWI-Handelstage gefunden.\n\n` +
            `Von ${firstDate} bis ${lastDate}.\n\n` +
            `Sollen diese Daten in den Marktkompass übernommen werden?`;


        return window.confirm(
            message
        );
    }


    async process(
        existingData,
        externalData = null
    ) {

        const currentData =
            this.mergeStoredUpdates(
                existingData
            );


        if (!externalData) {

            externalData =
                await this.fetchACWIData();
        }


        const newData =
            this.findNewData(
                currentData,
                externalData
            );


        if (newData.length === 0) {

            return {

                updated: false,

                newData: [],

                data: currentData

            };
        }


        const accepted =
            await this.askForAcceptance(
                newData
            );


        if (!accepted) {

            return {

                updated: false,

                cancelled: true,

                newData,

                data: currentData

            };
        }


        await this.approveWithBridge(
            newData
        );

        const updatedData =
            this.acceptNewData(
                currentData,
                newData
            );


        return {

            updated: true,

            newData,

            data: updatedData

        };
    }

}