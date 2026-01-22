const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.submitEinzahlung = functions
  .region("europe-west3")
  .https.onRequest((req, res) => {
    cors(req, res, async () => {
      try {
        const {
          automatCode,
          scheineSumme,
          muenzenSumme,
          einEuroSumme,
          einEuroZiel,
          photoUrl1,
          photoUrl2
        } = req.body;

        if (!automatCode) {
          return res.status(400).json({ error: "automatCode fehlt" });
        }

        const scheine = Number(scheineSumme) || 0;
        const muenzen = Number(muenzenSumme) || 0;
        const einEuro = Number(einEuroSumme) || 0;

        if (scheine < 0 || muenzen < 0 || einEuro < 0) {
          return res.status(400).json({ error: "Negative Beträge unzulässig" });
        }

        if (einEuro > muenzen) {
          return res.status(400).json({ error: "1€ > Münzen gesamt" });
        }

        if (!["automat", "reserve"].includes(einEuroZiel)) {
          return res.status(400).json({ error: "Ungültiges Ziel" });
        }

        const gesamtSumme = scheine + muenzen;

        const aSnap = await db
          .collection("automaten")
          .where("automatCode", "==", automatCode)
          .limit(1)
          .get();

        if (aSnap.empty) {
          return res.status(404).json({ error: "Automat nicht gefunden" });
        }

        const automatRef = aSnap.docs[0].ref;
        const automat = aSnap.docs[0].data();

        const teamleiterId = automat.leitung || automat.teamleiterId;
        if (!teamleiterId) {
          return res.status(400).json({ error: "Kein Teamleiter zugeordnet" });
        }

        const reserveRef = db.collection("reserven").doc(teamleiterId);

        await db.runTransaction(async tx => {
          const rSnap = await tx.get(reserveRef);
          const alteReserve = rSnap.exists ? Number(rSnap.data().betrag) || 0 : 0;

          let neueReserve = alteReserve;
          let neuerEinEuroBestand = Number(automat.bestandEinEuro) || 0;

          if (einEuroZiel === "reserve") {
            neueReserve += einEuro;
          } else {
            neuerEinEuroBestand += einEuro;
          }

          tx.update(automatRef, {
            bestandScheine: (Number(automat.bestandScheine) || 0) - scheine,
            bestandMuenzen: (Number(automat.bestandMuenzen) || 0) - muenzen,
            bestandEinEuro: neuerEinEuroBestand,
            lastEinzahlung: admin.firestore.FieldValue.serverTimestamp()
          });

          tx.set(
            reserveRef,
            {
              betrag: neueReserve,
              lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
          );

          tx.set(db.collection("einzahlungen").doc(), {
            automatCode,
            teamleiterId,
            scheine,
            muenzen,
            einEuro,
            einEuroZiel,
            gesamtSumme,
            photoUrl1: photoUrl1 || null,
            photoUrl2: photoUrl2 || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });

        return res.json({
          ok: true,
          scheineSumme: scheine,
          muenzenSumme: muenzen,
          gesamtSumme
        });

      } catch (err) {
        console.error("submitEinzahlung", err);
        return res.status(500).json({ error: "Serverfehler" });
      }
    });
  });
