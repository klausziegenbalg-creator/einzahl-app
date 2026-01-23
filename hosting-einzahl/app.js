/************************************************
 * CONFIG
 ************************************************/
const BASE_URL = "https://us-central1-digitales-bordbuch.cloudfunctions.net";

const VERIFY_PIN_URL = `${BASE_URL}/verifyPin`;
const LOAD_AUTOMATEN_URL = `${BASE_URL}/loadAutomaten`;
const SUBMIT_EINZAHL_URL = `${BASE_URL}/submitEinzahlung`;

/************************************************
 * GLOBAL STATE
 ************************************************/
let currentUser = null;
let selectedAutomatCode = null;

/************************************************
 * PIN LOGIN
 ************************************************/
async function verifyPin() {
  const pinInput = document.getElementById("pinInput");
  const statusEl = document.getElementById("pinStatus");

  const pin = pinInput.value.trim();
  if (!pin) {
    statusEl.innerText = "Bitte PIN eingeben";
    return;
  }

  statusEl.innerText = "PIN wird geprüft …";

  try {
    const response = await fetch(VERIFY_PIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pin })
    });

    const data = await response.json();

    if (!data.ok) {
      statusEl.innerText = data.error || "PIN ungültig";
      return;
    }

    currentUser = {
      role: data.role,
      name: data.name,
      stadt: data.stadt
    };

    statusEl.innerText = "Anmeldung erfolgreich";

    document.getElementById("pinSection").style.display = "none";
    document.getElementById("selectSection").style.display = "block";

    await loadAutomaten();

  } catch (err) {
    console.error("verifyPin error", err);
    statusEl.innerText = "Server nicht erreichbar";
  }
}

/************************************************
 * AUTOMATEN LADEN
 ************************************************/
async function loadAutomaten() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const bestandBox = document.getElementById("bestandBox");

  centerSelect.innerHTML = "";
  automatSelect.innerHTML = "";
  bestandBox.innerHTML = "";

  try {
    const response = await fetch(LOAD_AUTOMATEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: currentUser.role,
        name: currentUser.name,
        stadt: currentUser.stadt
      })
    });

    const data = await response.json();

    if (!data.automaten || data.automaten.length === 0) {
      bestandBox.innerText = "Keine Automaten gefunden";
      return;
    }

    const centers = {};
    data.automaten.forEach(a => {
      if (!centers[a.center]) centers[a.center] = [];
      centers[a.center].push(a);
    });

    Object.keys(centers).forEach(center => {
      const opt = document.createElement("option");
      opt.value = center;
      opt.textContent = center;
      centerSelect.appendChild(opt);
    });

    centerSelect.onchange = () => {
      automatSelect.innerHTML = "";
      centers[centerSelect.value].forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.automatCode;
        opt.textContent = a.name;
        automatSelect.appendChild(opt);
      });
      automatSelect.dispatchEvent(new Event("change"));
    };

    automatSelect.onchange = () => {
      const a = data.automaten.find(
        x => x.automatCode === automatSelect.value
      );
      if (!a) return;

      selectedAutomatCode = a.automatCode;

      bestandBox.innerHTML = `
        <h3>Aktueller Bestand</h3>
        Scheine: ${a.bestandScheine} €<br>
        Münzen: ${a.bestandMuenzen} €<br>
        1€ Münzen: ${a.bestandEinEuro} €
        <br><br>
        Reserve aktuell: ${data.reserve} €
      `;

      document.getElementById("einzahlSection").style.display = "block";
    };

    centerSelect.dispatchEvent(new Event("change"));

  } catch (err) {
    console.error("loadAutomaten error", err);
    bestandBox.innerText = "Fehler beim Laden der Automaten";
  }
}

/************************************************
 * EINZAHLUNG ABSCHICKEN
 ************************************************/
async function submitEinzahlung() {
  const resultBox = document.getElementById("resultBox");

  try {
    const payload = {
      automatCode: selectedAutomatCode,
      scheineSumme: Number(document.getElementById("scheineSumme").value) || 0,
      muenzenSumme: Number(document.getElementById("muenzenSumme").value) || 0,
      einEuroSumme: Number(document.getElementById("einEuroSumme").value) || 0,
      einEuroZiel: document.getElementById("einEuroZiel").value
    };

    const response = await fetch(SUBMIT_EINZAHL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!data.ok) {
      resultBox.innerText = data.error || "Fehler bei Einzahlung";
      return;
    }

    resultBox.innerHTML = `
      <b>Einzahlung gespeichert</b><br>
      Scheine: ${data.scheineSumme} €<br>
      Münzen: ${data.muenzenSumme} €<br>
      Gesamt: ${data.gesamtSumme} €
    `;

  } catch (err) {
    console.error("submitEinzahlung error", err);
    resultBox.innerText = "Serverfehler bei Einzahlung";
  }
}
