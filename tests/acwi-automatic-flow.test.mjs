import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const updaterSource = await readFile(new URL("../data-updater.js", import.meta.url), "utf8");
const updaterModule = await import(
  "data:text/javascript;base64," + Buffer.from(updaterSource).toString("base64")
);
const { DataUpdater } = updaterModule;

test("ACWI wird ohne Dialog serverseitig übernommen und danach lokal gespeichert", async () => {
  const updater = new DataUpdater();
  const order = [];
  updater.mergeStoredUpdates = () => [];
  updater.fetchACWIData = async () => [{ date: "2026-11-13", close: 1118.25 }];
  updater.fetchPublishedStatus = async () => ({ date: "2026-11-12" });
  updater.approveWithBridge = async data => {
    order.push("server-approve");
    assert.equal(data.length, 1);
    return { accepted: true };
  };
  updater.acceptNewData = (current, data) => {
    order.push("local-save");
    return [...current, ...data];
  };

  const result = await updater.process([]);

  assert.deepEqual(order, ["server-approve", "local-save"]);
  assert.equal(result.updated, true);
  assert.equal(result.newData[0].date, "2026-11-13");
});

test("bei fehlgeschlagener Serverfreigabe erfolgt keine lokale Übernahme", async () => {
  const updater = new DataUpdater();
  let localSaveCalled = false;
  updater.mergeStoredUpdates = () => [];
  updater.fetchACWIData = async () => [{ date: "2026-11-13", close: 1118.25 }];
  updater.fetchPublishedStatus = async () => ({ date: "2026-11-12" });
  updater.approveWithBridge = async () => {
    throw new Error("Bridge-Testfehler");
  };
  updater.acceptNewData = () => {
    localSaveCalled = true;
    return [];
  };

  await assert.rejects(() => updater.process([]), /Bridge-Testfehler/);
  assert.equal(localSaveCalled, false);
});

test("ohne neue ACWI-Tage wird keine Freigabe ausgelöst", async () => {
  const updater = new DataUpdater();
  let approveCalled = false;
  updater.mergeStoredUpdates = () => [];
  updater.fetchACWIData = async () => [{ date: "2026-11-12", close: 1116.27 }];
  updater.fetchPublishedStatus = async () => ({ date: "2026-11-12" });
  updater.approveWithBridge = async () => {
    approveCalled = true;
    return { accepted: true };
  };

  const result = await updater.process([]);
  assert.equal(result.updated, false);
  assert.equal(approveCalled, false);
});

test("ACWI-Updater enthält keine manuelle Bestätigungsabfrage", () => {
  assert.equal(updaterSource.includes("window.confirm"), false);
  assert.match(updaterSource, /approveWithBridge\(newData\)/);
});
