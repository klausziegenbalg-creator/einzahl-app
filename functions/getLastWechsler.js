const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * getLastWechsler
 *
 * Liefert den letzten bekannten 1€-Wechslerbestand (ALT) für einen Automaten.
 *
 * Erwartet (POST JSON):
 * - automatCode (string) Pflicht
 * - stadt (string) Optional (wenn nicht gegeben: es wird nur nach automatCode gesucht)
 *
 * Antwort:
 * - ok: true
 * - wechslerEinEuroAlt: number
 */
exports.getLastWechsler = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed" });
      }

      const { automatCode, stadt = null } = req.body || {};

      if (!automatCode) {
        return res.status(400).json({ ok: false, error: "automatCode fehlt" });
      }

      // Primär: aus 'automaten' (aktueller Stand)
      const automatRef = db.collection("automaten").doc(String(automatCode));
      const snap = await automatRef.get();
      if (snap.exists) {
        const d = snap.data() || {};
        const val = Number(d.wechslerEinEuroBestand ?? 0) || 0;
        return res.json({ ok: true, wechslerEinEuroAlt: val });
      }

      // Fallback: letzte gespeicherte Einzahlung (historisch)
      let q = db.collection("einzahlAutomaten").where("automatCode", "==", String(automatCode));
      if (stadt) q = q.where("stadt", "==", String(stadt));
      const qs = await q.orderBy("createdAt", "desc").limit(1).get();
      const doc = qs.docs[0];
      if (!doc) {
        return res.json({ ok: true, wechslerEinEuroAlt: 0 });
      }
      const data = doc.data() || {};
      const last = Number(data.wechslerNeu ?? data.wechsler?.neu ?? 0) || 0;
      return res.json({ ok: true, wechslerEinEuroAlt: last });
    } catch (err) {
      console.error("getLastWechsler Fehler:", err);
      return res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
