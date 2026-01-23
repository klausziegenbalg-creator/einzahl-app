/*************************
 * Firebase Init
 *************************/
const firebaseConfig = {
  // nutzt dein bestehendes Projekt (wie Reiniger-App)
};
firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();

/*************************
 * Backend Endpoints
 *************************/
const BASE_URL = "https://europe-west3-DEIN_PROJEKT.cloudfunctions.net";

const VERIFY_PIN_URL = `${BASE_URL}/verifyPin`;
const LOAD_AUTOMATEN_URL = `${BASE_URL}/loadAutomaten`;
const SUBMIT_EINZAHL_URL = `${BASE_URL}/submitEinzahlung`;

/*************************
 * State
 *************************/
let currentUser = null;
let selectedAutomat = null;

/*************************
 * PIN LOGIN
 *************************/
async function verifyPin() {
  const pin = document.getElementById("pinInput").value;
  document.getElementById("pinStatus").innerText = "prüfe PIN…";

  const res = await fetch(VERIFY_PIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin })
  });

  const data = await res.json();

  if (!data.ok || data.role !== "teamleiter") {
    document.getElementById("pinStatus").innerText =
      "❌ Zugriff nur für Teamleiter";
    return;
  }

  currentUser = data;
  document.getElementById("pinSection").style.display = "none";
  document.getElementById("selectSection").style.display = "block";

  loadAutomaten();
}

/*************************
 * AUTOMATEN LADEN
 *************************/
async function loadAutomaten() {
  const res = await fetch(LOAD_AUTOMATEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "teamleiter", stadt: currentUser.stadt })
  });

  const data = await res.json();

  const centerSelect = document.getElementById("centerSelect");
  const automatSelect = document.getElementById("automatSelect");

  centerSelect.innerHTML = "";
  automatSelect.innerHTML = "";

  data.centers.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    centerSelect.appendChild(opt);
  });

  centerSelect.onchange = () => {
    automatSelect.innerHTML = "";
    data.automaten
      .filter(a => a.center === centerSelect.value)
      .forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        automatSelect.appendChild(opt);
      });
  };

  automatSelect.onchange = () => {
    selectedAutomat = data.automaten.find(
      a => a.id === automatSelect.value
    );
    showBestand();
  };

  centerSelect.dispatchEvent(new Event("change"));
}

/*************************
 * BESTAND + RESERVE
 *************************/
function showBestand() {
  document.getElementById("bestandBox").innerHTML = `
    <h3>Aktueller Bestand</h3>
    Scheine: ${selectedAutomat.bestandScheine} €<br>
    Münzen: ${selectedAutomat.bestandMuenzen} €<br>
    Reserve gesamt: ${selectedAutomat.reserve} €
  `;
  document.getElementById("einzahlSection").style.display = "block";
}

/*************************
 * UPLOAD
 *************************/
async function uploadPhoto(file, suffix) {
  if (!file) return null;

  const path = `einzahl-app/uploads/${currentUser.name}/${selectedAutomat.id}_${suffix}.jpg`;
  const ref = storage.ref().child(path);
  await ref.put(file);
  return await ref.getDownloadURL();
}

/*************************
 * SUBMIT EINZAHLUNG
 *************************/
async function submitEinzahlung() {
  const photoUrl1 = await uploadPhoto(
    document.getElementById("photo1").files[0],
    "1"
  );
  const photoUrl2 = await uploadPhoto(
    document.getElementById("photo2").files[0],
    "2"
  );

  const payload = {
    automatId: selectedAutomat.id,
    scheineSumme: Number(document.getElementById("scheineSumme").value),
    muenzenSumme: Number(document.getElementById("muenzenSumme").value),
    einEuroSumme: Number(document.getElementById("einEuroSumme").value),
    einEuroZiel: document.getElementById("einEuroZiel").value,
    photoUrl1,
    photoUrl2
  };

  const res = await fetch(SUBMIT_EINZAHL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  document.getElementById("resultBox").innerHTML = `
    <h3>Ergebnis</h3>
    Scheine: ${data.scheineSumme} €<br>
    Münzen: ${data.muenzenSumme} €<br>
    Gesamt: <b>${data.gesamtSumme} €</b><br>
    Reserve aktuell: ${data.reserveGesamt} €
  `;
}
