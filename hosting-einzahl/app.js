async function verifyPin() {
  const pinInput = document.getElementById("pinInput");
  const statusEl = document.getElementById("pinStatus");

  const pin = pinInput.value.trim();
  if (!pin) {
    statusEl.innerText = "Bitte PIN eingeben";
    return;
  }

  statusEl.innerText = "PIN wird geprüft…";

  try {
    const response = await fetch(VERIFY_PIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pin })
    });

    // 🔴 WICHTIG: IMMER json lesen
    const data = await response.json();

    if (!data.ok) {
      statusEl.innerText = data.error || "PIN ungültig";
      return; // ⛔ STOP hier, sonst hängt UI
    }

    // ✅ Erfolg
    window.currentUser = {
      role: data.role,
      name: data.name,
      stadt: data.stadt
    };

    statusEl.innerText = "Anmeldung erfolgreich";

    // UI wechseln
    document.getElementById("pinSection").style.display = "none";
    document.getElementById("selectSection").style.display = "block";

    // Nächster Schritt
    loadAutomaten();

  } catch (err) {
    console.error("PIN Fehler", err);
    statusEl.innerText = "Server nicht erreichbar";
  }
}
