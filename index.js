// ==========================================
// WhatsApp Bot using Baileys
// - Every incoming message is marked as "seen" (read receipt)
// - /start -> asks "අද දවස කොහොමද?" together with a LIST MENU
//   (single_select) right under it, with "හොදයි" / "නරකයි" rows
// - හොදයි  -> replies with 😄
// - නරකයි  -> replies with 😢
// - On successful connection, sends a "connected" message
//   to the configured NOTIFY_NUMBER
// - A small web page (http://localhost:3000) shows the QR
//   code so you can connect the bot from your phone
// ==========================================

const makeWASocket = require("baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("baileys");
const P = require("pino");
const express = require("express");
const QRCode = require("qrcode");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const { sendInteractiveMessage } = require("@ryuu-reinzz/button-helper");

// ---- shared state used by the web server ----
let latestQR = null;
let connectionState = "connecting"; // connecting | connected | disconnected
let currentSock = null; // reference to the active socket (needed to force a reconnect after a creds.json upload)

// ---- dedupe cache so we never reply twice to the same incoming message ----
// (kept at module scope so it survives reconnects, since startBot() can
// run again on reconnection without losing what was already processed)
const processedMessageIds = new Set();
function alreadyProcessed(uniqueId) {
  if (processedMessageIds.has(uniqueId)) return true;
  processedMessageIds.add(uniqueId);
  // keep the cache small — we only need to remember recent messages
  if (processedMessageIds.size > 500) {
    const recent = Array.from(processedMessageIds).slice(-250);
    processedMessageIds.clear();
    recent.forEach((id) => processedMessageIds.add(id));
  }
  return false;
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // we show the QR on the web page instead
    logger: P({ level: "silent" }),
    browser: ["Baileys Bot", "Chrome", "1.0"],
  });

  currentSock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      connectionState = "connecting";
    }

    if (connection === "close") {
      connectionState = "disconnected";
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed. Reconnecting:", shouldReconnect);
      if (shouldReconnect) {
        startBot();
      } else {
        console.log("Logged out. Delete the auth_info folder and restart to re-link.");
      }
    } else if (connection === "open") {
      connectionState = "connected";
      latestQR = null;
      console.log("✅ WhatsApp connected!");

      // Notify the configured number that the bot is connected
      try {
        const jid = `${config.NOTIFY_NUMBER}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: config.TEXT.CONNECTED_MSG });
      } catch (err) {
        console.error("Could not send the connected notification:", err.message);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;

    // Mark every incoming message as "seen" (blue tick read receipt),
    // regardless of whether we recognize/act on its content.
    try {
      await sock.readMessages([msg.key]);
    } catch (err) {
      console.error("Could not mark message as read:", err.message);
    }

    // Skip if we've already handled this exact message before
    // (prevents replying twice to the same /start, etc.)
    const uniqueId = `${from}_${msg.key.id}`;
    if (alreadyProcessed(uniqueId)) return;

    // If the user tapped a list-menu row, the id we set
    // (e.g. "good", "bad") comes back inside
    // interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
    let buttonReplyId = null;
    const paramsJson =
      msg.message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (paramsJson) {
      try {
        buttonReplyId = JSON.parse(paramsJson).id || null;
      } catch (e) {
        // ignore malformed paramsJson
      }
    }

    // Pull the text out no matter how it was sent
    // (tapped list row, plain text, or a legacy button reply)
    const body = (
      buttonReplyId ||
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.buttonsResponseMessage?.selectedDisplayText ||
      msg.message.buttonsResponseMessage?.selectedButtonId ||
      msg.message.templateButtonReplyMessage?.selectedDisplayText ||
      ""
    ).trim();

    const lower = body.toLowerCase();

    try {
      if (lower === "/start") {
        // Question + list menu in ONE message, sent exactly once.
        await sendListMenu(sock, from, {
          text: config.TEXT.START,
          buttonText: config.TEXT.LIST_BUTTON,
          sections: [
            {
              title: "Main Menu",
              rows: [
                { id: "good", title: config.TEXT.GOOD_BUTTON },
                { id: "bad", title: config.TEXT.BAD_BUTTON },
              ],
            },
          ],
        });
      } else if (lower === "good" || body === config.TEXT.GOOD_BUTTON) {
        await sock.sendMessage(from, { text: config.TEXT.GOOD_REPLY });
      } else if (lower === "bad" || body === config.TEXT.BAD_BUTTON) {
        await sock.sendMessage(from, { text: config.TEXT.BAD_REPLY });
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  return sock;
}

// Sends a real WhatsApp "list menu" — one button (e.g. "තෝරන්න") that,
// when tapped, opens a scrollable list of options grouped into sections.
// This uses button-helper's `single_select` native flow so it renders
// as a genuine list picker instead of side-by-side quick-reply buttons.
async function sendListMenu(sock, jid, { text, title, buttonText, sections, footer }) {
  try {
    await sendInteractiveMessage(sock, jid, {
      text,
      footer: footer || "Tap the button to see options",
      interactiveButtons: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: buttonText,
            sections: sections.map((s) => ({
              title: s.title,
              rows: s.rows.map((r) => ({
                id: r.id,
                title: r.title,
                description: r.description || "",
              })),
            })),
          }),
        },
      ],
    });
  } catch (err) {
    console.error("List menu failed, falling back to plain text:", err.message);
    const fallbackList = sections
      .flatMap((s) => s.rows.map((r) => `• ${r.title}`))
      .join("\n");
    await sock.sendMessage(jid, { text: `${text}\n\n${fallbackList}` });
  }
}

startBot();

// ==========================================
// Web server: shows a QR code to connect the bot
// ==========================================
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // creds.json is tiny, 2MB is more than enough
});

const credsPath = () => path.join(config.AUTH_FOLDER, "creds.json");

// Shared "upload your saved creds.json" form, shown on the QR / connecting page
// so you can skip scanning again if you already saved a creds.json before.
function uploadForm() {
  return `
    <hr style="border-color:#333; margin:28px 0;" />
    <p style="opacity:.8">දැනටමත් <code>creds.json</code> file එකක් save කරගෙන තියෙනවා නම්, ඒක upload කරලා QR scan නැතුව connect කරගන්න:</p>
    <form action="/upload-creds" method="POST" enctype="multipart/form-data">
      <input type="file" name="creds" accept=".json,application/json" required />
      <button type="submit">Upload creds.json</button>
    </form>
  `;
}

app.get("/", async (req, res) => {
  if (connectionState === "connected") {
    const hasCreds = fs.existsSync(credsPath());
    return res.send(page(`
      <h1>✅ Connected!</h1>
      <p>Your WhatsApp bot is up and running.</p>
      ${hasCreds ? `
        <p style="margin-top:24px;">
          <a href="/download-creds"><button>⬇️ Download creds.json</button></a>
        </p>
        <p style="opacity:.7; font-size:14px;">
          මේ file එක save කරගන්න. ආයෙ deploy කරද්දී (redeploy / restart) මේ file එක
          <code>${config.AUTH_FOLDER}/creds.json</code> විදිහට upload කළොත් ආයෙත් QR scan කරන්න ඕනේ නෑ.
        </p>
      ` : ""}
    `));
  }

  if (latestQR) {
    const qrImage = await QRCode.toDataURL(latestQR);
    return res.send(page(`
      <h2>Scan this QR code with WhatsApp</h2>
      <p>WhatsApp → Linked Devices → Link a device</p>
      <img src="${qrImage}" width="280" height="280" />
      <script>setTimeout(() => location.reload(), 5000)</script>
      ${uploadForm()}
    `));
  }

  res.send(page(`
    <h2>Generating QR code...</h2>
    <p>Please wait a few seconds.</p>
    <script>setTimeout(() => location.reload(), 3000)</script>
    ${uploadForm()}
  `));
});

// Download the current creds.json so it can be kept safe / re-uploaded later
app.get("/download-creds", (req, res) => {
  if (!fs.existsSync(credsPath())) {
    return res.status(404).send(page(`
      <h2>❌ creds.json හම්බුනේ නෑ</h2>
      <p>මුලින්ම QR code එක scan කරලා bot එක connect කරගන්න.</p>
      <p><a href="/">← ආපහු යන්න</a></p>
    `));
  }
  res.download(credsPath(), "creds.json");
});

// Upload a previously-saved creds.json to restore a session without scanning
// the QR code again (useful after a redeploy on a host with no persistent disk).
app.post("/upload-creds", upload.single("creds"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send(page(`
      <h2>❌ File එකක් තෝරන්න ඕනේ</h2>
      <p><a href="/">← ආපහු යන්න</a></p>
    `));
  }

  try {
    const parsed = JSON.parse(req.file.buffer.toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error("invalid json");

    fs.mkdirSync(config.AUTH_FOLDER, { recursive: true });
    fs.writeFileSync(credsPath(), JSON.stringify(parsed, null, 2));
  } catch (err) {
    return res.status(400).send(page(`
      <h2>❌ මේක valid creds.json file එකක් නෙමෙයි</h2>
      <p>${err.message}</p>
      <p><a href="/">← ආපහු යන්න</a></p>
    `));
  }

  res.send(page(`
    <h2>✅ creds.json upload උනා!</h2>
    <p>Bot එක ඒක පාවිච්චි කරලා reconnect වෙනවා...</p>
    <script>setTimeout(() => location.href = "/", 4000)</script>
  `));

  // Force the socket to close so the reconnect logic in connection.update
  // picks up and re-reads the freshly-uploaded creds.json from disk.
  connectionState = "connecting";
  latestQR = null;
  try {
    if (currentSock) {
      currentSock.end(new Error("restart-with-uploaded-creds"));
    } else {
      startBot();
    }
  } catch (err) {
    console.error("Could not restart with uploaded creds:", err.message);
    startBot();
  }
});

function page(inner) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>WhatsApp Bot - Connect</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #111;
      color: #eee;
      text-align: center;
      padding-top: 60px;
    }
    img { border-radius: 12px; background: #fff; padding: 12px; }
    button {
      background: #25D366;
      color: #111;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: #1ebe5b; }
    input[type="file"] { color: #eee; margin: 10px 0; display: block; }
    a { color: #25D366; }
    code {
      background: #222;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>${inner}</body>
</html>`;
}

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${config.PORT}`);
});
