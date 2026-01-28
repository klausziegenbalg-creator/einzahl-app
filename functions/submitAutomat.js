const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.submitAutomat = functions.https.onRequest(async (req, res) => {
  try {
    const {
      automatCode,
      stadt,
      teamleiter,
      einzahlId,
      bestandEinEuroAktuell,
      einEuroEntnommen,
      wechslerNeu,
      scheine,
      muenzen,
      bestandFotoPath
    } = req.body || {};

    if (!automatCode) {
      return res.json({ ok: false, error: "automatCode fehlt" });
    }

    if (!Number.isFinite(Number(bestandEinEuroAktuell))) {
      return res.json({ ok: false, error: "bestandEinEuroAktuell fehlt" });
    }

    const finalEinzahlId = einzahlId || db.collection("_").doc().id;

    const reserveDelta =
      Number(einEuroEntnommen || 0) - Number(wechslerNeu || 0);

    await db.collection("einzahlungen_automaten").add({
      automatCode,
      stadt: stadt || "",
      teamleiter: teamleiter || "",
      einzahlId: finalEinzahlId,

      bestandEinEuroAktuell: Number(bestandEinEuroAktuell),
      einEuroEntnommen: Number(einEuroEntnommen) || 0,
      wechslerNeu: Number(wechslerNeu) || 0,
      reserveDelta,

      scheine: Number(scheine) || 0,
      muenzen: Number(muenzen) || 0,

      bestandFotoPath,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true, einzahlId: finalEinzahlId });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});