/************************************************
 * KONFIGURATION (Functions)
 ************************************************/

const BASE_URL_PRIMARY = "https://us-central1-digitales-bordbuch.cloudfunctions.net";

function buildRegionFallbackUrl(primaryBaseUrl, region) {
  try {
    const u = new URL(primaryBaseUrl);
    const m = u.host.match(/^[a-z0-9-]+-([a-z0-9-]+)\.cloudfunctions\.net$/i);
    const projectId = m ? m[1] : null;
    if (!projectId) return null;
    return `https://${region}-${projectId}.cloudfunctions.net`;
  } catch {
    return null;
  }
}

const BASE_URL_FALLBACK = buildRegionFallbackUrl(BASE_URL_PRIMARY, "europe-west3");

const VERIFY_PIN_PATH = "/verifyPin";
const LOAD_AUTOMATEN_PATH = "/loadAutomaten";
const SUBMIT_EINZAHL_PATH = "/submitEinzahlung";

/************************************************
 * GLOBALER STATE
 ************************************************/
let currentUser = null;
let automaten = [];
let selectedAutomat = null;

/************************************************
 * HELPER
 ************************************************/
async function postJsonWithFallback(path, payload) {
  const urls = [
    `${BASE_URL_PRIMARY}${path}`,
    ...(BASE_URL_FALLBACK ? [`${BASE_URL_FALLBACK}${path}`] : [])
  ];

  let lastError = null;

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      });

      clearTimeout(timeout);

      const text = await response.text();
      let data = null;

      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`Ungültige Serverantwort (${response.status})`);
      }

      return { url, response, data };

    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Server nicht erreichbar");
}

function setStatus(el, msg, isError = false) {
  if (!el) return;
  el.classList.toggle("error", !!isError);
  el.innerText = msg || "";
}

function safeFileName(name) {
  return String(name || "photo.jpg").replace(/[^\w.\-]+/g, "_");
}

async function uploadPhoto(file, prefix) {
  if (!file) return null;
  if (!window.storage) throw new Error("Firebase Storage nicht verfügbar");

  const stamp = Date.now();
  const path = `${prefix}/${stamp}-${safeFileName(file.name)}`;
  const ref = window.storage.ref().child(path);

  await ref.put(file);
  return ref.getDownloadURL();
}

function setPreview(inputId, imgId) {
  const input = document.getElementById(inputId);
  const img = document.getElementById(imgId);
  if (!input || !img) return;

  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) {
      img.src = "";
      img.style.display = "none";
      return;
    }
    img.src = URL.createObjectURL(file);
    img.style.display = "block";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setPreview("fotoBestand", "previewBestand");
  setPreview("fotoBeleg1", "previewBeleg1");
  setPreview("fotoBeleg2", "previewBeleg2");
});

/************************************************
 * PIN LOGIN
 ************************************************/
async function verifyPin() {
  const pinInput = document.getElementById("pinInput");
  const statusEl = document.getElementById("pinStatus");

  setStatus(statusEl, "");

  const pin = String(pinInput.value || "").trim();
  if (!pin) {
    setStatus(statusEl, "Bitte PIN eingeben", true);
    return;
  }

  setStatus(statusEl, "PIN wird geprüft …");

  try {
    const { data } = await postJsonWithFallback(VERIFY_PIN_PATH, { pin });

    if (!data || data.ok !== true) {
      setStatus(statusEl, data?.error || "PIN ungültig", true);
      return;
    }

    currentUser = data;

    document.getElementById("pinSection").style.display = "none";
    document.getElementById("selectSection").style.display = "block";

    await loadAutomaten();

  } catch (err) {
    console.error(err);
    setStatus(statusEl, "Server nicht erreichbar", true);
  }
}

/************************************************
 * AUTOMATEN LADEN + CENTER/AUTOMAT DROPDOWN
 ************************************************/
