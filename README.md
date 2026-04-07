# ClaudeWatch

**Voice-first Claude Code client** for Apple Watch (via Ant Browser) and iPhone/desktop.  
Streams responses from your self-hosted Claude Code relay in real time.

---

## Features

| Feature | Detail |
|---|---|
| 🎤 Voice input | WebKit `SpeechRecognition` — works in Ant Browser on watchOS + iOS |
| ⚡ Streaming replies | NDJSON stream piped from your relay, rendered token by token |
| ⌚ Watch layout | Compact UI at ≤ 260 px viewport or `Watch\|watchOS` UA |
| 📱 Phone layout | Full hero + feature grid at ≤ 768 px or mobile UA |
| 🖥 Desktop layout | Expanded card with shadow for any larger viewport |
| 🔒 Private by default | Relay URL + token stored only in `localStorage` on the user's device |
| ↺ Session continuity | Claude Code session ID persisted across page reloads |
| 📲 PWA-ready | `apple-mobile-web-app-capable`, black-translucent status bar, safe-area insets |

---

## Local development

```bash
git clone https://github.com/Everaldtah/Claudewatch-app-for-ant-browser.git
cd Claudewatch-app-for-ant-browser
npm install
npm run dev
# → http://localhost:3000
```

### Simulate watch / phone layout

Append a `?view=` override to the URL:

```
http://localhost:3000/?view=watch    # compact watch UI
http://localhost:3000/?view=phone    # mobile UI
http://localhost:3000/?view=desktop  # full desktop UI
```

---

## Running the companion Claude Code relay

ClaudeWatch needs a small HTTP server that accepts `POST /prompt` and streams  
NDJSON back. Here is a minimal Node.js relay you can self-host:

```js
// relay.js
import http from 'node:http';
import { execFile } from 'node:child_process';

const PORT    = process.env.PORT       ?? 3001;
const TOKEN   = process.env.AUTH_TOKEN ?? '';   // Set a secret token

http.createServer((req, res) => {
  // Auth check
  const auth = req.headers['authorization'] ?? '';
  if (TOKEN && auth !== `Bearer ${TOKEN}`) {
    res.writeHead(401).end(JSON.stringify({ type: 'error', message: 'Unauthorized' }) + '\n');
    return;
  }

  if (req.method !== 'POST' || req.url !== '/prompt') {
    res.writeHead(404).end();
    return;
  }

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    const { prompt, session_id } = JSON.parse(body);
    const args = ['-p', '--output-format', 'stream-json', '--no-interactive'];
    if (session_id) args.push('--session', session_id);
    args.push(prompt);

    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    });

    const child = execFile('claude', args);
    child.stdout?.pipe(res);
    child.stderr?.on('data', d =>
      res.write(JSON.stringify({ type: 'error', message: String(d) }) + '\n')
    );
    child.on('close', () => res.end());
  });
}).listen(PORT, () => console.log(`Relay listening on :${PORT}`));
```

```bash
AUTH_TOKEN=your-secret-token node relay.js
```

### Expose the relay with HTTPS (required for voice + PWA on iOS)

Pick any tunnel approach:

```bash
# Tailscale (recommended — stable URL, no account limits)
tailscale serve https+insecure 3001

# Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001

# ngrok (quick testing)
ngrok http 3001
```

Copy the resulting `https://` URL — you will enter it in ClaudeWatch settings.

---

## Using ClaudeWatch in Ant Browser on Apple Watch

1. On your Apple Watch open **Ant Browser** (App Store).
2. Navigate to your ClaudeWatch Vercel URL.
3. Tap **⚙ Settings** on first launch, enter:
   - **Relay URL** — your HTTPS tunnel URL (e.g. `https://abc.trycloudflare.com`)
   - **Bearer Token** — the value of `AUTH_TOKEN` you set on the relay
4. Tap **Save**.
5. Tap 🎤 to speak or use the Digital Crown to scroll and type.
6. Tap **↑ Send** to send; replies stream in real time.

> **Tip:** Add ClaudeWatch to your iPhone Home Screen as a PWA first, then open  
> the same URL from Ant Browser on your Watch for the compact UI.

---

## Vercel deployment

### Option A — CLI (recommended for CI/scripting)

```bash
npm i -g vercel

# Interactive first deploy
vercel login
vercel
vercel --prod

# Non-interactive (use your token)
vercel deploy --prod --yes --token "$VERCEL_TOKEN"
```

### Option B — GitHub import (zero-config)

1. Push this repo to GitHub.
2. Visit [vercel.com/new](https://vercel.com/new), pick the repo.
3. Framework is auto-detected as **Next.js**.
4. Click **Deploy** — no env vars needed.

### Option C — mirror-to-github helper + auto-deploy

```bash
GITHUB_TOKEN=ghp_xxx \
  ./scripts/mirror-to-github.sh \
  https://github.com/Everaldtah/Claudewatch-app-for-ant-browser.git
```

With Vercel GitHub integration enabled, every push to `main` triggers a new deploy.

---

> ⚠️ **Security warning:** Never paste Vercel tokens into chat, commit them to  
> source control, or share them publicly. Revoke any exposed token immediately at  
> **https://vercel.com/account/tokens**. No env vars are required to run  
> ClaudeWatch — the relay URL and bearer token are entered by each user in their  
> own browser and stored only on their device.

---

## Project layout

```
claudewatch/
├── app/
│   ├── layout.tsx              # metadata, viewport, apple-mobile-web-app-capable, manifest
│   ├── page.tsx                # main UI (client component)
│   ├── globals.css             # design system + responsive watch/phone rules
│   └── api/prompt/route.ts     # POST proxy — streams NDJSON from relay
├── lib/
│   ├── useDevice.ts            # returns 'watch' | 'phone' | 'desktop'
│   ├── useVoice.ts             # Web Speech API wrapper
│   └── useSettings.ts          # localStorage-backed settings hook
├── public/
│   └── manifest.webmanifest
├── scripts/
│   └── mirror-to-github.sh    # push to GitHub with retries + token scrubbing
├── next.config.js
├── package.json
├── tsconfig.json
├── vercel.json
└── README.md
```

---

## Tech stack

- **Next.js 14** (App Router) · TypeScript · React 18
- Hand-written CSS — no UI framework
- Node.js 18+ serverless on Vercel
- Web Speech API for voice (WebKit / Ant Browser)
