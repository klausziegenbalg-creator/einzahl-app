const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.verifyPin = require("./verifyPin").verifyPin;
exports.loadAutomaten = require("./loadAutomaten").loadAutomaten;
exports.getLastWechsler = require("./getLastWechsler").getLastWechsler;
exports.submitAutomat = require("./submitAutomat").submitAutomat;
exports.submitBelege = require("./submitBelege").submitBelege;