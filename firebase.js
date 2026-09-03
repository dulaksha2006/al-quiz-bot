// ==========================================
// Firebase (Firestore) helper
// - Saves each answer a user gives (1 = correct, 0 = wrong) under a
//   document keyed by their WhatsApp phone number.
// - Saves the final score/percentage once the quiz finishes.
// ==========================================
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
} = require("firebase/firestore");
const config = require("./config");

const app = initializeApp(config.FIREBASE_CONFIG);
const db = getFirestore(app);

// Save one question's answer (1 = correct, 0 = wrong) for this phone number.
// Uses merge:true so previous answers already saved for this user aren't lost.
async function saveAnswer(phone, questionId, isCorrect) {
  try {
    const ref = doc(db, config.FIRESTORE_COLLECTION, phone);
    await setDoc(
      ref,
      {
        phone,
        updatedAt: serverTimestamp(),
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
  try {
    const ref = doc(db, config.FIRESTORE_COLLECTION, phone);
    await setDoc(
      ref,
      {
        phone,
        score,
        total,
        percentage,
        completedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Firebase saveFinalReport failed for ${phone}:`, err.message);
  }
  return percentage;
}

module.exports = { saveAnswer, saveFinalReport };
