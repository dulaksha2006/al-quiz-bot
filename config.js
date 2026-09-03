// ==========================================
// Bot Configuration - edit values here
// ==========================================
module.exports = {
  // Port for the QR-code web page
  PORT: process.env.PORT || 3000,

  // Folder where Baileys will store login session (auth) files
  AUTH_FOLDER: "auth_info",

  // Number to notify when the bot successfully connects.
  // Sri Lankan local number 0768480793 -> international format 94768480793
  NOTIFY_NUMBER: "94768480793",

  // Source PDF sent after all 150 questions are finished.
  // Contains essay (රචනා) questions plus additional correct answers
  // relevant to the MCQs that were asked.
  PDF_URL:
    "https://raw.githubusercontent.com/dulaksha2006/dulaksha2006/refs/heads/main/ilide.info-media-mcq-book-pr_2ee1c2c3e1fab4cfd1035e522bb88a50.pdf",
  PDF_FILE_NAME: "AL-Media-MCQ-Book.pdf",

  // Firebase (Firestore) config - used to save each user's answers
  // (keyed by their phone number) as the quiz progresses.
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyAZ0cFyyrB4RHvzqsAPUmyPcyUZOpn1bAI",
    authDomain: "pdf-guwani.firebaseapp.com",
    projectId: "pdf-guwani",
    storageBucket: "pdf-guwani.firebasestorage.app",
    messagingSenderId: "68525002076",
    appId: "1:68525002076:web:9084851790501531f14599",
    measurementId: "G-40CWX5Q2EN",
  },
  FIRESTORE_COLLECTION: "quiz_responses",

  // Message texts (Sinhala)
  TEXT: {
    CONNECTED_MSG: "✅ Bot connected!",

    // Sent for "Hi"/"Hello" AND for any other normal (unrecognized) message,
    // along with the "ආරම්භ කරන්න" (Start) button
    GREETING:
      "HI, A/L Media MCQ ප්‍රශ්න 150ක් තිබේ, ආරම්භ කිරීමට පහත බටනය ඔබන්න (හෝ /start ලෙස මැසේජ් එකක් එවන්න).",

    // Label on the quick-reply button sent together with GREETING
    START_BUTTON_LABEL: "ආරම්භ කරන්න",

    // Sent right after /start, just before the first question
    QUIZ_INTRO: "🎯 Quiz එක ආරම්භයි! ප්‍රශ්න 150ක් තියෙනවා, සාර්ථක වේවා!",

    ALREADY_RUNNING:
      "⚠️ ඔබ දැනටමත් quiz එකක් කරගෙන යනවා. දිගටම උත්තර දෙන්න, හෝ නැවත ආරම්භ කිරීමට /start යවන්න.",

    INVALID_ANSWER:
      "⚠️ කරුණාකර A, B, C, D හෝ E (හෝ 1-5 අංකයක්) ලෙස පිළිතුර reply කරන්න.",

    CORRECT_REPLY: "✅ නිවැරදියි!",
    WRONG_PREFIX: "❌ වැරදියි! නිවැරදි පිළිතුර: ",

    REPORT_HEADER: "🎉 ප්‍රශ්න 150ම අවසන් උනා! ඔබගේ ප්‍රතිඵලය:",

    PDF_CAPTION:
      "📘 මූලාශ්‍රය: මෙම PDF එකේ රචනා ප්‍රශ්නත්, ඔබ අහපු MCQ ප්‍රශ්නවලට අදාළ තවත් නිවැරදි පිළිතුරුත් අඩංගු වේ.",
  },
};