async function loadAutomaten() {
  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");
  const bestandBox = document.getElementById("bestandBox");

  centerSelect.innerHTML = "";
  automatSelect.innerHTML = "";
  bestandBox.innerHTML = "";

  automatSelect.disabled = true;
  selectedAutomat = null;
  document.getElementById("einzahlSection").style.display = "none";

  try {
    const { data } = await postJsonWithFallback(LOAD_AUTOMATEN_PATH, {
      role: currentUser.role,
      name: currentUser.name,
      stadt: currentUser.stadt
    });

    automaten = data?.automaten || [];

    if (!automaten.length) {
      bestandBox.innerText = "Keine Automaten gefunden";
      return;
    }

    const centersMap = {};
    for (const a of automaten) {
      const c = a.center || "Unbekannt";
      if (!centersMap[c]) centersMap[c] = [];
      centersMap[c].push(a);
    }

    // Center Placeholder
    const centerPh = document.createElement("option");
    centerPh.value = "";
    centerPh.textContent = "Bitte Center wählen";
    centerPh.disabled = true;
    centerPh.selected = true;
    centerSelect.appendChild(centerPh);

    Object.keys(centersMap).sort().forEach(center => {
      const opt = document.createElement("option");
      opt.value = center;
      opt.textContent = center;
      centerSelect.appendChild(opt);
    });

    centerSelect.onchange = () => {
      const center = centerSelect.value;

      automatSelect.innerHTML = "";
      automatSelect.disabled = true;
      selectedAutomat = null;
      document.getElementById("einzahlSection").style.display = "none";
      bestandBox.innerHTML = "";

      if (!center || !centersMap[center] || centersMap[center].length === 0) return;

      // Automat Placeholder
      const automatPh = document.createElement("option");
      automatPh.value = "";
      automatPh.textContent = "Bitte Automat wählen";
      automatPh.disabled = true;
      automatPh.selected = true;
      automatSelect.appendChild(automatPh);

      centersMap[center]
        .slice()
        .sort((a, b) => String(a.automatCode).localeCompare(String(b.automatCode)))
        .forEach(a => {
          const opt = document.createElement("option");
          opt.value = a.automatCode; // ✅ nur automatCode
          opt.textContent = a.name || a.automatCode;
          automatSelect.appendChild(opt);
        });

      automatSelect.disabled = false;
    };

    automatSelect.onchange = () => {
      const code = automatSelect.value;
      selectedAutomat = automaten.find(a => a.automatCode === code) || null;

      if (!selectedAutomat) {
        document.getElementById("einzahlSection").style.display = "none";
        bestandBox.innerHTML = "";
        return;
      }

      bestandBox.innerHTML = `
        <b>Letzter Wechslerbestand (1€):</b>
        ${selectedAutomat.wechslerEinEuroBestand ?? 0} €
      `;

      // Optional: Defaultwerte für Split (damit es flott geht)
      const entnommen = Number(document.getElementById("einEuroEntnommen").value) || 0;
      if (entnommen > 0) {
        const a = document.getElementById("einEuroAutomat");
        const r = document.getElementById("einEuroReserve");
        if ((Number(a.value) || 0) === 0 && (Number(r.value) || 0) === 0) {
          a.value = entnommen; // Standard: alles in Automat
          r.value = 0;
        }
      }

      document.getElementById("einzahlSection").style.display = "block";
    };

  } catch (err) {
    console.error(err);
    bestandBox.innerText = "Fehler beim Laden der Automaten";
  }
}

/************************************************
 * EINZAHLUNG SPEICHERN (Uploads + Split-Validierung)
 ************************************************/
async function submitEinzahlung() {
  const saveStatus = document.getElementById("saveStatus");
  const resultWechslerNeu = document.getElementById("resultWechslerNeu");
  const resultDifferenz = document.getElementById("resultDifferenz");

  setStatus(saveStatus, "");
  resultWechslerNeu.innerText = "–";
  resultDifferenz.innerText = "–";

  if (!selectedAutomat) {
    setStatus(saveStatus, "Bitte zuerst einen Automaten wählen.", true);
    return;
  }

  // Fotos (Pflicht: Bestand + Beleg1; Optional: Beleg2)
  const fBestand = document.getElementById("fotoBestand")?.files?.[0] || null;
  const fBeleg1 = document.getElementById("fotoBeleg1")?.files?.[0] || null;
  const fBeleg2 = document.getElementById("fotoBeleg2")?.files?.[0] || null;

  if (!fBestand || !fBeleg1) {
    setStatus(saveStatus, "Bitte Foto Bestand + Einzahlbeleg Foto 1 aufnehmen.", true);
    return;
  }

  // Split-Felder
  const einEuroEntnommen = Number(document.getElementById("einEuroEntnommen").value) || 0;
  const einEuroAutomat = Number(document.getElementById("einEuroAutomat").value) || 0;
  const einEuroReserve = Number(document.getElementById("einEuroReserve").value) || 0;

  if (einEuroAutomat < 0 || einEuroReserve < 0 || einEuroEntnommen < 0) {
    setStatus(saveStatus, "1€ Werte dürfen nicht negativ sein.", true);
    return;
  }

  if ((einEuroAutomat + einEuroReserve) !== einEuroEntnommen) {
    setStatus(saveStatus, "1€ Verteilung stimmt nicht: Automat + Reserve ≠ entnommen", true);
    return;
  }

  try {
    setStatus(saveStatus, "Fotos werden hochgeladen …");

    const bestandUrl = await uploadPhoto(fBestand, "einzahlBestand");
    const beleg1Url = await uploadPhoto(fBeleg1, "einzahlBeleg");
    const beleg2Url = fBeleg2 ? await uploadPhoto(fBeleg2, "einzahlBeleg") : null;

    setStatus(saveStatus, "Speichern …");

    const payload = {
      automatCode: selectedAutomat.automatCode, // ✅ nur automatCode

      scheineSumme: Number(document.getElementById("scheineSumme").value) || 0,
      muenzenSumme: Number(document.getElementById("muenzenSumme").value) || 0,

      einEuroEntnommen,
      einEuroAutomat,
      einEuroReserve,

      wechslerEinEuroAlt: Number(document.getElementById("wechslerEinEuroAlt").value) || 0,

      // Foto-URLs (Backend wird später angepasst, aktuell kann es noch scheitern)
      fotoBestandUrl: bestandUrl,
      fotoBeleg1Url: beleg1Url
    };

    if (beleg2Url) payload.fotoBeleg2Url = beleg2Url;

    const { data } = await postJsonWithFallback(SUBMIT_EINZAHL_PATH, payload);

    if (!data || data.ok !== true) {
      setStatus(saveStatus, "Upload ok – Speichern fehlgeschlagen (Backend noch nicht angepasst).", true);
      return;
    }

    resultWechslerNeu.innerText = data.wechslerEinEuroBestandNeu;
    resultDifferenz.innerText = data.bestanddifferenz;

    setStatus(saveStatus, "✅ Gespeichert.");

  } catch (err) {
    console.error(err);
    setStatus(saveStatus, "Upload ok – Serverfehler beim Speichern.", true);
  }
}
