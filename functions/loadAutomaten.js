const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const norm = v => String(v || "").trim().toLowerCase();
const toNumber = v => Number.isFinite(Number(v)) ? Number(v) : 0;

exports.loadAutomaten = functions.https.onRequest(async (req, res) => {
  try {
    const { role, name } = req.body || {};
    if (!role) return res.json({ ok: false, error: "role fehlt" });

    const r = norm(role);
    let docs = [];

    // =========================
    // ADMIN → ALLE
    // =========================
    if (r === "admin") {
      const snap = await db.collection("automaten").get();
      docs = snap.docs;
    }

    // =========================
    // TEAMLEITER → leitung
    // =========================
    else if (r === "teamleiter") {
      if (!name) return res.json({ ok: false, error: "name fehlt" });

      const all = await db.collection("automaten").get();
      const target = norm(name);

      docs = all.docs.filter(d => {
        const a = d.data() || {};
        return norm(a.leitung) === target;
      });
    }

    // =========================
    // MITARBEITER → mitarbeiter
    // =========================
    else if (r === "mitarbeiter") {
      if (!name) return res.json({ ok: false, error: "name fehlt" });

      const all = await db.collection("automaten").get();
      const target = norm(name);

      docs = all.docs.filter(d => {
        const a = d.data() || {};
        return norm(a.mitarbeiter) === target;
      });
    }

    else {
      return res.json({ ok: false, error: "unbekannte Rolle" });
    }

    // =========================
    // RESPONSE
    // =========================
    const automaten = [];
    const centers = new Set();

    docs.forEach(doc => {
      const a = doc.data() || {};
      const automatCode = a.automatCode || doc.id;
      const center = a.center || "Unbekannt";

      centers.add(center);

      automaten.push({
        id: doc.id,
        automatCode,
        center,
        stadt: a.stadt || "",
        leitung: a.leitung || "",
        mitarbeiter: a.mitarbeiter || "",
        bestandScheine: toNumber(a.bestandScheine),
        bestandMuenzen: toNumber(a.bestandMuenzen),
        bestandEinEuro: toNumber(a.bestandEinEuro)
      });
    });

    return res.json({
      ok: true,
      automaten,
      centers: Array.from(centers).map(name => ({ name }))
    });

  } catch (err) {
    console.error("loadAutomaten error:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});