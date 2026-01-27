const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.submitBelege = functions.https.onRequest(async (req, res) => {
  try {
    const {
      sessionId,
      stadt,
      teamleiter,
      beleg1Path,
      beleg2Path
    } = req.body;

    if (!sessionId || !beleg1Path) {
      return res.status(400).json({ ok: false, error: "Beleg fehlt" });
    }

    await db.collection("einzahl_belege").add({
      sessionId,
      stadt,
      teamleiter,
      beleg1Path,
      beleg2Path: beleg2Path || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
