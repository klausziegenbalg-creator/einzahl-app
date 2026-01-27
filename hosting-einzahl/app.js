/************************************************
 * Einzahl App – vollständige app.js (FINAL)
 * - Keine Merge-Artefakte
 * - KEIN "name" mehr als Anzeige
 * - Anzeige IMMER über automatCode
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
      loadAutomatenData();
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
window.showTab = showTab;

/* =========================
   Center / Automaten
========================= */
let automatenCache = [];
let automatenByCenter = new Map();
let reserveValue = 0;

function normalizeCenter(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function setSelectOptions(selectEl, options, placeholder) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  const ph = document.createElement("option");
  ph.value = "";
  ph.textContent = placeholder;
  selectEl.appendChild(ph);

  options.forEach(opt => {
    const el = document.createElement("option");
    el.value = opt.value;
    el.textContent = opt.label;
    if (opt.key) el.dataset.key = opt.key; // bleibt kompatibel
    selectEl.appendChild(el);
  });
}

function renderBestandBox(automat, wechslerAlt = null) {
  const box = document.getElementById("bestandBox");
  if (!box) return;

  if (!automat) {
    box.innerText = "";
    return;
  }

  const reserveLine = Number.isFinite(reserveValue)
    ? `<div>Reserve: ${reserveValue} €</div>`
    : "";

  // ✅ Anzeige IMMER über automatCode
  const title = automat.automatCode || "";

  box.innerHTML = `
    <div><b>${title}</b></div>
    <div>Center: ${automat.center || ""}</div>
    <div>Scheine Bestand: ${Number(automat.bestandScheine ?? 0)} €</div>
    <div>Münzen Bestand: ${Number(automat.bestandMuenzen ?? 0)} €</div>
    <div>1€ Bestand: ${Number(automat.bestandEinEuro ?? 0)} €</div>
    <div id="wechslerAltInfo">${
      wechslerAlt === null
        ? "Wechsler (alt): wird geladen …"
        : `Wechsler (alt): ${wechslerAlt} €`
    }</div>
    ${reserveLine}
  `;
}

async function loadLastWechsler(automatCode) {
  try {
    const d = await postJsonWithFallback("/getLastWechsler", {
      automatCode,
      stadt: currentUser?.stadt || null
    });
    if (!d?.ok) return null;
    return Number(d.wechslerEinEuroAlt) || 0;
  } catch {
    return null;
  }
}

async function handleAutomatChange() {
  const automatSelect = document.getElementById("automatSelect");
  const einzahlSection = document.getElementById("einzahlSection");
  const selectedCode = automatSelect?.value || "";

  // ✅ Auswahl IMMER über automatCode
  const automat = automatenCache.find(a => a.automatCode === selectedCode);

  if (!automat) {
    renderBestandBox(null);
    if (einzahlSection) einzahlSection.style.display = "none";
    return;
  }

  if (einzahlSection) einzahlSection.style.display = "block";
  renderBestandBox(automat);

  const wechslerAlt = await loadLastWechsler(automat.automatCode);
  const info = document.getElementById("wechslerAltInfo");
  if (info) {
    info.textContent =
      wechslerAlt === null
        ? "Wechsler (alt): nicht verfügbar"
        : `Wechsler (alt): ${wechslerAlt} €`;
  }
}

function handleCenterChange() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const einzahlSection = document.getElementById("einzahlSection");

  const selectedOption = centerSelect?.selectedOptions?.[0] || null;
  const centerKey =
    selectedOption?.dataset?.key ||
    normalizeCenter(centerSelect?.value || "");
  const centerLabel = normalizeCenter(selectedOption?.textContent || "");

  let automaten = centerKey ? automatenByCenter.get(centerKey) || [] : [];
  if (!automaten.length && (centerKey || centerLabel)) {
    const lookupKey = centerKey || centerLabel;
    automaten = automatenCache.filter(
      a => normalizeCenter(a.center) === lookupKey
    );
  }

  // ✅ Dropdown-Label = automatCode (nicht name)
  setSelectOptions(
    automatSelect,
    automaten.map(a => ({
      value: a.automatCode,
      label: a.automatCode
    })),
    "Bitte Automat wählen"
  );

  renderBestandBox(null);
  if (einzahlSection) einzahlSection.style.display = "none";
}

async function loadAutomatenData() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const box = document.getElementById("bestandBox");

  if (centerSelect) centerSelect.disabled = true;
  if (automatSelect) automatSelect.disabled = true;
  if (box) box.innerText = "Automaten werden geladen …";

  try {
    const d = await postJsonWithFallback("/loadAutomaten", {
      role: currentUser?.role,
      name: currentUser?.name,
      stadt: currentUser?.stadt
    });

    automatenCache = Array.isArray(d?.automaten) ? d.automaten : [];
    automatenByCenter = new Map();
    reserveValue = Number(d?.reserve) || 0;

    automatenCache.forEach(a => {
      const key = normalizeCenter(a.center);
      if (!key) return;
      if (!automatenByCenter.has(key)) automatenByCenter.set(key, []);
      automatenByCenter.get(key).push(a);
    });

    // Centerliste stabil aus den echten Centers
    const centerMap = new Map();
    automatenCache.forEach(a => {
      const label = a.center || "Unbekannt";
      const key = normalizeCenter(label);
      if (!key || centerMap.has(key)) return;
      centerMap.set(key, label);
    });

    // ✅ Center value = Label (wie vorher), zusätzlich dataset.key für robustes Mapping
    setSelectOptions(
      centerSelect,
      Array.from(centerMap.entries()).map(([key, label]) => ({
        value: label,
        label,
        key
      })),
      "Bitte Center wählen"
    );

    setSelectOptions(automatSelect, [], "Bitte Automat wählen");
    if (box) box.innerText = "Bitte Center auswählen.";
  } catch {
    if (box) box.innerText = "Fehler beim Laden der Automaten";
  } finally {
    if (centerSelect) centerSelect.disabled = false;
    if (automatSelect) automatSelect.disabled = false;
  }
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
  } catch {
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
   Legacy Button Handler
========================= */
function submitEinzahlung() {
  const auswertungVisible =
    document.getElementById("viewAuswertung")?.style.display === "block";
  if (auswertungVisible) {
    submitBelegeOnly();
  } else {
    saveAutomatNow();
  }
}
window.submitEinzahlung = submitEinzahlung;

/* =========================
   Event-Bindings
========================= */
document.addEventListener("DOMContentLoaded", () => {
  const btnSave = document.getElementById("btnSave");
  if (btnSave) btnSave.onclick = saveAutomatNow;

  const btnFinish = document.querySelector("#viewAuswertung button");
  if (btnFinish) btnFinish.onclick = submitBelegeOnly;

  const centerSelect = document.getElementById("centerSelect");
  if (centerSelect) centerSelect.onchange = handleCenterChange;

  const automatSelect = document.getElementById("automatSelect");
  if (automatSelect) automatSelect.onchange = handleAutomatChange;
});