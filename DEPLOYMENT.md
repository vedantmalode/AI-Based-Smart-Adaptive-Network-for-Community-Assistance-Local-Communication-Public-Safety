# Full deployment: Vercel + Render + Supabase

This app uses three services in production:

- **Vercel** builds and hosts the Vite frontend.
- **Render** runs the existing Node API, including its login and authenticated incident synchronization routes.
- **Supabase Postgres** stores shared app state. The Node API accesses it with a server-only service-role key.

The API continues to use local JSON files for local development when Supabase variables are absent. In production it requires Supabase, a stable session secret, and an allowed frontend origin.

## 1. Prepare the Supabase database

In the Supabase project, open **SQL Editor**, paste and run `supabase/migrations/202610090001_resqnet_app_state_store.sql`. This adds the private `resqnet_app_state` table used by the current Node API. The service-role key is required for the API; never put it in a `VITE_` variable or in Vercel.

Copy the project URL from **Project Settings → API**. In the Supabase API keys section, copy the server-side `service_role` key. Keep both private for the next step.

## 2. Deploy the Vite frontend once to Vercel

Import the repository in Vercel and use the Vite defaults: root `./`, build command `npm run build`, output directory `dist`, and automatic install command. Leave environment variables empty for this first deployment. Copy the assigned production origin, such as `https://your-project.vercel.app`.

## 3. Deploy the API to Render

1. In Render, create a **Blueprint** from this GitHub repository. It will read `render.yaml` and create the `resqnet-api` web service.
2. Fill the prompted environment variables:
   - `SUPABASE_URL`: the project URL from Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key.
   - `AUTH_SESSION_SECRET`: a unique random secret of at least 32 characters. Generate one locally with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
   - `MANAGEMENT_LOGIN_ID`: the management sign-in email/ID.
   - `MANAGEMENT_PASSWORD`: a strong, unique management password.
   - `FRONTEND_ORIGIN`: the Vercel production origin, for example `https://your-project.vercel.app` (no trailing slash). If needed, provide multiple origins separated by commas.
3. Wait for the Render service to deploy. Its health endpoint should return `{"status":"ok"}` at `/api/health`.

## 4. Connect Vercel to the API

In Vercel project settings, add `VITE_API_BASE_URL` for **Production** and **Preview**, set to the Render service origin, for example `https://resqnet-api.onrender.com` (no trailing slash). Redeploy the frontend after setting it.

Keep the Vercel build settings:

- Framework: **Vite**
- Root directory: `./`
- Build command: `npm run build`
- Output directory: `dist`
- Install command: automatic

Do not add `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SESSION_SECRET`, or `MANAGEMENT_PASSWORD` to Vercel. Those secrets belong only in the Render API service.

## Notes

- The deployment stores application collections as JSON arrays in a private Postgres table so the current API can retain its behavior without writing to an ephemeral filesystem.
- This deployment plan does not upload local `server/data/` or `.env.local` contents. The production database starts empty; seed or re-enter any demo data you need after deployment.
- Render's free web services may sleep while idle. The first request after inactivity can take longer.
- Keep the Android app on the local API flow unless it is separately configured to use the production API.
