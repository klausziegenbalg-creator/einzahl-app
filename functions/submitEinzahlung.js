const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * submitEinzahlung
 *
 * Erwartet:
 * - automatCode (string)
 * - scheineSumme (number)
 * - muenzenSumme (number)
 * - einEuroEntnommen (number)
 * - einEuroAutomat (number)
 * - einEuroReserve (number)
 * - wechslerEinEuroAlt (number)
 *
 * OPTIONAL:
 * - fotoBestandPath (string)
 * - fotoBeleg1Path (string)
 * - fotoBeleg2Path (string)
 */
exports.submitEinzahlung = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {

    try {
      if (req.method !== "POST") {
        return res.status(405).json({ ok: false, error: "Method not allowed" });
      }

      const {
        automatCode,

        scheineSumme = 0,
        muenzenSumme = 0,

        einEuroEntnommen = 0,
        einEuroAutomat = 0,
        einEuroReserve = 0,

        wechslerEinEuroAlt = 0,

        fotoBestandPath = null,
        fotoBeleg1Path = null,
        fotoBeleg2Path = null
      } = req.body || {};

      // -------------------------------
      // Validierung (minimal & fachlich)
      // -------------------------------
      if (!automatCode) {
        return res.status(400).json({ ok: false, error: "automatCode fehlt" });
      }

      if (einEuroAutomat + einEuroReserve !== einEuroEntnommen) {
        return res.status(400).json({
          ok: false,
          error: "1€ Split stimmt nicht (Automat + Reserve ≠ entnommen)"
        });
      }

      // Pflichtfotos
      if (!fotoBestandPath || !fotoBeleg1Path) {
        return res.status(400).json({
          ok: false,
          error: "Pflichtfotos fehlen"
        });
      }

      // -------------------------------
      // Automat laden
      // -------------------------------
      const automatRef = db.collection("automaten").doc(automatCode);
      const automatSnap = await automatRef.get();

      if (!automatSnap.exists) {
        return res.status(404).json({
          ok: false,
          error: "Automat nicht gefunden"
        });
      }

      const automat = automatSnap.data();

      const wechslerAlt = Number(wechslerEinEuroAlt) || 0;
      const wechslerNeu = wechslerAlt + Number(einEuroAutomat || 0);
      const bestanddifferenz = wechslerNeu - wechslerAlt;

      // -------------------------------
      // Einzahlung speichern
      // -------------------------------
      const einzahlung = {
        automatCode,

        scheineSumme: Number(scheineSumme) || 0,
        muenzenSumme: Number(muenzenSumme) || 0,

        einEuro: {
          entnommen: Number(einEuroEntnommen) || 0,
          automat: Number(einEuroAutomat) || 0,
          reserve: Number(einEuroReserve) || 0
        },

        wechsler: {
          alt: wechslerAlt,
          neu: wechslerNeu,
          differenz: bestanddifferenz
        },

        fotos: {
          bestand: fotoBestandPath,
          belege: [
            fotoBeleg1Path,
            ...(fotoBeleg2Path ? [fotoBeleg2Path] : [])
          ]
        },

        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection("einzahlungen").add(einzahlung);

      // -------------------------------
      // Automat aktualisieren
      // -------------------------------
      await automatRef.update({
        wechslerEinEuroBestand: wechslerNeu,
        wechslerEinEuroUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // -------------------------------
      // Antwort
      // -------------------------------
      return res.json({
        ok: true,
        wechslerEinEuroBestandNeu: wechslerNeu,
        bestanddifferenz
      });

    } catch (err) {
      console.error("submitEinzahlung Fehler:", err);
      return res.status(500).json({
        ok: false,
        error: "Serverfehler beim Speichern"
      });
    }
  });
