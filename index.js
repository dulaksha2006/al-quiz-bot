// ==========================================
// WhatsApp Bot using Baileys
// - /start  -> asks "අද දවස කොහොමද?" with an "Answers" button
// - Answers -> opens a LIST MENU (single_select) with "හොදයි" / "නරකයි" rows
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
const { sendInteractiveMessage } = require("@ryuu-reinzz/button-helper");

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

    // If the user tapped a quick_reply button, the id we set
    // (e.g. "answers", "good", "bad") comes back inside
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
    // (tapped quick_reply button, plain text, or a legacy button reply)
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
        await sendButtons(
          sock,
          from,
          config.TEXT.START,
          [{ id: "answers", text: config.TEXT.START_BUTTON }]
        );
      } else if (lower === "answers" || lower === config.TEXT.START_BUTTON.toLowerCase()) {
        await sendListMenu(sock, from, {
          text: config.TEXT.ANSWER_PROMPT,
          title: "Answers",
          buttonText: "Tap Here",
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

// Sends real WhatsApp native "quick reply" buttons using
// @ryuu-reinzz/button-helper (adds the binary node wrappers WhiskeySockets/
// Baileys is missing, so buttons actually render on the phone).
// If it fails for any reason, we fall back to a plain numbered text list
// so the bot still works either way.
async function sendButtons(sock, jid, text, options) {
  const interactiveButtons = options.map((opt) => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: opt.text,
      id: opt.id,
    }),
  }));

  try {
    await sendInteractiveMessage(sock, jid, {
      text,
      footer: "Tap the button to reply",
      interactiveButtons,
    });
  } catch (err) {
    console.error("button-helper failed, falling back to plain text:", err.message);
    const fallbackList = options.map((opt) => `• ${opt.text}`).join("\n");
    await sock.sendMessage(jid, { text: `${text}\n\n${fallbackList}` });
  }
}

// Sends a real WhatsApp "list menu" — one button (e.g. "Tap Here") that,
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
