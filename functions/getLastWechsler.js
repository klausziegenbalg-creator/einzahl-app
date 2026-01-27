const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.getLastWechsler = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    const { automatCode, stadt } = req.body || {};
    if (!automatCode) {
      return res.json({ ok: false, error: "automatCode fehlt" });
    }

    const snap = await db.collection("automaten").doc(String(automatCode)).get();
    if (snap.exists) {
      const d = snap.data() || {};
      return res.json({
        ok: true,
        wechslerEinEuroAlt: Number(d.wechslerEinEuroBestand || 0)
      });
    }

    let q = db.collection("einzahlAutomaten").where("automatCode", "==", String(automatCode));
    if (stadt) q = q.where("stadt", "==", String(stadt));
    const qs = await q.orderBy("createdAt", "desc").limit(1).get();

    if (qs.empty) {
      return res.json({ ok: true, wechslerEinEuroAlt: 0 });
    }

    const d = qs.docs[0].data() || {};
    return res.json({
      ok: true,
      wechslerEinEuroAlt: Number(d.wechslerNeu || 0)
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});