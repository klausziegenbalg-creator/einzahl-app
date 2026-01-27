const functions = require("firebase-functions");
const admin = require("firebase-admin");

exports.submitAutomat = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    const {
      automatCode,
      stadt,
      teamleiter,
      scheine,
      muenzen,
      einEuroEntnommen,
      wechslerNeu,
      bestandFotoPath
    } = req.body || {};

    if (!automatCode || !stadt || !teamleiter || !bestandFotoPath) {
      return res.json({ ok: false, error: "Pflichtfelder fehlen" });
    }

    // 1️⃣ Automat EINZELN speichern (unverändert)
    await db.collection("automatenEinzahlungen").add({
      automatCode,
      stadt,
      teamleiter,
      scheine: Number(scheine) || 0,
      muenzen: Number(muenzen) || 0,
      einEuroEntnommen: Number(einEuroEntnommen) || 0,
      wechslerNeu: Number(wechslerNeu) || 0,
      bestandFotoPath,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2️⃣ 🔥 ZUSAMMENFASSUNG / AUSWERTUNG (NEU, wie im alten Backup)
    await db.collection("einzahlungen").add({
      stadt,
      automatCode,

      scheineSumme: Number(scheine) || 0,
      muenzenSumme: Number(muenzen) || 0,

      einEuro: {
        entnommen: Number(einEuroEntnommen) || 0,
        reserve: 0
      },

      wechsler: {
        neu: Number(wechslerNeu) || 0
      },

      fotos: {
        bestand: bestandFotoPath,
        belege: []
      },

      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});