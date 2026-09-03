// ==========================================
// Firebase (Firestore) helper
// - Saves each answer a user gives (1 = correct, 0 = wrong) under a
//   document keyed by their WhatsApp phone number.
// - Saves the final score/percentage once the quiz finishes.
//
// IMPORTANT: this uses the Firebase ADMIN SDK (service account), not the
// client SDK. The old code used `firebase/firestore` (the client SDK),
// which is subject to Firestore Security Rules. Since this bot runs on a
// server with no signed-in user, the default rules reject every read/write
// with "PERMISSION_DENIED: Missing or insufficient permissions" - that was
// the cause of the error in the deploy logs. The Admin SDK authenticates
// with a service account and bypasses Security Rules entirely, which is
// the correct way to talk to Firestore from trusted backend code.
//
// Setup required (one-time):
//   1. Firebase Console -> Project settings -> Service accounts
//      -> "Generate new private key" (downloads a JSON file)
//   2. Copy the ENTIRE contents of that JSON file
//   3. On Railway: Service -> Variables -> add FIREBASE_SERVICE_ACCOUNT
//      and paste the JSON as the value
// ==========================================
const admin = require("firebase-admin");
const config = require("./config");

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT environment variable is not set. " +
        "Generate a service account key (Firebase Console -> Project settings -> " +
        "Service accounts -> Generate new private key) and paste its JSON as the " +
        "FIREBASE_SERVICE_ACCOUNT variable (Railway -> Variables)."
    );
  }

  const trimmed = raw.trim();
  try {
    // Accept either raw JSON or base64-encoded JSON (base64 is handy on
    // Railway since it avoids issues with the private key's newlines).
    const jsonText = trimmed.startsWith("{")
      ? trimmed
      : Buffer.from(trimmed, "base64").toString("utf8");
    return JSON.parse(jsonText);
  } catch (err) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON (or valid base64-encoded JSON): " +
        err.message
    );
  }
}

let db = null;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(loadServiceAccount()),
      projectId: config.FIREBASE_CONFIG.projectId,
    });
  }
  db = admin.firestore();
  console.log("✅ Firebase Admin initialized - answers will be saved to Firestore.");
} catch (err) {
  // Don't crash the whole bot just because Firestore isn't configured -
  // the quiz itself should keep working even if saving fails.
  console.error("⚠️ Firebase Admin init failed - answers will NOT be saved:", err.message);
}

// Save one question's answer (1 = correct, 0 = wrong) for this phone number.
// Uses merge:true so previous answers already saved for this user aren't lost.
async function saveAnswer(phone, questionId, isCorrect) {
  if (!db) return;
  try {
    const ref = db.collection(config.FIRESTORE_COLLECTION).doc(phone);
    await ref.set(
      {
        phone,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        answers: {
          [String(questionId)]: isCorrect ? 1 : 0,
        },
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Firebase saveAnswer failed for ${phone}:`, err.message);
  }
}

// Save the final score once all questions have been answered.
// Returns the percentage (correct answers / total * 100).
async function saveFinalReport(phone, score, total) {
  const percentage = Math.round((score / total) * 100);
  if (!db) return percentage;
  try {
    const ref = db.collection(config.FIRESTORE_COLLECTION).doc(phone);
    await ref.set(
      {
        phone,
        score,
        total,
        percentage,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Firebase saveFinalReport failed for ${phone}:`, err.message);
  }
  return percentage;
}

module.exports = { saveAnswer, saveFinalReport };
