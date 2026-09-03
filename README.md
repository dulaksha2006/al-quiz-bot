# WhatsApp Bot (Baileys)

සරල WhatsApp bot එකක් — `baileys` library එක පාවිච්චි කරලා හදලා තියෙන්නේ.

## කරන දේවල්

- Bot එකට එන **හැම message එකක්ම** automatic "Seen" (read receipt) කරනවා
- `/start` කිව්වම → "අද දවස කොහොමද?" කියන ප්‍රශ්නෙයි ඒකට යටින්ම **list menu** එකයි (**තෝරන්න** button එකක් තට්ටු කළම open වෙන list එකක්) එකම message එකකින් යනවා — දෙපාරක් නෙමෙයි එකපාරයි යන්නේ
- List එකේ **හොදයි** / **නරකයි** කියලා options දෙකක් තියෙනවා
- **හොදයි** තෝරගත්තොත් → 😄 එවනවා
- **නරකයි** තෝරගත්තොත් → 😢 එවනවා
- Bot connect උනාම → `0768480793` කියන number එකට "connected" කියලා message එකක් යනවා
- Bot එක connect කරගන්න QR code එකක් පෙන්නන web page එකක් තියෙනවා (`http://localhost:3000`)

> **වැදගත් සටහන්:** List menu එක real WhatsApp interactive message එකක් විදිහට යවන්න `@ryuu-reinzz/button-helper` කියන package එක පාවිච්චි කරලා තියෙනවා — Baileys library එකට native interactive messages send කරන්න පුළුවන් වෙන්නේ නෑ නිසා මේ package එක WhatsApp client එක expect කරන binary node structure එක හදලා දෙනවා. මේක undocumented WhatsApp internals පාවිච්චි කරන package එකක් නිසා, WhatsApp update එකකින් පස්සේ වැඩ නොකරන්නත් පුළුවන්. ඒක නිසා list menu එක fail උනොත් bot එක automatically plain-text list එකකට fallback වෙනවා.

## Setup කරන විදිය

### 1. Node.js install කරගන්න
Node.js version 18 හෝ ඊට වැඩි එකක් ඕනේ. https://nodejs.org

### 2. Dependencies install කරගන්න
මේ folder එක terminal එකෙන් open කරලා:

```bash
npm install
```

### 3. Notify number එක check කරගන්න (අවශ්‍ය නම් වෙනස් කරන්න)
`config.js` file එකේ:

```js
NOTIFY_NUMBER: "94768480793",
```

`0768480793` කියන number එක Sri Lanka country code (`94`) එකත් එක්ක දාලා තියෙන්නේ. Number එක වෙනස් කරන්න ඕනේ නම් මෙතන edit කරන්න (country code එකෙන් පටන් ගන්න ඕනේ, `0` නැතුව).

### 4. Bot එක run කරන්න

```bash
npm start
```

### 5. Bot එක connect කරන්න

1. Browser එකෙන් `http://localhost:3000` open කරන්න
2. QR code එක පෙන්වයි
3. ඔයාගේ phone එකේ WhatsApp → **Settings → Linked Devices → Link a Device** ගිහින් QR code එක scan කරන්න
4. Connect උනාම page එකේ "✅ Connected!" කියලා පෙන්වයි, සහ `0768480793` කියන number එකට "connected" message එකක් යනවා

### 6. Bot එක test කරන්න

වෙන phone එකකින් (හෝ ඔයාගේම WhatsApp account එකෙන්) bot connect කරගත්තු number එකට:

```
/start
```

කියලා type කරලා යවන්න.

## QR scan නැතුව reconnect කරගන්න (creds.json Download/Upload)

Volume එකක් setup කරන්න බැරි උනොත් (හෝ අලුත් server එකකට bot එක ගෙනියද්දී), web page එකෙන්ම `creds.json` file එක download/upload කරගන්න පුළුවන්:

