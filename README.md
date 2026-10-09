# AI-Based – Smart Adaptive Network for Community Assistance, Local Communication & Public Safety

AI-Based – Smart Adaptive Network for Community Assistance, Local Communication & Public Safety is a local emergency resource coordination portal for Nagpur. The portal uses a local Management account and a loopback JSON API; it does not use Supabase Auth or email verification.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

This starts the Vite app and the incident API together. Vite proxies `/api` requests to the API on `http://127.0.0.1:3001`.

To run only the frontend, use `npm run dev:frontend`; start the API separately with:

```bash
npm run api
```

Copy `.env.example` to `.env.local` if it does not already exist. Set `MANAGEMENT_LOGIN_ID` and `MANAGEMENT_PASSWORD`; the local `.env.local` has the Management credentials for this workspace. Sign in using those values. The password is read only by the local Node server and is never included in the browser bundle. The server creates a signing key in ignored `server/data/` for local sessions.

Incident records, response units, profiles, and community messages are stored as JSON under `server/data/`. Public emergency reports can be submitted without a login and are stored for Management review. Management can triage incidents, allocate volunteers and resources, and use group and private-message views. Offline reports and messages queue in browser storage until the local API is reachable. This local setup does not synchronize records between separate computers or to a cloud database.

## Android volunteer relay

The native Android companion advertises and scans for nearby AI-Based responder phones, then relays deduplicated SOS packets over BLE. Packets have unique IDs, a six-hour expiry, a five-hop limit, a persisted retry queue, phone-to-phone acknowledgements, and an AndroidKeyStore signature that detects packet alteration. The interface separates nearby-phone receipt from incident-API confirmation; neither status means emergency services received or dispatched help. Build the web assets first, then run `cd android` and `.\gradlew.bat assembleDebug`. See [android/README.md](android/README.md) for setup, permissions, and transport limits. Each volunteer phone must install the app and start the nearby relay.

To create a production build:

```bash
npm run build
```

For a full hosted deployment with Vercel, Render, and Supabase, follow [DEPLOYMENT.md](DEPLOYMENT.md).

## Responder matching and assignment

The dispatcher matcher scores management-approved volunteers by distance within their service radius, incident-relevant listed skills, and current availability. Its default weights are 40/40/20 and can be adjusted in the matcher; weights are normalized before calculating the fit score. Unavailable responders remain visible for context but cannot be selected. The Management room makes the final assignment, with server-side checks for approved and available responders/resources. Volunteer availability is shared with dispatch. Skills on a profile help rank matches but are not certificate-verified by this prototype; Management must verify qualifications before dispatching.

Volunteer profiles need a `volunteer_type` and `volunteer_id` in Supabase to connect authentication to the corresponding responder record.

## MJ1 capabilities included

The current project keeps its existing shared incident, authority dashboard, dispatch, map, offline report queue, and BLE SOS workflows as the canonical versions. MJ1 additions now included are explainable P0–P3 triage with recommended resources, emergency phrase recognition in supported regional languages, Android offline English/Hindi voice input, and a signed-in Community Messages screen. Community messages are public text (up to 500 characters), stored locally while offline, synchronized through the local API or Supabase, and relayed by the Android BLE service when nearby ResQNet devices are running the companion app.

To enable shared messages on Supabase, apply `supabase/migrations/202610070001_resqnet_community_messages.sql` along with the other migrations. Community messaging is intentionally public and is not end-to-end encrypted. The current BLE service relays incident reports and public messages; it does not implement Wi-Fi Direct, BLE mesh discovery across arbitrary apps, or private group messaging. Offline speech models download on first use and require a network connection then; recognition afterward runs on-device and supports English and Hindi.
