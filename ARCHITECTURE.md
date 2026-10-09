# AI-Based architecture and design system

## Current application boundaries

AI-Based is an incremental React application. The current entry point is `src/main.jsx`; `src/App.jsx` owns shared session, incident, resource, volunteer, and navigation state and composes feature screens in `src/components/`.

- **Presentation:** `src/components/` contains the landing, citizen report, map, authority triage, volunteer, analytics, and offline communication screens. Shared visual foundations live in `src/design-system/`.
- **Application services:** `src/services/` isolates incident transport, Supabase authentication and data access, role access, local persistence, geospatial matching, and demo data from screen components.
- **AI decision support:** `src/services/nlpEngine.js` classifies incident reports locally. Its output is advisory and should remain distinguishable from authority-verified incident fields.
- **Offline behavior:** `src/services/offlineStore.js` persists reports and queued operations in browser storage. BLE relay code is a separate prototype path under `android/` and `src/services/`.
- **Server and shared data:** `server/` provides the local Node API fallback. When configured, Supabase supplies authentication, PostgreSQL-backed records, realtime updates, and protected evidence storage.
- **Build and runtime:** Vite builds the web client; `vite.config.js` proxies API requests during local development. The Android companion consumes the built web assets.

## Dependency direction

Screens call application services through their exported functions. Services own transport, persistence, and matching details. Shared design tokens and primitives are imported by the presentation layer and must not depend on feature screens or backend services. Keep external credentials on the server; browser configuration may contain only public client keys.

## Incremental feature layout

Keep the existing working feature modules in place while adding future work by boundary:

```text
src/
  components/       feature screens and reusable UI
  design-system/    semantic tokens and accessible visual primitives
  services/         API, auth, persistence, matching, and AI decision support
  locales/          English, Marathi, and Hindi resources when localization is added
  types/            shared domain types as TypeScript is introduced
server/             local API and server-side validation
android/            volunteer relay companion
supabase/           migrations and database policies
```

This is a migration target, not a demand to move or rewrite the existing app in one pass. Preserve current behavior and move screens onto shared foundations as each requested feature is implemented.

## Design system

The first design-system layer is in `src/design-system/tokens.css` and `src/design-system/primitives.css`. It defines semantic page, surface, text, border, action, and priority colors; common radii, touch-target sizing, and restrained shadows; plus card, control, button, priority, focus, and reduced-motion primitives.

Use the light civic-safety palette for citizen-facing flows, keep emergency red for urgent actions and critical states, and retain text labels alongside priority colors. Use the navy and blue palette for navigation and command surfaces. Keep interactions keyboard accessible and controls at least 44px high. Avoid broad migration of feature-screen markup as part of this foundation step.

## Data and safety boundaries

Treat AI classification and matching as recommendations. Keep the model's category, priority, confidence, and explanation separate from authority overrides and recorded status history. Validate report and evidence inputs at the API boundary, apply role checks before protected reads or writes, and avoid exposing reporter contact details outside authorized views.