- Bot එක connect උනාට පස්සේ, page එකේ **⬇️ Download creds.json** button එක තට්ටු කරලා ඒ file එක save කරගන්න.
- Bot එක restart උනාට පස්සේ (redeploy එකකින් හෝ session එක නැති උනොත්) QR page එකේ පහළින් තියෙන upload form එකෙන් save කරගත්තු `creds.json` file එක upload කරන්න — QR scan කරන්නම ඕනේ නෑ, bot එක ඒ file එකම පාවිච්චි කරලා ආයෙත් connect වෙනවා.
- Upload කරගත්තු file එක automatic ව `${AUTH_FOLDER}/creds.json` (default: `auth_info/creds.json`) විදිහට save වෙනවා.

> **සටහන:** මේකෙන් save වෙන්නේ `creds.json` file එකම විතරයි (login/session identity එක). Chat history/contacts වගේ අනිත් sync files auto-generate වෙනවා, ඒවා save වෙන්නේ නෑ — ඒවගේ ප්‍රශ්නයක් නෑ, bot එකට ආයෙත් message handle කරගන්න පුළුවන් වෙනවා. Persistent volume එකක් (පහළින් තියෙන section එක) තියෙනවා නම් ඒක තමයි වඩාත් reliable විදිහ.

## Railway.com එකට Deploy කරන විදිය

### 1. GitHub එකට push කරන්න
මේ folder එක GitHub repo එකක් විදිහට push කරන්න (`.gitignore` file එකේ `node_modules` සහ `auth_info` දාලා තියෙනවා, ඒවා push වෙන්නේ නෑ — හොඳයි).

```bash
git init
git add .
git commit -m "WhatsApp bot"
git branch -M main
git remote add origin <ඔයාගේ GitHub repo URL එක>
git push -u origin main
```

### 2. Railway එකේ project එකක් හදන්න
1. https://railway.com → **New Project** → **Deploy from GitHub repo**
2. ඔයාගේ repo එක select කරන්න
3. Railway auto-detect කරයි (`package.json` + `railway.json` දැක්කම Nixpacks builder එකෙන් build කරගන්නවා, `node index.js` command එකෙන් run කරනවා)

### 3. Persistent Volume එකක් add කරන්න (**වැදගත්!**)
`auth_info` folder එකේ තමයි WhatsApp login session එක save වෙන්නේ. Volume එකක් නැත්නම් bot එක restart උනාම (deploy කරන හැම වෙලාවකම) ආයෙත් QR scan කරන්න වෙනවා.

1. Railway project එකේ **Settings → Volumes** → **New Volume**
2. Mount path එකට දාන්න: `/app/auth_info`
3. Save කරන්න — deploy එක ආයෙත් වෙයි

### 4. Public domain එකක් generate කරන්න (QR code එක scan කරන්න)
1. Service එකේ **Settings → Networking → Generate Domain**
2. ලැබෙන URL එක (උදා: `https://your-app.up.railway.app`) browser එකෙන් open කරන්න
3. QR code එක scan කරලා bot එක connect කරගන්න

### 5. Environment Variables (optional)
Railway auto-assign කරන `PORT` variable එක code එකෙන් already read කරනවා (`config.js` → `process.env.PORT`), ඒක වෙනස් කරන්න ඕනේ නෑ.

Notify number එක වෙනස් කරන්න ඕනේ නම් Railway **Variables** tab එකෙන් `NOTIFY_NUMBER` කියලා env variable එකක් දාන්න පුළුවන් (`config.js` දැනට hardcoded කරලා තියෙන්නේ, අවශ්‍ය නම් `process.env.NOTIFY_NUMBER || "94768480793"` විදිහට edit කරන්න).

## වෙනත් Server එකකට Deploy කරන්න

මේ code එක VPS එකක (Ubuntu/Debian), Render වගේ Node.js support කරන server එකකටත් deploy කරන්න පුළුවන් — ඕනෑම තැනක `auth_info` folder එක persist වෙන්න ඕනේ කියන එක මතක තියාගන්න.

## Files

- `index.js` — Bot logic + QR web server
- `config.js` — Settings (notify number, messages, port)
- `package.json` — Dependencies
