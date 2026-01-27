const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.verifyPin = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    // CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { pin } = req.body || {};
      if (!pin) {
        return res.json({ ok: false, error: "PIN fehlt" });
      }

      // 1) PIN prüfen
      const snap = await db
        .collection("pins")
        .where("pin", "==", String(pin).trim())
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ ok: false, error: "PIN falsch" });
      }

      const pinData = snap.docs[0].data() || {};
      const name = (pinData.name || "").toString().trim();
      const role = (pinData.role || "").toString().trim().toLowerCase();

      if (!name || !role) {
        return res.json({ ok: false, error: "PIN unvollständig" });
      }

      // 2) Stadt aus Automaten ableiten (wie in Reiniger-App)
      let stadt = "";

      // Admin darf alles
      if (role === "admin") {
        stadt = "";
      } else {
        const autoSnap = await db.collection("automaten").get();
        autoSnap.forEach(doc => {
          const a = doc.data() || {};
          if (role === "teamleiter" && (a.leitung || "").toString().trim() === name && a.stadt) {
            stadt = a.stadt;
          }
          if (role === "mitarbeiter" && (a.mitarbeiter || "").toString().trim() === name && a.stadt) {
            stadt = a.stadt;
          }
        });

        // Fallback: falls pins-Dokument eine Stadt enthält
        if (!stadt && pinData.stadt) {
          stadt = pinData.stadt;
        }
      }

      return res.json({
        ok: true,
        name,
        role,
        stadt
      });

    } catch (err) {
      console.error("verifyPin error:", err);
      return res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
