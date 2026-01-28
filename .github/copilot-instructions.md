# AI Coding Agent Guide for AllMedical

## Scope
- **Stack:** React (Vite), React Native (Expo), Tailwind CSS, Supabase (auth/storage/data), Node.js + npm, Git/GitHub, Azure.
- **Goal:** Deliver complete, runnable code with minimal dependencies and clear setup steps.

## Defaults & Conventions
- **Components:** Functional components with hooks; async/await for data flows.
- **State:** Prefer local React state/hooks; introduce libraries only on request.
- **Styling:** Tailwind utility-first; configure via PostCSS and Tailwind config.
- **Supabase:** Use environment variables; centralize client init.
- **Structure (when adding apps):** Keep web and mobile code in separate app folders; confirm naming with the user if unclear.

## Web (React + Vite + Tailwind)
- **Bootstrap:**
  ```bash
  npm create vite@latest web -- --template react
  cd web
  npm install
  npm install -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p
  ```
- **Tailwind config:** Add `./index.html` and `./src/**/*.{js,jsx}` to `content` in `tailwind.config.js`; include `@tailwind base; @tailwind components; @tailwind utilities;` in `src/index.css`.
- **Supabase client:** Create `src/lib/supabaseClient.js` with `createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)`.
- **Env:** Use `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; also provide `.env.example`.
- **Run:** `npm run dev`; **Build:** `npm run build`.

## Mobile (React Native + Expo)
- **Bootstrap:**
  ```bash
  npx create-expo-app mobile
  cd mobile
  npm install @supabase/supabase-js
  ```
- **Supabase client:** Create `src/lib/supabaseClient.js` and load `SUPABASE_URL` and `SUPABASE_ANON_KEY` via Expo config or `expo-constants`.
- **Run:** `npx expo start`.

## Supabase
- **Env variables:** `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Expo); `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Vite).
- **Patterns:** Central client file; call RPCs or table ops via the client; handle auth state with hooks.

## Deliverables
- **Always include:** folder scaffolding, key source files, `.env.example`, install/run/build commands.
- **Minimal deps:** Avoid adding libraries beyond the stack unless requested.

## Azure Deployment
- **Approach:** Prepare deployment scripts/config after the app exists; confirm target (static web app, container, functions) with the user before generating.

## Notes for Ambiguity
- **Confirm structure:** If the repo is empty (as now), propose `web/` and `mobile/` app folders and ask for confirmation.
- **Ask early:** For naming, auth flows, and deployment targets when unclear.
