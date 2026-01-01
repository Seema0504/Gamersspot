# 🎮 Gamers Spot - Quick Reference Guide

## 📌 Project At A Glance

**Name:** Gamers Spot  
**Type:** Gaming Station Management System  
**Purpose:** Manage gaming cafe operations with automated timing, billing, and reporting  
**Tech Stack:** React + Vite + PostgreSQL + Express + Vercel

---

## 🚀 Quick Start

### Run Locally
```bash
npm run dev:all  # Starts both frontend (5173) and backend (3001)
```

### Access
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api

---

## 🗂️ Project Structure

```
Gamersspot/
├── src/                    # Frontend (React)
│   ├── App.jsx            # Main application
│   ├── components/        # UI components
│   └── utils/             # Helper functions
├── api/                   # Backend (Express serverless)
│   ├── stations.js        # Station CRUD
│   ├── invoices.js        # Invoice management
│   ├── settings.js        # Pricing/snacks/bonus
│   └── reports.js         # Analytics
├── database/              # SQL schemas
└── server.js              # Local dev server

```

---

## 💾 Database Tables

| Table | Purpose |
|-------|---------|
| `stations` | Current state of all gaming stations |
| `invoices` | Billing history |
| `snacks` | Configurable items with prices |
| `customers` | Customer phone/name lookup |
| `paid_events` | Multi-device synchronization |
| `settings` | Pricing & bonus configuration |

---

## 🔄 Core Workflows

### 1. Start Session
```
Click "Start" → Timer begins → Saves to DB → Updates every second
```

### 2. Complete Session
```
Click "Done" → Timer stops → Appears in "Completed Sessions"
```

### 3. Generate Invoice
```
Select sessions → Enter customer → Apply discount → Generate → Download PDF
```

### 4. Pay Invoice
```
Click "Paid" → Resets stations → Syncs to all browsers
```

---

## 🎯 Key Features

✅ **Multi-station management** (7 default, unlimited custom)  
✅ **Real-time timer tracking** with server sync  
✅ **Dynamic pricing** (weekday/weekend, bonus time)  
✅ **PDF invoice generation**  
✅ **Multi-device synchronization** (3-second polling)  
✅ **Comprehensive reports** (usage, revenue, customers, snacks)  
✅ **Customer database** with autocomplete  
✅ **Configurable snacks** and extras  

---

## 📡 API Endpoints Quick Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/stations` | GET | Fetch all stations |
| `/api/stations` | PUT | Update single station |
| `/api/invoices` | POST | Create invoice |
| `/api/paid-events` | GET | Fetch sync events |
| `/api/settings?type=pricing` | GET | Get pricing config |
| `/api/settings?type=snacks` | GET | Get snacks list |
| `/api/customers` | GET | Lookup customer |
| `/api/reports?type=daily-revenue` | GET | Daily revenue report |
| `/api/time` | GET | Server time (IST) |

---

## 💰 Pricing Calculation

```
Base Cost = Paid Hours × Rate (weekday/weekend)
+ Extra Controllers × ₹50
+ Snacks (from database)
- Bonus Time (15/30/60 min based on hours played)
= Total Cost
```

**Bonus Tiers:**
- 1 hour → 15 min free
- 2 hours → 30 min free
- 3+ hours → 60 min free

---

## 🔧 Environment Variables

### Local (.env.local)
```env
POSTGRES_URL=postgresql://postgres:postgres@localhost:5434/gamersspot-local
```

### Vercel Production
```env
POSTGRES_URL=<supabase-production-url>
```

### Vercel Preview
```env
TEST_POSTGRES_URL=<supabase-test-url>
```

---

## 🎨 Component Breakdown

### App.jsx
- Main application container
- Manages global state (stations, invoices, snacks)
- Handles multi-device sync polling
- IST time display

### StationCard.jsx
- Individual station timer
- Start/Pause/Resume/Done/Reset controls
- Customer info input
- Snacks selection
- Server time synchronization

