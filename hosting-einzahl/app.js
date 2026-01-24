// ===============================
// Konfiguration
// ===============================
const VERIFY_PIN_URL =
  "https://us-central1-digitales-bordbuch.cloudfunctions.net/verifyPin";
const LOAD_AUTOMATEN_URL =
  "https://us-central1-digitales-bordbuch.cloudfunctions.net/loadAutomaten";
const SUBMIT_EINZAHL_URL =
  "https://us-central1-digitales-bordbuch.cloudfunctions.net/submitEinzahlung";

// ===============================
// Globaler State
// ===============================
let currentUser = null;
let automaten = [];
let selectedAutomat = null;

// ===============================
// Helpers
// ===============================
function setStatus(id, msg, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerText = msg || "";
  el.className = "status" + (isError ? " error" : "");
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

// ===============================
// PIN Login
// ===============================
async function verifyPin() {
  const pin = document.getElementById("pinInput").value.trim();
  if (!pin) {
    setStatus("pinStatus", "Bitte PIN eingeben", true);
    return;
  }

  setStatus("pinStatus", "PIN wird geprüft …");

  try {
    const data = await postJson(VERIFY_PIN_URL, { pin });

    if (!data || !data.ok) {
      setStatus("pinStatus", "PIN ungültig", true);
      return;
    }

    // ✅ Login erfolgreich
    currentUser = data;

    // 🔑 WICHTIG: UI umschalten
    document.getElementById("pinSection").style.display = "none";
    document.getElementById("selectSection").style.display = "block";

    // Automaten laden
    await loadAutomaten();

  } catch (err) {
    console.error(err);
    setStatus("pinStatus", "Serverfehler bei PIN-Prüfung", true);
  }
}

// ===============================
// Automaten laden
// ===============================
async function loadAutomaten() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const bestandBox = document.getElementById("bestandBox");

  centerSelect.innerHTML = "";
  automatSelect.innerHTML = "";
  automatSelect.disabled = true;
  bestandBox.innerHTML = "";
  selectedAutomat = null;

  try {
    const data = await postJson(LOAD_AUTOMATEN_URL, {
      role: currentUser.role,
      stadt: currentUser.stadt
    });

    automaten = data.automaten || [];
    if (!automaten.length) {
      bestandBox.innerText = "Keine Automaten gefunden";
      return;
    }

    // Center gruppieren
    const centers = {};
    automaten.forEach(a => {
      if (!centers[a.center]) centers[a.center] = [];
      centers[a.center].push(a);
    });

    // Center Select
    centerSelect.innerHTML =
      `<option value="" disabled selected>Center wählen</option>`;
    Object.keys(centers).forEach(center => {
      const opt = document.createElement("option");
      opt.value = center;
      opt.textContent = center;
      centerSelect.appendChild(opt);
    });

    centerSelect.onchange = () => {
      const center = centerSelect.value;
      automatSelect.innerHTML =
        `<option value="" disabled selected>Automat wählen</option>`;
      centers[center].forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.automatCode;
        opt.textContent = a.name || a.automatCode;
        automatSelect.appendChild(opt);
      });
      automatSelect.disabled = false;
    };

    automatSelect.onchange = () => {
      const code = automatSelect.value;
      selectedAutomat = automaten.find(a => a.automatCode === code);
      if (!selectedAutomat) return;

      bestandBox.innerHTML =
        `<b>Letzter Wechslerbestand:</b> ${selectedAutomat.wechslerEinEuroBestand || 0} €`;

      document.getElementById("einzahlSection").style.display = "block";
    };

  } catch (err) {
    console.error(err);
    bestandBox.innerText = "Fehler beim Laden der Automaten";
  }
}

// ===============================
// Einzahlung speichern
// ===============================
async function submitEinzahlung() {
  if (!selectedAutomat) {
    setStatus("saveStatus", "Bitte Automat wählen", true);
    return;
  }

  setStatus("saveStatus", "Speichern …");

  try {
    const payload = {
      automatCode: selectedAutomat.automatCode,
      scheineSumme: Number(document.getElementById("scheineSumme").value) || 0,
      muenzenSumme: Number(document.getElementById("muenzenSumme").value) || 0,
      einEuroEntnommen: Number(document.getElementById("einEuroEntnommen").value) || 0,
      einEuroAutomat: Number(document.getElementById("einEuroAutomat").value) || 0,
      einEuroReserve: Number(document.getElementById("einEuroReserve").value) || 0,
      wechslerEinEuroAlt:
        Number(document.getElementById("wechslerEinEuroAlt").value) || 0
    };

    const data = await postJson(SUBMIT_EINZAHL_URL, payload);

    if (!data || !data.ok) {
      setStatus("saveStatus", "Fehler beim Speichern", true);
      return;
    }

    document.getElementById("resultWechslerNeu").innerText =
      data.wechslerEinEuroBestandNeu;
    document.getElementById("resultDifferenz").innerText =
      data.bestanddifferenz;

    setStatus("saveStatus", "✅ Gespeichert");

  } catch (err) {
    console.error(err);
    setStatus("saveStatus", "Serverfehler beim Speichern", true);
  }
}
