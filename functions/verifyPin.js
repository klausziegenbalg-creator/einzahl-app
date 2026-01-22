const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.verifyPin = functions
  .region("europe-west3")
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        const { pin } = req.body;

        if (!pin) {
          return res.status(400).json({ ok: false, error: "PIN fehlt" });
        }

        const snap = await db
          .collection("pins")
          .where("pin", "==", String(pin))
          .limit(1)
          .get();

        if (snap.empty) {
          return res.json({ ok: false, error: "PIN ungültig" });
        }

        const p = snap.docs[0].data();

        if (p.role !== "teamleiter") {
          return res.json({
            ok: false,
            error: "Zugriff nur für Teamleiter"
          });
        }

        return res.json({
          ok: true,
          role: "teamleiter",
          name: p.name || null,
          stadt: p.stadt || null
        });

      } catch (err) {
        console.error("verifyPin", err);
        return res.status(500).json({ ok: false, error: "Serverfehler" });
      }
    });
  });
