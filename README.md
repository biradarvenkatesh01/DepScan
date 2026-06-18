# DepScan - Open-Source Dependency Vulnerability Tracker

DepScan is a state-of-the-art, interactive dependency scanner and vulnerability tracker that integrates with the Google OSV database to identify CVE security alerts in Node.js and Python projects. 

Designed with a premium **cyber-obsidian glassmorphic interface**, it features an animated hacking-terminal log scanner, dynamic SVG chart metrics, an interactive dependency tree explorer, and a single-click copy-remediation center.

---

## 🚀 Key Features

* **Dual-Ecosystem Parser**: Directly parses Node.js manifests (`package.json`, `package-lock.json`) and Python requirements (`requirements.txt`), recursively resolving nested transitive dependencies.
* **Google OSV API Integration**: Batch queries the official Google OSV vulnerability catalog in chunks of 500 for high-performance security checks.
* **Animated Scan Terminal**: Replaces generic loaders with a mock hacking terminal that outputs real-time log traces of package parsing, transitive resolution, and CVE detections.
* **Tabbed Security Dashboard**:
  1. **Overview Panel**: Displays glowing metric cards, interactive SVG donut severity charts, and filters.
  2. **Dependency Map Tree**: A visual nested layout mapping direct libraries to nested child CVE advisories.
  3. **Remediation Action Center**: An upgrade desk generating copy-paste CLI terminal shortcuts (`npm install` / `pip install`) to remediate vulnerabilities.
* **Slide-Out Details Drawer**: Transitioning from the right, this panel details CVSS scores, advisory summaries, and verified external reference links.
* **Executive PDF Audits**: Generates professional, download-ready PDF reports including an executive overview and cover sheet.

---

## 🛠️ Technology Stack

### Frontend
* **Core**: React 19, TypeScript, Vite
* **Styling**: Vanilla HSL CSS Variables, Glassmorphism, animations
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
    │   │   ├── Dashboard.tsx # Metrics, SVGs, Tree map, Action Center, Drawer
    │   │   ├── Dropzone.tsx  # Upload interface with pre-loaded manifest tests
    │   │   └── ScanningTerminal.tsx # Simulated log streamer component
    │   ├── App.tsx           # Layout wrapper and entry nebulae animations
    │   └── index.css         # Cyber-obsidian theme & styling system
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
