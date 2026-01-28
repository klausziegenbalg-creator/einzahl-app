const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const toNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;

exports.submitAutomat = functions.https.onRequest(async (req, res) => {
  try {
    const {
      automatCode,
      stadt,
      teamleiter,
      einzahlId,
      scheine,
      muenzen,
      einEuroEntnommen,
      wechslerNeu,
      bestandEinEuroAktuell,
      bestandFotoPath
    } = req.body || {};

    if (!automatCode || !stadt || !teamleiter) {
      return res.json({ ok: false, error: "Pflichtfelder fehlen" });
    }

    // =========================
    // EINZAHL-ID
    // =========================
    const currentEinzahlId = einzahlId || db.collection("einzahlungen").doc().id;

    // =========================
    // RESERVE LADEN
    // =========================
    const reserveRef = db.collection("reserven").doc(teamleiter);
    const reserveSnap = await reserveRef.get();

    const reserveAlt = reserveSnap.exists
      ? toNumber(reserveSnap.data().betrag)
      : 0;

    const reserveNeu =
      reserveAlt +
      toNumber(einEuroEntnommen) -
      toNumber(wechslerNeu);

    // =========================
    // AUTOMAT SPEICHERN
    // =========================
    await db.collection("einzahlPositionen").add({
      einzahlId: currentEinzahlId,
      automatCode,
      stadt,
      teamleiter,
      scheine: toNumber(scheine),
      muenzen: toNumber(muenzen),
      einEuroEntnommen: toNumber(einEuroEntnommen),
      wechslerEinEuro: toNumber(wechslerNeu),
      bestandEinEuroAktuell: toNumber(bestandEinEuroAktuell),
      bestandFotoPath,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // =========================
    // RESERVE SPEICHERN
    // =========================
    await reserveRef.set(
      { betrag: reserveNeu },
      { merge: true }
    );

    return res.json({
      ok: true,
      einzahlId: currentEinzahlId,
      reserve: reserveNeu
    });

  } catch (err) {
    console.error("submitAutomat error:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});