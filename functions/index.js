exports.verifyPin = require("./verifyPin").verifyPin;
exports.loadAutomaten = require("./loadAutomaten").loadAutomaten;

exports.getLastWechsler = require("./getLastWechsler").getLastWechsler;

// Einzahl-App Endpunkte (Hosting-Rewrites)
exports.submitAutomat = require("./submitAutomat").submitAutomat;
exports.submitBelege = require("./submitBelege").submitBelege;
