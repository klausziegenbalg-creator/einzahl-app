const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.loadAutomaten = functions
  .region("europe-west3")
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        const { role, name, stadt } = req.body;
        const erlaubteRollen = ["teamleiter", "admin", "supervisor"];

        if (!erlaubteRollen.includes(role)) {
          return res.status(403).json({ error: "Keine Berechtigung" });
        }

        let query = db.collection("automaten");
        if (stadt) {
          query = query.where("stadt", "==", stadt);
        }

        const snap = await query.get();

        const automaten = [];
        const centers = new Set();

        snap.forEach(doc => {
          const a = doc.data();
          if (!a.automatCode) return;

          centers.add(a.center || "Unbekannt");

          automaten.push({
            automatCode: a.automatCode,
            name: a.name || a.automatCode,
            center: a.center || "Unbekannt",
            bestandScheine: Number(a.bestandScheine) || 0,
            bestandMuenzen: Number(a.bestandMuenzen) || 0,
            bestandEinEuro: Number(a.bestandEinEuro) || 0
          });
        });

        let reserve = 0;
        if (name) {
          const rSnap = await db.collection("reserven").doc(name).get();
          if (rSnap.exists) {
            reserve = Number(rSnap.data().betrag) || 0;
          }
        }

        return res.json({
          centers: Array.from(centers).map(c => ({ name: c })),
          automaten,
          reserve
        });

      } catch (err) {
        console.error("loadAutomaten", err);
        return res.status(500).json({ error: "Serverfehler" });
      }
    });
  });
