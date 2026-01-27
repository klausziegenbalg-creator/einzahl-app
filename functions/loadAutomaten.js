const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

exports.loadAutomaten = functions.https.onRequest(async (req, res) => {
  try {
    const { role, name, stadt } = req.body || {};
    if (!role) return res.json({ ok: false, error: "role fehlt" });

    const r = norm(role);
    let docs = [];

    // =========================
    // ADMIN → ALLE AUTOMATEN
    // =========================
    if (r === "admin") {
      const snap = await db.collection("automaten").get();
      docs = snap.docs;
    }

    // =========================
    // TEAMLEITER → SEINE AUTOMATEN
    // 1) wenn stadt mitkommt: nach stadt filtern
    // 2) sonst (wie bei dir vorgesehen): nach leitung == name filtern
    // =========================
    else if (r === "teamleiter") {
      if (stadt) {
        const snap = await db.collection("automaten").where("stadt", "==", stadt).get();
        docs = snap.docs;
      } else {
        if (!name) return res.json({ ok: false, error: "name fehlt (teamleiter)" });

        // Firestore ist case-sensitiv → robust wie Reiniger-App: alles holen & in JS filtern
        const all = await db.collection("automaten").get();
        const target = norm(name);

        docs = all.docs.filter(d => {
          const a = d.data() || {};
          return norm(a.leitung) === target; // 🔥 Teamleiter-Zuordnung
        });
      }
    }

    // =========================
    // MITARBEITER → NUR SEINE
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
    // Response bauen
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

    // Reserve (wie bisher, falls genutzt)
    let reserve = 0;
    if (name) {
      const rSnap = await db.collection("reserven").doc(String(name)).get();
      if (rSnap.exists) reserve = toNumber(rSnap.data()?.betrag);
    }

    return res.json({
      ok: true,
      count: automaten.length,
      centers: Array.from(centers).map(c => ({ name: c })),
      automaten,
      reserve
    });

  } catch (err) {
    console.error("loadAutomaten error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Serverfehler" });
  }
});