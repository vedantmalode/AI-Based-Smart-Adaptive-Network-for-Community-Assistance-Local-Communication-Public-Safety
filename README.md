# ResQNet

ResQNet is an emergency resource coordination dashboard for Nagpur. It includes a live resource map, volunteer sign-in with active volunteer locations, and online/offline status controls.

## Run locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

To create a production build:

```bash
npm run build
```

The volunteer demo accounts are listed in the sign-in dialog and implemented in `src/services/demoAuth.js`.
