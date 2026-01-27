const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.submitBelege = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    const { auswertungId, belegPath } = req.body || {};
    if (!auswertungId || !belegPath) {
      return res.json({ ok: false, error: "Pflichtfelder fehlen" });
    }

    await db.collection("auswertungen").doc(auswertungId).update({
      belegPath,
      belegAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});