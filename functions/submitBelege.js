const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.submitBelege = functions.https.onRequest(async (req, res) => {
  try {
    const { einzahlId, stadt, teamleiter, beleg1Path, beleg2Path } = req.body || {};

    if (!einzahlId || !beleg1Path) {
      return res.json({ ok: false, error: "Pflichtfelder fehlen" });
    }

    const snap = await db
      .collection("einzahlungen_automaten")
      .where("einzahlId", "==", einzahlId)
      .get();

    if (snap.empty) {
      return res.json({ ok: false, error: "Keine Automaten gefunden" });
    }

    let gesamtReserveDelta = 0;
    const automaten = [];

    snap.docs.forEach(doc => {
      const a = doc.data() || {};
      gesamtReserveDelta += Number(a.reserveDelta) || 0;
      automaten.push(a);
    });

    const reserveRef = db.collection("reserven").doc(String(teamleiter));
    const reserveSnap = await reserveRef.get();
    const alteReserve = reserveSnap.exists ? Number(reserveSnap.data().betrag) || 0 : 0;
    const neueReserve = alteReserve + gesamtReserveDelta;

    await reserveRef.set(
      { betrag: neueReserve, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    await db.collection("einzahlungen").add({
      einzahlId,
      stadt: stadt || "",
      teamleiter,
      automaten,
      alteReserve,
      neueReserve,
      beleg1Path,
      beleg2Path: beleg2Path || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.json({ ok: true, neueReserve });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});