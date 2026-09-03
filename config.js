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

  // Message texts (Sinhala)
  TEXT: {
    START: "අද දවස කොහොමද?",
    LIST_BUTTON: "තෝරන්න",
    GOOD_BUTTON: "හොදයි",
    BAD_BUTTON: "නරකයි",
    GOOD_REPLY: "😄",
    BAD_REPLY: "😢",
    CONNECTED_MSG: "✅ Bot connected!",
  },
};
