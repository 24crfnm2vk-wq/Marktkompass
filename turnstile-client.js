const TURNSTILE_SITE_KEY = "TURNSTILE_SITEKEY_TO_BE_CONFIGURED";
const widgets = new Map();

function waitForTurnstileApi() {
    if (window.turnstile) return Promise.resolve(window.turnstile);

    return new Promise((resolve, reject) => {
        let attempts = 0;
        const timer = window.setInterval(() => {
            attempts++;
            if (window.turnstile) {
                window.clearInterval(timer);
                resolve(window.turnstile);
            } else if (attempts >= 200) {
                window.clearInterval(timer);
                reject(new Error("Cloudflare Turnstile konnte nicht geladen werden."));
            }
        }, 100);
    });
}

function rejectPending(widget, message) {
    if (!widget?.pending) return;
    window.clearTimeout(widget.timeout);
    const reject = widget.pending.reject;
    widget.pending = null;
    reject(new Error(message));
}

async function getWidget(action) {
    const turnstile = await waitForTurnstileApi();
    let widget = widgets.get(action);
    if (widget) return { turnstile, widget };

    const container = document.createElement("div");
    container.id = `marktkompass-turnstile-${action}`;
    container.className = "marktkompass-turnstile-widget";
    const host = document.getElementById("turnstile-widgets") || document.body;
    host.appendChild(container);

    widget = {
        id: null,
        pending: null,
        timeout: null
    };

    widget.id = turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        appearance: "interaction-only",
        execution: "execute",
        callback: token => {
            if (!widget.pending) return;
            window.clearTimeout(widget.timeout);
            const resolve = widget.pending.resolve;
            widget.pending = null;
            resolve(token);
        },
        "error-callback": () => rejectPending(widget, "Die Cloudflare-Sicherheitsprüfung ist fehlgeschlagen."),
        "expired-callback": () => rejectPending(widget, "Die Cloudflare-Sicherheitsprüfung ist abgelaufen. Bitte erneut versuchen.")
    });

    widgets.set(action, widget);
    return { turnstile, widget };
}

export async function getTurnstileToken(action) {
    if (TURNSTILE_SITE_KEY === "TURNSTILE_SITEKEY_TO_BE_CONFIGURED") {
        throw new Error("Die Cloudflare-Turnstile-Sitekey ist noch nicht konfiguriert. Die Freigabe bleibt vorsorglich gesperrt.");
    }

    if (!["acwi_approve", "intraday_approve"].includes(action)) {
        throw new Error("Unbekannte Sicherheitsaktion.");
    }

    const { turnstile, widget } = await getWidget(action);
    if (widget.pending) {
        throw new Error("Eine Sicherheitsprüfung läuft bereits.");
    }

    return new Promise((resolve, reject) => {
        widget.pending = { resolve, reject };
        widget.timeout = window.setTimeout(() => {
            rejectPending(widget, "Zeitüberschreitung bei der Cloudflare-Sicherheitsprüfung.");
        }, 30000);

        try {
            turnstile.reset(widget.id);
            turnstile.execute(widget.id);
        } catch (error) {
            rejectPending(
                widget,
                error instanceof Error ? error.message : "Cloudflare-Sicherheitsprüfung konnte nicht gestartet werden."
            );
        }
    });
}
