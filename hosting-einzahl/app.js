
/************************************************
 * Einzahl App – vollständige app.js (stabil)
 ************************************************/

/* =========================
   Netzwerk-Helper
========================= */
async function postJsonWithFallback(path, payload) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Request failed");
  return await res.json();
}

/* =========================
   Login / PIN
========================= */
function verifyPin() {
  const pinInput = document.getElementById("pinInput");
  const statusEl = document.getElementById("pinStatus");
  const pin = (pinInput?.value || "").trim();

  if (!pin) {
    statusEl && (statusEl.innerText = "Bitte PIN eingeben");
    return;
  }

  statusEl && (statusEl.innerText = "PIN wird geprüft …");

  postJsonWithFallback("/verifyPin", { pin })
    .then(d => {
      if (!d || d.ok !== true) {
        statusEl && (statusEl.innerText = d?.error || "PIN ungültig");
        return;
      }
      window.currentUser = d;
      document.getElementById("pinSection").style.display = "none";
      document.getElementById("appSection").style.display = "block";
    })
    .catch(() => {
      statusEl && (statusEl.innerText = "Server nicht erreichbar");
    });
}
window.verifyPin = verifyPin;

/* =========================
   Tabs
========================= */
function showTab(tab) {
  document.getElementById("viewEinzahlung").style.display =
    tab === "einzahlung" ? "block" : "none";
  document.getElementById("viewAuswertung").style.display =
    tab === "auswertung" ? "block" : "none";
}

/* =========================
   Firebase Storage Upload
========================= */
async function uploadToStorage(file, folder) {
  const ts = Date.now();
  const safe = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${folder}/${ts}_${safe}`;
  const ref = window.storage.ref().child(path);
  await ref.put(file);
  return path;
}

/* =========================
   Automat speichern
========================= */
let einzahlSessionId = null;

async function saveAutomatNow() {
  const status = document.getElementById("saveStatus");
  status && (status.innerText = "");

  const foto = document.getElementById("fotoBestand")?.files?.[0];
  if (!foto) {
    status && (status.innerText = "Bestandsfoto ist Pflicht.");
    return;
  }

  try {
    status && (status.innerText = "Foto wird hochgeladen …");
    const fotoBestandPath = await uploadToStorage(foto, "einzahlBestand");

    const payload = {
      automatCode: document.getElementById("automatSelect")?.value,
      stadt: currentUser?.stadt,
      teamleiter: currentUser?.name,
      sessionId: einzahlSessionId,
      scheine: Number(document.getElementById("scheineSumme")?.value || 0),
      muenzen: Number(document.getElementById("muenzenSumme")?.value || 0),
      einEuroEntnommen: Number(document.getElementById("einEuroEntnommen")?.value || 0),
      wechslerNeu: Number(document.getElementById("wechslerEinEuroAlt")?.value || 0),
      bestandFotoPath: fotoBestandPath
    };

    status && (status.innerText = "Automat wird gespeichert …");
    const d = await postJsonWithFallback("/submitAutomat", payload);
    if (!d.ok) {
      status && (status.innerText = d.error || "Fehler beim Speichern");
      return;
    }

    einzahlSessionId = d.sessionId;
    status && (status.innerText = "✅ Automat gespeichert");

    ["scheineSumme","muenzenSumme","einEuroEntnommen","wechslerEinEuroAlt"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value="";
    });
    document.getElementById("fotoBestand").value = "";
  } catch (e) {
    status && (status.innerText = "Serverfehler beim Speichern");
  }
}

/* =========================
   Belege abschließen
========================= */
async function submitBelegeOnly() {
  const status = document.getElementById("auswertungStatus");
  status && (status.innerText = "");

  if (!einzahlSessionId) {
    status && (status.innerText = "Keine aktive Einzahlung");
    return;
  }

  const f1 = document.getElementById("fotoBeleg1")?.files?.[0];
  if (!f1) {
    status && (status.innerText = "Mindestens ein Beleg ist Pflicht");
    return;
  }

  try {
    status && (status.innerText = "Belege werden hochgeladen …");
    const beleg1Path = await uploadToStorage(f1, "einzahlBelege");
    const f2 = document.getElementById("fotoBeleg2")?.files?.[0];
    const beleg2Path = f2 ? await uploadToStorage(f2, "einzahlBelege") : null;

    const payload = {
      sessionId: einzahlSessionId,
      stadt: currentUser?.stadt,
      teamleiter: currentUser?.name,
      beleg1Path,
      beleg2Path
    };

    const d = await postJsonWithFallback("/submitBelege", payload);
    if (!d.ok) {
      status && (status.innerText = d.error || "Fehler beim Abschluss");
      return;
    }

    status && (status.innerText = "✅ Einzahlung abgeschlossen");
    einzahlSessionId = null;
  } catch {
    status && (status.innerText = "Serverfehler beim Abschluss");
  }
}

/* =========================
   Event-Bindings (sicher)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const btnSave = document.getElementById("btnSave");
  if (btnSave) btnSave.onclick = saveAutomatNow;

  const btnFinish = document.querySelector("#viewAuswertung button");
  if (btnFinish) btnFinish.onclick = submitBelegeOnly;
});
