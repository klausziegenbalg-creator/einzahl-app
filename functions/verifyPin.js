const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.verifyPin = functions
  .region("europe-west3")
  .https.onRequest(async (req, res) => {

    // --- CORS HARD FIX ---
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(204).send(""); // <<< WICHTIG
    }

    try {
      const pin = String(req.body?.pin || "").trim();

      if (!pin) {
        return res.json({ ok: false, error: "PIN fehlt" });
      }

      const snap = await db
        .collection("pins")
        .where("pin", "==", pin)
        .limit(1)
        .get();

      if (snap.empty) {
        return res.json({ ok: false, error: "PIN ungültig" });
      }

      const user = snap.docs[0].data();
      const erlaubteRollen = ["teamleiter", "admin", "supervisor"];

      if (!erlaubteRollen.includes(user.role)) {
        return res.json({
          ok: false,
          error: "Keine Berechtigung"
        });
      }

      // --- IMMER RESPONSE ---
      return res.json({
        ok: true,
        role: user.role,
        name: user.name || null,
        stadt: user.stadt || null
      });

    } catch (err) {
      console.error("verifyPin fatal", err);
      return res.status(500).json({
        ok: false,
        error: "Serverfehler"
      });
    }
  });
