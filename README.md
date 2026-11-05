# DepScan - Open-Source Dependency Vulnerability Tracker

DepScan scans Node.js and Python manifests for known vulnerabilities. It resolves the full dependency tree, checks every package version against the Google OSV database, and turns the result into a clear upgrade plan.

The interface is a warm, editorial layout: cream paper in light mode and warm charcoal in dark mode, with hairline rules, square corners and spec-sheet labels. It follows your system setting until you pick a mode with the sun/moon toggle. Type is set in Hanken Grotesk, with JetBrains Mono for labels, figures and code.

---

## Key Features

* **Four ways to scan**: drop a file, paste manifest contents (the format is detected automatically), point at a public GitHub repo or folder (`owner/repo` or a `github.com/.../tree/branch/path` link), or check a single npm/PyPI package by name and version.
* **Full tree resolution**: parses `package.json`, `package-lock.json` (v1–v3) and `requirements.txt`, and resolves transitive dependencies up to three levels. Each package records whether it is direct and which parent pulled it in; for lockfiles that comes from a breadth-first walk using Node's own `node_modules` lookup rules.
* **Real advisory data**: batch-queries OSV, then fetches each advisory's full record for its CVSS vector (scored with the CVSS 3.x formula), summary, aliases and fixed versions. Fix versions come from the affected range that contains your installed version.
* **Health grade**: an A–F grade and 0–100 health score with a severity distribution.
* **Report views**:
  1. **Overview**: the most urgent advisories, the most exposed packages, and the direct/transitive mix.
  2. **Packages**: searchable, sortable table with severity filters and a direct-only toggle (press `/` to search).
  3. **Tree**: collapsible dependency tree that can narrow to only the paths leading to vulnerable packages, with a count of vulnerable packages below each node.
  4. **Advisories**: every CVE/GHSA, filterable by severity and fix availability, sortable by score or date.
  5. **Fix plan**: one upgrade per package to the lowest version that clears every fixable advisory, merged into a single copyable `npm install` / `pip install` command. Major-version jumps are flagged, and unpatched advisories get their own list.
* **Patched manifest download**: get your `package.json` or `requirements.txt` back with the selected fixes applied. Range style (`^`, `~`, `==`), indentation, extras and comments are preserved; transitive npm fixes go into `overrides`, and transitive Python fixes are appended as pins.
* **Since last scan**: rescanning the same project shows new and resolved advisories and version changes compared with the previous scan.
* **Ignore advisories**: mark one as *Not reachable*, *Dev only*, *Accepted risk* or *False positive*. Ignored advisories drop out of the grade, counts and exports, and can be restored at any time.
* **Detail sheet**: per-package advisories with a CVSS bar, an "introduced via" path, an upgrade command, and OSV/reference links.
* **Exports**: PDF report, JSON, CSV, a Markdown summary for a PR or Slack, or a shields.io README badge showing the grade.
* **Recent scans**: the last eight scans are kept in your browser (localStorage only).

---

## 🛠️ Technology Stack

### Frontend
* **Core**: React 19, TypeScript, Vite
* **Styling**: Vanilla CSS with light/dark design tokens; Hanken Grotesk + JetBrains Mono (Google Fonts); no UI framework
* **APIs**: Axios (multipart/form-data & binary downloads)

### Backend
* **Core**: Node.js, Express, Multer (in-memory file buffers to prevent disk leakage)
* **Engine**: Axios (batch OSV query), PDFKit (PDF generation), Semver (dependency range calculations)

---

## 📦 Project Directory Structure

```text
DepScan/
├── backend/                  # Express REST API Server
│   ├── parser.js             # package.json & requirements.txt parser
│   ├── scanner.js            # Batch queries OSV database
│   ├── pdfGenerator.js       # Generates PDF report with PDFKit
│   └── server.js             # Server routing and Multer upload handling
│
└── frontend/                 # React SPA Client
    ├── src/
    │   ├── components/
    │   │   ├── Landing.tsx, Composer.tsx   # Hero, upload / paste / single-package input, history
    │   │   ├── ScanProgress.tsx            # Scan progress steps
    │   │   ├── Dashboard.tsx               # Report header, grade, severity summary, tabs
    │   │   └── report/                     # Overview, Packages, Advisories, Fix plan, detail sheet
    │   ├── lib/                            # Grading, fix plan, exports, storage, toasts
    │   ├── App.tsx                         # Layout, palette picker, scan flow
    │   └── index.css                       # Design tokens and component styles
    └── index.html            # App viewport mount
```

---

## ⚡ Setup & Installation

Ensure you have [Node.js](https://nodejs.org/) installed.

### 1. Run the Backend API
Navigate to the `backend/` directory, install packages, and start the hot-reloading dev server:
```bash
cd backend
npm install
npm run dev
```
The API server will run on [http://localhost:5000](http://localhost:5000).

### 2. Run the Frontend Client
Open a new terminal window, navigate to the `frontend/` directory, install packages, and start Vite:
```bash
cd frontend
npm install
npm run dev
```
The development server will run on [http://localhost:5173/](http://localhost:5173/).

---

## 🚀 Deployment

The frontend and backend are deployed separately: Vercel runs the Express API, and Netlify serves the static React app. Every scan and PDF export goes through the API, so the frontend does nothing useful without it.

### 1. Deploy the backend to Vercel

1. In Vercel, choose **Add New → Project** and import this repository.
2. Set **Root Directory** to `backend`. Vercel detects Express automatically; leave the build settings as they are.
3. Deploy, then check that `https://<your-backend-url>/api/health` returns `{"status":"healthy",...}`.

`server.js` exports the Express app for Vercel and only calls `app.listen()` when it is not running on Vercel, so the same code still works with `npm run dev` locally or on any other Node host (Render, Railway, Fly.io). CORS is open to all origins, so the Netlify site can call it without extra configuration.

> Vercel limits request bodies to 4.5 MB, slightly below the 5 MB upload limit the API sets, so very large lockfiles may be rejected.

### 2. Deploy the frontend to Netlify

`netlify.toml` already configures the build (base `frontend`, `npm run build`, publish `dist`, Node 22), so import the repository into Netlify and keep the detected settings.

Then point it at the API:

1. In Netlify, go to **Site configuration → Environment variables**.
2. Add `VITE_API_URL` with your backend URL, e.g. `https://depscan-api.vercel.app` (no trailing slash, no `/api`).
3. Trigger a new deploy (**Deploys → Trigger deploy → Deploy site**).

`VITE_API_URL` is baked into the bundle at build time, so you must redeploy after setting or changing it. If it is missing, the site falls back to `http://localhost:5000` and scans fail with "Couldn't reach the scanner".
