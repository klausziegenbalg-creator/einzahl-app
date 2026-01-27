const functions = require("firebase-functions");
const admin = require("firebase-admin");

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

exports.loadAutomaten = functions.https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();

    const { role, name, stadt } = req.body || {};
    if (!role) return res.json({ ok: false, error: "role fehlt" });

    let snap;

    if (String(role).toLowerCase() === "admin") {
      snap = await db.collection("automaten").get();
    } else if (String(role).toLowerCase() === "teamleiter") {
      if (!stadt) return res.json({ ok: false, error: "stadt fehlt" });
      snap = await db.collection("automaten").where("stadt", "==", stadt).get();
    } else if (String(role).toLowerCase() === "mitarbeiter") {
      if (!name) return res.json({ ok: false, error: "name fehlt" });
      const all = await db.collection("automaten").get();
      const target = String(name).trim().toLowerCase();
      const docs = all.docs.filter(d => {
        const a = d.data() || {};
        return String(a.mitarbeiter || "").trim().toLowerCase() === target;
      });
      snap = { docs };
    } else {
      return res.json({ ok: false, error: "unbekannte Rolle" });
    }

    const automaten = [];
    const centers = new Set();

    (snap.docs || []).forEach(doc => {
      const a = doc.data() || {};
      const automatCode = a.automatCode || a.code || a.automat || doc.id;
      const center = a.center || a.centerName || "Unbekannt";
      const nameLabel = a.name || a.bezeichnung || automatCode;

      centers.add(center);

      automaten.push({
        id: doc.id,
        automatCode,
        name: nameLabel,
        center,
        stadt: a.stadt || "",
        leitung: a.leitung || "",
        mitarbeiter: a.mitarbeiter || "",
        bestandScheine: toNumber(a.bestandScheine),
        bestandMuenzen: toNumber(a.bestandMuenzen),
        bestandEinEuro: toNumber(a.bestandEinEuro)
      });
    });

    let reserve = 0;
    if (name) {
      const rSnap = await db.collection("reserven").doc(String(name)).get();
      if (rSnap.exists) reserve = toNumber(rSnap.data().betrag);
    }

    return res.json({
      ok: true,
      automaten,
      centers: Array.from(centers).map(c => ({ name: c })),
      reserve
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});