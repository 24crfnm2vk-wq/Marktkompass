/**
 * ==========================================
 * Marktkompass
 * Daten-Updater
 * V3.1 – geräteübergreifende Synchronisation
 * ==========================================
 *
 * Aufgabe:
 * - lädt aktuelle ACWI-Kandidatendaten über die Cloudflare-Bridge
 * - verwendet status.json als serverseitigen Synchronisationsstand
 * - erkennt dadurch auf PC und iPhone denselben Freigabestand
 * - fragt vor einer neuen Übernahme ausdrücklich nach
 * - speichert bestätigte neue Daten lokal
 * - verbindet Basisdaten + Erweiterungsdaten
 *
 * Die ursprüngliche ACWI-Masterdatei wird NICHT verändert.
 */

export class DataUpdater {

    constructor() {

        this.storageKey =
            "marktkompass.acwi.updates.v1";

        this.latestFile =
            "https://bitter-mountain-11f4.24crfnm2vk.workers.dev/candidate";

        this.statusFile =
            "./status.json";
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
            `${this.latestFile}?t=${Date.now()}`;

        const response =
            await fetch(url, {
                cache: "no-store"
            });


        if (!response.ok) {

            throw new Error(
                `Aktuelle ACWI-Kandidatendaten konnten nicht geladen werden (${response.status}).`
            );
        }


        const payload =
            await response.json();


        if (
            !payload ||
            payload.version !== "acwi-candidate-v1" ||
            !Array.isArray(payload.data)
        ) {

            throw new Error(
                "Unerwartetes Format der ACWI-Kandidatendaten."
            );
        }


        return payload.data
            .map(row => ({
                date: String(row.date),
                close: Number(row.close)
            }))
            .filter(row =>
                row.date &&
                Number.isFinite(row.close)
            );
    }


    async fetchPublishedStatus() {

        const url =
            `${this.statusFile}?t=${Date.now()}`;

        const response =
            await fetch(url, {
                cache: "no-store"
            });


        if (!response.ok) {

            throw new Error(
                `Aktueller veröffentlichter Marktstand konnte nicht geladen werden (${response.status}).`
            );
        }


        const status =
            await response.json();


        if (
            !status ||
            typeof status.date !== "string"
        ) {

            throw new Error(
                "Die veröffentlichte status.json enthält keinen gültigen Datenstand."
            );
        }


        return status;
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


    findNewData(existingData, externalData, publishedDate = null) {

        const localLastDate =
            this.getLastDate(
                existingData
            );

        /*
         * Der serverseitig veröffentlichte Datenstand ist
         * die geräteübergreifende Freigabe-Referenz.
         *
         * Dadurch können Firefox und Safari nicht mehr
         * unterschiedliche lokale Freigabestände melden.
         */
        const effectiveLastDate =
            [localLastDate, publishedDate]
                .filter(Boolean)
                .sort()
                .at(-1);


        if (!effectiveLastDate) {

            return externalData || [];
        }


        return (externalData || [])
            .filter(row => {

                if (!row.date) {
                    return false;
                }


                return row.date > effectiveLastDate;
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


    async approveWithBridge(newData) {

        const response =
            await fetch(
                "https://bitter-mountain-11f4.24crfnm2vk.workers.dev/approve",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            version:
                                "acwi-approval-v1",

                            data:
                                newData
                        })
                }
            );


        const payload =
            await response
                .json()
                .catch(() => null);


        if (
            !response.ok ||
            !payload?.accepted
        ) {

            throw new Error(
                payload?.error ||
                "Die ACWI-Freigabe konnte serverseitig nicht gespeichert werden."
            );
        }


        return payload;
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


        /*
         * status.json ist die serverseitige,
         * geräteübergreifende Referenz.
         *
         * Fällt der Abruf aus, wird bewusst NICHT
         * stillschweigend auf einen unsicheren Zustand
         * zurückgefallen.
         */
        const publishedStatus =
            await this.fetchPublishedStatus();


        const newData =
            this.findNewData(
                currentData,
                externalData,
                publishedStatus.date
            );


        if (newData.length === 0) {

            return {

                updated: false,

                newData: [],

                data: currentData,

                publishedDate:
                    publishedStatus.date

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

                data: currentData,

                publishedDate:
                    publishedStatus.date

            };
        }


        /*
         * Serverseitige Freigabe zuerst.
         * Erst bei erfolgreicher Freigabe wird
         * lokal gespeichert.
         */
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

            data: updatedData,

            publishedDate:
                publishedStatus.date

        };
    }

}