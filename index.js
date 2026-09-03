// ==========================================
// WhatsApp Bot using Baileys
// - /start  -> asks "අද දවස කොහොමද?" with an "Answers" button
// - Answers -> shows "හොදයි" / "නරකයි" buttons
// - හොදයි   -> replies with 😄
// - නරකයි   -> replies with 😢
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
const config = require("./config");

// ---- shared state used by the web server ----
let latestQR = null;
let connectionState = "connecting"; // connecting | connected | disconnected

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

    // Pull the text out no matter how it was sent
    // (plain text, quoted reply, or a tapped button)
    const body = (
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
        await sendButtons(
          sock,
          from,
          config.TEXT.START,
          [{ id: "answers", text: config.TEXT.START_BUTTON }]
        );
      } else if (lower === "answers" || lower === config.TEXT.START_BUTTON.toLowerCase()) {
        await sendButtons(
          sock,
          from,
          config.TEXT.ANSWER_PROMPT,
          [
            { id: "good", text: config.TEXT.GOOD_BUTTON },
            { id: "bad", text: config.TEXT.BAD_BUTTON },
          ]
        );
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

// Sends a WhatsApp "buttons" message.
// NOTE: Meta has restricted native interactive buttons on many WhatsApp
// clients, so as a safety net we also append a plain-text numbered list.
// That way the bot still works even if the buttons don't render for the user
// — they can just type the option (e.g. "Answers", "හොදයි", "නරකයි").
async function sendButtons(sock, jid, text, options) {
  const buttons = options.map((opt, i) => ({
    buttonId: opt.id,
    buttonText: { displayText: opt.text },
    type: 1,
  }));

  const fallbackList = options.map((opt) => `• ${opt.text}`).join("\n");

  try {
    await sock.sendMessage(jid, {
      text: `${text}\n\n${fallbackList}`,
      footer: "Tap a button or reply with the text",
      buttons,
      headerType: 1,
    });
  } catch (err) {
    // If buttons fail for any reason, fall back to plain text
    await sock.sendMessage(jid, { text: `${text}\n\n${fallbackList}` });
  }
}

startBot();

// ==========================================
// Web server: shows a QR code to connect the bot
// ==========================================
const app = express();

app.get("/", async (req, res) => {
  if (connectionState === "connected") {
    return res.send(page(`
      <h1>✅ Connected!</h1>
      <p>Your WhatsApp bot is up and running.</p>
    `));
  }

  if (latestQR) {
    const qrImage = await QRCode.toDataURL(latestQR);
    return res.send(page(`
      <h2>Scan this QR code with WhatsApp</h2>
      <p>WhatsApp → Linked Devices → Link a device</p>
      <img src="${qrImage}" width="280" height="280" />
      <script>setTimeout(() => location.reload(), 5000)</script>
    `));
  }

  res.send(page(`
    <h2>Generating QR code...</h2>
    <p>Please wait a few seconds.</p>
    <script>setTimeout(() => location.reload(), 3000)</script>
  `));
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
  </style>
</head>
<body>${inner}</body>
</html>`;
}

app.listen(config.PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${config.PORT}`);
});
