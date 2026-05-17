# Social Dashboard (Local)

Local Next.js dashboard for sequential AdsPower profile posting with Playwright.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Dashboards:

- `http://localhost:3000` - Social Distributor
- `http://localhost:3000/audio-wash` - Audio Wash

## Configure accounts

Edit `profiles.json`:

```json
[
  { "id": "1", "name": "TikTok Account 1", "profileId": "ads_power_id_1", "platform": "tiktok" },
  { "id": "2", "name": "IG Account 1", "profileId": "ads_power_id_2", "platform": "instagram" }
]
```

## How deploy works

1. Upload MP4 and caption in UI.
2. `/api/deploy` saves file under `tmp/uploads`.
3. For each selected profile (sequential):
   - Start AdsPower profile via `browser/start`.
   - Connect with `chromium.connectOverCDP`.
   - Call `uploadToPlatform(page, platform, videoPath, caption)` placeholder.
   - Stop profile via `browser/stop` in `finally`.

Failures are isolated per profile and do not stop the loop.