### BillingPanel.jsx
- Select completed sessions
- Customer lookup (phone autocomplete)
- Cost calculation
- Discount application
- Invoice generation

### InvoiceViewer.jsx
- Display invoice details
- PDF generation (jsPDF + html2canvas)
- "Paid" button triggers station reset

### Reports.jsx
- Multiple report types
- Date/month filters
- Excel/PDF export
- Charts and graphs

---

## 🔄 Multi-Device Sync

**How it works:**
1. Browser A pays invoice → Creates `paid_event` in database
2. Browser B polls every 3 seconds → Detects new event
3. Browser B reads station IDs → Resets same stations
4. All browsers stay synchronized

**Polling:** `GET /api/paid-events?since=<timestamp>` every 3 seconds

---

## 📊 Reports Available

1. **Usage Report** - Station usage by date
2. **Daily Revenue** - Revenue breakdown by date
3. **Monthly Revenue** - Monthly summary with charts
4. **Customer Report** - Customer visit history
5. **Snacks Report** - Snacks sales analysis

All reports exportable to **Excel** and **PDF**.

---

## 🚀 Deployment

### Vercel (Production)
```bash
git push origin main  # Auto-deploys to Vercel
```

### Environment Setup
1. Connect GitHub repo to Vercel
2. Set `POSTGRES_URL` in Vercel environment variables
3. Run database schema in Supabase SQL editor
4. Deploy!

---

## 🛠️ Common Tasks

### Add New Station
```javascript
Click "Add Station" → Select game type → Station created
```

### Configure Pricing
```javascript
Sidebar → Pricing → Edit rates → Save
```

### Manage Snacks
```javascript
Sidebar → Snacks → Add/Edit/Delete → Save
```

### View Reports
```javascript
Sidebar → Reports → Select type → Choose date → View/Export
```

### Transfer Session
```javascript
Sidebar → Transfer → Select from/to stations → Transfer
```

---

## 🔐 Authentication

Default password stored in environment variable:
```env
APP_PASSWORD=your-password-here
```

Change password via: **Sidebar → Change Password**

---

## 📝 Database Maintenance

### Cleanup Old Events
```sql
SELECT cleanup_old_paid_events();  -- Removes events older than 24 hours
```

### View Active Sessions
```sql
SELECT * FROM stations WHERE is_running = true;
```

### Today's Revenue
```sql
SELECT SUM(total) FROM invoices 
WHERE DATE(created_at) = CURRENT_DATE;
```

---

## 🎯 Business Logic

### Timer Accuracy
- **Client-side:** Updates every second
- **Server sync:** Every 30 seconds
- **Pause tracking:** Excluded from billing
- **Timezone:** All times in IST (Asia/Kolkata)

### Billing Buffer
- **With bonus:** 5-minute buffer (fixed)
- **Without bonus:** 10-minute buffer (configurable)
- **Purpose:** Prevent charging for small overages

---

## 📞 Troubleshooting

### Timers not updating?
- Check browser console for errors
- Verify API connection (Network tab)
- Ensure database is accessible

### Multi-device sync not working?
- Check `paid_events` table for new entries
- Verify polling is active (check Network tab)
- Ensure all browsers have same database connection

### Invoice PDF not generating?
- Check browser console for jsPDF errors
- Ensure html2canvas is loaded
- Try different browser

---

## 📚 Documentation Files

- `COMPREHENSIVE_PROJECT_DOCUMENTATION_2025-12-30.md` - Full technical documentation
- `PROJECT_OVERVIEW.md` - Architecture and features overview
- `PROJECT_DOCUMENTATION_2025-12-29.txt` - Detailed project info
- `README.md` - Basic setup instructions

---

**For detailed information, refer to:** `COMPREHENSIVE_PROJECT_DOCUMENTATION_2025-12-30.md`

*Last Updated: December 30, 2025*
