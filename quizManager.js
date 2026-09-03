// ==========================================
// Quiz Manager
// - Walks each user through all 150 questions from questions.json,
//   one at a time.
// - Shuffles the 5 answer options for every question so the correct
//   answer isn't always in the same slot (c_answer position varies).
// - Tracks per-user progress in memory (keyed by WhatsApp jid).
// ==========================================
const questions = require("./questions.json");
const { saveAnswer, saveFinalReport } = require("./mongodb");

// jid -> { index, score, total, currentOptions, currentQid }
const sessions = new Map();

const LABELS = ["A", "B", "C", "D", "E"];

function shuffleOptions(q) {
  const opts = [
    { text: q.c_answer, correct: true },
    { text: q.r1_answer, correct: false },
    { text: q.r2_answer, correct: false },
    { text: q.r3_answer, correct: false },
    { text: q.r4_answer, correct: false },
  ];

  // Fisher-Yates shuffle -> randomizes where the correct answer lands
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }

  return opts.map((o, idx) => ({ ...o, key: LABELS[idx] }));
}

function startQuiz(jid) {
  const session = { index: 0, score: 0, total: questions.length };
  sessions.set(jid, session);
  return session;
}

function getSession(jid) {
  return sessions.get(jid);
}

function endQuiz(jid) {
  sessions.delete(jid);
}

// Shuffles the current question's options and stores them on the
// session so the next reply can be checked against them. Returns
// everything needed to render the question as a tappable list menu:
//   { questionNumber, total, quizText, options: [{key, title}] }
function buildQuestionData(jid) {
  const session = sessions.get(jid);
  if (!session) return null;

  const q = questions[session.index];
  const opts = shuffleOptions(q);
  session.currentOptions = opts;
  session.currentQid = q.id;

  return {
    questionNumber: session.index + 1,
    total: session.total,
    quizText: q.quiz,
    options: opts.map((o) => ({ key: o.key, title: o.text })),
  };
}

// Accepts "A".."E", "1".."5", or things like "a)"/"C." and normalizes
// them to a single letter A-E. Returns null if it can't be parsed.
function parseAnswerLetter(body) {
  const t = (body || "").trim().toUpperCase();
  if (!t) return null;

  const numberMap = { "1": "A", "2": "B", "3": "C", "4": "D", "5": "E" };
  if (numberMap[t]) return numberMap[t];
  if (LABELS.includes(t)) return t;

  const first = t[0];
  if (numberMap[first]) return numberMap[first];
  if (LABELS.includes(first)) return first;

  return null;
}

// Processes a user's reply to the *current* question of their session.
// Returns:
//   { invalid: true }                                   - couldn't parse the reply
//   { invalid: false, isCorrect, correctText, finished, score, total, percentage? }
async function processAnswer(jid, phone, body) {
  const session = sessions.get(jid);
  if (!session || !session.currentOptions) return null;

  const letter = parseAnswerLetter(body);
  if (!letter) return { invalid: true };

  const chosen = session.currentOptions.find((o) => o.key === letter);
  if (!chosen) return { invalid: true };

  const isCorrect = chosen.correct;
  const correctOption = session.currentOptions.find((o) => o.correct);

  if (isCorrect) session.score += 1;

  // Save this answer (1 = correct, 0 = wrong) against the user's phone number.
  await saveAnswer(phone, session.currentQid, isCorrect);

  session.index += 1;
  const finished = session.index >= session.total;

  const result = {
    invalid: false,
    isCorrect,
    correctText: correctOption.text,
    finished,
    score: session.score,
    total: session.total,
  };

  if (finished) {
    result.percentage = await saveFinalReport(phone, session.score, session.total);
    sessions.delete(jid);
  }

  return result;
}

module.exports = {
  startQuiz,
  getSession,
  endQuiz,
  buildQuestionData,
  processAnswer,
};
