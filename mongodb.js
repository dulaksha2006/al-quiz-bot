// ==========================================
// MongoDB helper
// - Saves each answer a user gives (1 = correct, 0 = wrong) under a
//   document keyed by their WhatsApp phone number.
// - Saves the final score/percentage once the quiz finishes.
//
// Setup required (one-time):
//   1. Get your MongoDB connection string (MongoDB Atlas -> Connect ->
//      Drivers), e.g.:
//      mongodb+srv://<user>:<password>@<cluster>.mongodb.net
//   2. On Railway: Service -> Variables -> add MONGODB_URI and paste the
//      connection string as the value (or edit the default below in
//      config.js).
// ==========================================
const { MongoClient } = require("mongodb");
const config = require("./config");

const uri = process.env.MONGODB_URI || config.MONGODB_CONFIG.uri;
const dbName = config.MONGODB_CONFIG.dbName;

let client = null;
let db = null;
let connectingPromise = null;

async function connect() {
  if (db) return db;
  if (connectingPromise) return connectingPromise;

  connectingPromise = (async () => {
    try {
      client = new MongoClient(uri);
      await client.connect();
      db = client.db(dbName);
      console.log("✅ MongoDB connected - answers will be saved to MongoDB.");
      return db;
    } catch (err) {
      console.error("⚠️ MongoDB connection failed - answers will NOT be saved:", err.message);
      db = null;
      return null;
    }
  })();

  return connectingPromise;
}

// Kick off the connection immediately at startup (same behaviour as the
// old Firebase module, which initialized eagerly).
connect();

function collection() {
  if (!db) return null;
  return db.collection(config.MONGODB_CONFIG.collection);
}

// Save one question's answer (1 = correct, 0 = wrong) for this phone number.
// Uses upsert + $set so previous answers already saved for this user aren't lost.
async function saveAnswer(phone, questionId, isCorrect) {
  await connect();
  const col = collection();
  if (!col) return;
  try {
    await col.updateOne(
      { phone },
      {
        $set: {
          phone,
          updatedAt: new Date(),
          [`answers.${questionId}`]: isCorrect ? 1 : 0,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error(`MongoDB saveAnswer failed for ${phone}:`, err.message);
  }
}

// Save the final score once all questions have been answered.
// Returns the percentage (correct answers / total * 100).
async function saveFinalReport(phone, score, total) {
  const percentage = Math.round((score / total) * 100);
  await connect();
  const col = collection();
  if (!col) return percentage;
  try {
    await col.updateOne(
      { phone },
      {
        $set: {
          phone,
          score,
          total,
          percentage,
          completedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error(`MongoDB saveFinalReport failed for ${phone}:`, err.message);
  }
  return percentage;
}

module.exports = { saveAnswer, saveFinalReport };
