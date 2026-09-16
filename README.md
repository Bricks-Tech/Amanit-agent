# Amanit Voice Concierge

Landing page that embeds the ElevenLabs Conversational AI widget for Amanit.

Agent ID: `agent_3801m2k2eqyxems8x8h9p42bp354`

## Run locally

```bash
cd amanit-voice-agent
python3 -m http.server 4173
```

Open [http://localhost:4173](http://localhost:4173) and allow the microphone.

If the widget is blocked, add `http://localhost:4173` to the agent’s allowed origins in ElevenLabs. Production needs HTTPS.

## Deploy on Vercel

This is a static site. Config lives in `vercel.json`.

```bash
npx vercel
```

After deploy, add your Vercel URL to the ElevenLabs agent’s allowed origins.
