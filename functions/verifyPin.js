const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.verifyPin = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    const { pin } = req.body || {};
    if (!pin) return res.json({ ok: false, error: "PIN fehlt" });

    const snap = await db.collection("pins")
      .where("pin", "==", String(pin).trim())
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ ok: false, error: "PIN falsch" });
    }

    const d = snap.docs[0].data() || {};
    return res.json({
      ok: true,
      name: d.name || "",
      role: (d.role || "").toLowerCase(),
      stadt: d.stadt || ""
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});