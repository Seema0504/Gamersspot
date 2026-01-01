# PS Game Timer

<!-- Test deployment: Trigger Vercel deployment from Test branch -->

A React-based application for managing PS5 gaming station timers with billing and invoice generation.

## Features

- ⏱️ Multiple station timer management
- ⚠️ Warning alerts when time is running low
- 🔔 Audio alarm when timer ends
- 💾 LocalStorage persistence
- 💰 Billing system with cost calculation
- 📄 PDF invoice generation
- 🎨 Modern UI with TailwindCSS

## Tech Stack

- React 18
- Vite
- TailwindCSS
- jsPDF
- html2canvas
- LocalStorage

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview

```bash
npm run preview
```

## Deployment

### Deploy to Vercel

**Option 1: Via Vercel Dashboard (Easiest)**
1. Push your code to GitHub/GitLab/Bitbucket
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "Add New Project" → Import your repository
4. Vercel will auto-detect Vite settings
5. Click "Deploy"

**Option 2: Via Vercel CLI**
```bash
npm install -g vercel
vercel login
vercel --prod
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Usage

1. Add gaming stations (PS5, Steering Wheel, System)
2. Set timer duration in minutes
3. Start/pause/reset timers
4. Generate invoices for completed sessions
5. Download invoices as PDF

## Project Structure

```
src/
 ├── App.jsx              # Main application component
 ├── main.jsx             # Entry point
 ├── index.css            # Global styles
 ├── components/          # React components
 │   ├── StationCard.jsx
 │   ├── TimerDisplay.jsx
 │   ├── BillingPanel.jsx
 │   └── InvoiceViewer.jsx
 └── utils/               # Utility functions
     ├── storage.js       # LocalStorage helpers
     ├── timer.js         # Time formatting/calculation
     ├── pdf.js           # PDF generation
     └── alarm.js         # Audio alarm
```

