# AI-Based Android volunteer app

This native Android shell packages the React interface and adds a foreground BLE relay service. Each participating volunteer phone must install this app, grant Nearby devices permission, and start **Nearby volunteer relay** from the Offline & BLE screen. The service advertises and scans for the shared AI-Based service, exchanges chunked incident packets and public community messages, deduplicates them, stores received data on-device, and forwards them up to five hops.

## BLE delivery behavior and limits

- Every packet carries a unique message ID, a six-hour expiry, a five-hop maximum, and a decreasing TTL. Expired, over-limit, unsigned, or signature-invalid packets are not relayed. Duplicate IDs are acknowledged without storing or forwarding a second copy.
- Pending packets and recent delivery statuses are persisted in Android `SharedPreferences`, so they survive process restarts. The relay queue holds up to 100 packets; when full, the oldest queued packet is removed and its status records that outcome. A sender retries an unacknowledged packet up to three times per connection; the queue remains available for a later connection until it expires or the incident API confirms storage.
- Each Android install signs packet content with a per-install ECDSA key held by Android Keystore. Relays verify that signature before accepting a packet. The public key travels with the packet and is self-asserted, so this detects changes after signing but does **not** prove a reporter's identity or prevent a malicious client from creating its own valid packet.
- **Pending** means no nearby phone has acknowledged acceptance. **Received by a nearby phone** means that phone accepted the packet and may relay it. **Incident API confirmed** means the ResQNet incident API stored it. A BLE acknowledgement is not an internet gateway acknowledgement, and API storage does not mean emergency services received or dispatched help.
- The browser BLE walkthrough is a simulator; only the Android companion transmits BLE. BLE range, background behavior, battery use, and Android manufacturer restrictions have not been validated across physical devices. Test on the actual target phones before relying on field behavior. Coverage is limited to compatible participating ResQNet installs within real radio range; this is not a nationwide or arbitrary-device mesh. Wi-Fi Direct is not implemented.

The app also offers optional offline speech-to-text in the emergency description and Community Messages composer. English and Hindi Vosk models download on first use (an internet connection is needed for that initial download); recognition runs locally afterward. Microphone access is requested only when a user starts voice input.

## Build

Requirements: Node.js/npm, JDK 17, and Android SDK Platform 36 (installable through Android Studio's SDK Manager).

From the repository root:

```powershell
npm run build
cd android
.\gradlew.bat assembleDebug
```

The wrapper downloads Gradle 8.13 the first time it runs. Android Studio can also open the `android` folder and build the `app` module. The app targets Android 15 (API 35), with a minimum of Android 8 (API 26). Android 12+ asks volunteers for Scan, Advertise, and Connect permissions when they start the relay.

The local GATT service UUID is `5c4c2ea0-2e25-4a86-9a20-54c08f5b7a10`; its incident write characteristic is `5c4c2ea1-2e25-4a86-9a20-54c08f5b7a10`. Every volunteer build must use the same UUIDs and packet format.

The browser BLE visualizer remains a simulator. The actual transport runs only in this Android app and only between participating ResQNet installs. Community message contents are public and are not end-to-end encrypted. The local Node API and JSON store are separate from BLE and are used when network access is available. Wi-Fi Direct transport and private group messaging are not implemented.
