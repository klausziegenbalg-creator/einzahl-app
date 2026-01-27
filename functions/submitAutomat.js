const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

exports.submitAutomat = functions.https.onRequest(async (req, res) => {
  try {
    const {
      automatCode,
      stadt,
      teamleiter,
      sessionId,
      scheine,
      muenzen,
      einEuroEntnommen,
      wechslerNeu,
      bestandFotoPath
    } = req.body;

    if (!automatCode || !bestandFotoPath) {
      return res.status(400).json({ ok: false, error: "Pflichtdaten fehlen" });
    }

    const sid =
      sessionId ||
      `${new Date().toISOString().slice(0, 10)}_${stadt}_${teamleiter}`;

    await db.collection("einzahl_automaten").add({
      automatCode,
      stadt,
      teamleiter,
      sessionId: sid,
      scheine,
      muenzen,
      einEuroEntnommen,
      wechslerNeu,
      bestandFotoPath,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ ok: true, sessionId: sid });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
