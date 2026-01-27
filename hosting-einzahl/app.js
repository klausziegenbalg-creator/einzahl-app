/************************************************
 * Einzahl App – vollständige app.js (FINAL)
 * stabil, ungepatcht, ohne Flickerei
 ************************************************/

/* =========================
   Netzwerk-Helper
========================= */
async function postJson(path, payload) {
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
  const pin = (document.getElementById("pinInput")?.value || "").trim();
  const status = document.getElementById("pinStatus");

  if (!pin) {
    status.innerText = "Bitte PIN eingeben";
    return;
  }

  status.innerText = "PIN wird geprüft …";

  postJson("/verifyPin", { pin })
    .then(d => {
      if (!d?.ok) {
        status.innerText = d?.error || "PIN ungültig";
        return;
      }

      window.currentUser = d;
      document.getElementById("pinSection").style.display = "none";
      document.getElementById("appSection").style.display = "block";
      loadAutomatenData();
    })
    .catch(() => {
      status.innerText = "Server nicht erreichbar";
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
   Center / Automaten
========================= */
let automatenCache = [];
let automatenByCenter = new Map();
let reserveValue = 0;

function normalizeCenter(v) {
  return String(v || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function setSelect(select, options, placeholder) {
  select.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  select.appendChild(ph);

  options.forEach(o => {
    const el = document.createElement("option");
    el.value = o.value;
    el.textContent = o.label;
    select.appendChild(el);
  });
}

function renderBestand(automat, wechslerAlt = null) {
  const box = document.getElementById("bestandBox");
  if (!automat) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = `
    <div><b>${automat.name}</b></div>
    <div>Center: ${automat.center}</div>
    <div>Scheine: ${automat.bestandScheine} €</div>
    <div>Münzen: ${automat.bestandMuenzen} €</div>
    <div>1€: ${automat.bestandEinEuro} €</div>
    <div id="wechslerAltInfo">
      ${wechslerAlt === null ? "Wechsler (alt): lädt …" : `Wechsler (alt): ${wechslerAlt} €`}
    </div>
    <div>Reserve: ${reserveValue} €</div>
  `;
}

async function loadLastWechsler(code) {
  try {
    const d = await postJson("/getLastWechsler", {
      automatCode: code,
      stadt: currentUser?.stadt || null
    });
    return d?.ok ? Number(d.wechslerEinEuroAlt) || 0 : null;
  } catch {
    return null;
  }
}

async function handleAutomatChange() {
  const code = document.getElementById("automatSelect").value;
  const automat = automatenCache.find(a => a.automatCode === code);
  const section = document.getElementById("einzahlSection");

  if (!automat) {
    section.style.display = "none";
    renderBestand(null);
    return;
  }

  section.style.display = "block";
  renderBestand(automat);

  const w = await loadLastWechsler(code);
  const info = document.getElementById("wechslerAltInfo");
  if (info) {
    info.textContent =
      w === null ? "Wechsler (alt): nicht verfügbar" : `Wechsler (alt): ${w} €`;
  }
}

function handleCenterChange() {
  const centerKey = document.getElementById("centerSelect").value;
  const automatSelect = document.getElementById("automatSelect");
  const section = document.getElementById("einzahlSection");

  const automaten = automatenByCenter.get(centerKey) || [];

  setSelect(
    automatSelect,
    automaten.map(a => ({ value: a.automatCode, label: a.name })),
    "Bitte Automat wählen"
  );

  section.style.display = "none";
  renderBestand(null);
}

async function loadAutomatenData() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const box = document.getElementById("bestandBox");

  box.innerText = "Automaten werden geladen …";

  const d = await postJson("/loadAutomaten", {
    role: currentUser?.role,
    name: currentUser?.name,
    stadt: currentUser?.stadt
  });

  automatenCache = d?.automaten || [];
  reserveValue = Number(d?.reserve) || 0;
  automatenByCenter = new Map();

  automatenCache.forEach(a => {
    const key = normalizeCenter(a.center);
    if (!automatenByCenter.has(key)) automatenByCenter.set(key, []);
    automatenByCenter.get(key).push(a);
  });

  setSelect(
    centerSelect,
    Array.from(automatenByCenter.keys()).map(k => ({
      value: k,
      label: automatenByCenter.get(k)[0].center
    })),
    "Bitte Center wählen"
  );

  setSelect(automatSelect, [], "Bitte Automat wählen");
  box.innerText = "Bitte Center auswählen.";
}

/* =========================
   Firebase Storage Upload
========================= */
async function uploadToStorage(file, folder) {
  const path = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const ref = window.storage.ref().child(path);
  await ref.put(file);
  return path;
}

/* =========================
   Einzahlung speichern
========================= */
let einzahlSessionId = null;

async function saveAutomatNow() {
  const status = document.getElementById("saveStatus");
  const foto = document.getElementById("fotoBestand")?.files?.[0];

  if (!foto) {
    status.innerText = "Bestandsfoto fehlt";
    return;
  }

  status.innerText = "Speichern …";

  const fotoPath = await uploadToStorage(foto, "einzahlBestand");

  const payload = {
    automatCode: document.getElementById("automatSelect").value,
    stadt: currentUser?.stadt,
    teamleiter: currentUser?.name,
    sessionId: einzahlSessionId,
    scheine: Number(document.getElementById("scheineSumme").value || 0),
    muenzen: Number(document.getElementById("muenzenSumme").value || 0),
    einEuroEntnommen: Number(document.getElementById("einEuroEntnommen").value || 0),
    wechslerNeu: Number(document.getElementById("wechslerEinEuroAlt").value || 0),
    bestandFotoPath: fotoPath
  };

  const d = await postJson("/submitAutomat", payload);
  if (!d?.ok) {
    status.innerText = d?.error || "Fehler";
    return;
  }

  einzahlSessionId = d.sessionId;
  status.innerText = "✅ Automat gespeichert";
}

/* =========================
   Belege abschließen
========================= */
async function submitBelegeOnly() {
  const status = document.getElementById("auswertungStatus");
  if (!einzahlSessionId) {
    status.innerText = "Keine aktive Einzahlung";
    return;
  }

  const f1 = document.getElementById("fotoBeleg1")?.files?.[0];
  if (!f1) {
    status.innerText = "Mindestens ein Beleg nötig";
    return;
  }

  const p1 = await uploadToStorage(f1, "einzahlBelege");
  const f2 = document.getElementById("fotoBeleg2")?.files?.[0];
  const p2 = f2 ? await uploadToStorage(f2, "einzahlBelege") : null;

  const d = await postJson("/submitBelege", {
    sessionId: einzahlSessionId,
    stadt: currentUser?.stadt,
    teamleiter: currentUser?.name,
    beleg1Path: p1,
    beleg2Path: p2
  });

  status.innerText = d?.ok ? "✅ Einzahlung abgeschlossen" : "Fehler";
  if (d?.ok) einzahlSessionId = null;
}

function submitEinzahlung() {
  const auswertung =
    document.getElementById("viewAuswertung").style.display === "block";
  auswertung ? submitBelegeOnly() : saveAutomatNow();
}
window.submitEinzahlung = submitEinzahlung;

/* =========================
   Event Bindings
========================= */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("centerSelect").onchange = handleCenterChange;
  document.getElementById("automatSelect").onchange = handleAutomatChange;
  document.getElementById("btnSave").onclick = saveAutomatNow;
  document.querySelector("#viewAuswertung button").onclick = submitBelegeOnly;
});