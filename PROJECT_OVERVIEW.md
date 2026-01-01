# 🎮 Gamers Spot - Complete Project Overview

## 📋 Table of Contents
1. [Project Summary](#project-summary)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema](#database-schema)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend API Architecture](#backend-api-architecture)
7. [Key Features](#key-features)
8. [Data Flow](#data-flow)
9. [Multi-Device Sync](#multi-device-sync)
10. [Timezone Management](#timezone-management)
11. [File Structure](#file-structure)
12. [Development Workflow](#development-workflow)

---

## 🎯 Project Summary

**Gamers Spot** is a comprehensive **PS5 Gaming Station Management System** designed for gaming cafes/zones. It manages multiple gaming stations (PS5, Steering Wheel, System Games), tracks time, calculates billing with dynamic pricing, generates invoices, manages snacks, and provides detailed reports.

### Core Purpose
- **Timer Management**: Track gaming sessions across multiple stations
- **Billing System**: Calculate costs based on time, game type, controllers, and snacks
- **Invoice Generation**: Create and download PDF invoices
- **Reports**: Usage reports, revenue reports, customer reports, snacks reports
- **Multi-Device Sync**: Real-time synchronization across multiple browsers/devices

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling framework
- **jsPDF** - PDF generation for invoices
- **html2canvas** - Canvas rendering for PDFs

### Backend
- **Node.js** - Runtime environment
- **Express.js** - API server framework
- **PostgreSQL** - Database (supports local, Supabase, Vercel)
- **pg** - PostgreSQL client for Node.js

### Deployment
- **Vercel** - Production hosting (serverless)
- **Supabase** - PostgreSQL database hosting
- **Docker** - Local development (optional)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Reports    │  │   Billing    │      │
│  │  (App.jsx)   │  │ (Reports.jsx)│  │(BillingPanel)│      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                │                  │              │
│           └────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  API Utils     │                        │
│                    │  (api.js)      │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    HTTP/REST API
                             │
┌────────────────────────────▼──────────────────────────────────┐
│                  BACKEND (Express.js)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Stations │  │ Invoices │  │  Snacks  │  │ Reports  │     │
│  │   API    │  │   API    │  │   API    │  │   API    │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘     │
│       └─────────────┴─────────────┴─────────────┘            │
│                            │                                  │
│                    ┌───────▼────────┐                         │
│                    │  DB Client     │                         │
│                    │  (db.js)       │                         │
│                    └───────┬────────┘                         │
└────────────────────────────┼───────────────────────────────────┘
                             │
                    PostgreSQL Protocol
                             │
┌────────────────────────────▼───────────────────────────────────┐
│                   DATABASE (PostgreSQL)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ stations │  │ invoices │  │  snacks  │  │customers │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│  ┌──────────────┐                                             │
│  │ paid_events  │  (Multi-device sync)                        │
│  └──────────────┘                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### 1. **stations** Table
Stores all gaming station information and current state.

```sql
CREATE TABLE stations (
  id INTEGER PRIMARY KEY,              -- Station ID (1-7 are default)
  name VARCHAR(255) NOT NULL,          -- Station name (e.g., "PS5 Station 1")
  game_type VARCHAR(50) NOT NULL,      -- 'playstation', 'steering_wheel', 'system'
  elapsed_time INTEGER DEFAULT 0,      -- Time in seconds
  is_running BOOLEAN DEFAULT false,    -- Timer running status
  is_done BOOLEAN DEFAULT false,       -- Session completed status
  extra_controllers INTEGER DEFAULT 0, -- Number of extra controllers
  snacks JSONB DEFAULT '{}',           -- Snacks consumed {snackId: quantity}
  snacks_enabled BOOLEAN DEFAULT false,-- Snacks feature enabled
  customer_name VARCHAR(255),          -- Customer name
  customer_phone VARCHAR(20),          -- Customer phone number
  start_time VARCHAR(50),              -- Session start time (IST)
  end_time VARCHAR(50),                -- Session end time (IST)
  created_at TIMESTAMPTZ,              -- Record creation time (IST)
  updated_at TIMESTAMPTZ               -- Last update time (IST)
);
```

### 2. **invoices** Table
Stores generated invoices for billing.

```sql
CREATE TABLE invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255) UNIQUE,  -- Unique invoice number
  stations JSONB NOT NULL,             -- Array of station data
  subtotal DECIMAL(10, 2),             -- Subtotal before discount
  discount DECIMAL(10, 2),             -- Discount amount
  total DECIMAL(10, 2),                -- Final total
  created_at TIMESTAMPTZ               -- Invoice creation time (IST)
);
```

### 3. **snacks** Table
Configurable snacks with prices.

```sql
CREATE TABLE snacks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE,            -- Snack name
  price DECIMAL(10, 2),                -- Price per unit
  active BOOLEAN DEFAULT true,         -- Active/inactive status
  display_order INTEGER,               -- Display order in UI
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 4. **customers** Table
Customer information for autocomplete and tracking.

```sql
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(20) UNIQUE,     -- Customer phone number
  customer_name VARCHAR(255),          -- Customer name
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### 5. **paid_events** Table
Multi-device synchronization for paid invoices.

```sql
CREATE TABLE paid_events (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(255),         -- Associated invoice
  station_ids INTEGER[],               -- Stations that were reset
  reset_data JSONB,                    -- Station reset state data
  created_at TIMESTAMPTZ,              -- Event creation time (IST)
  processed BOOLEAN DEFAULT false      -- Processing status
);
```

---

## 🎨 Frontend Architecture

### Main Components

#### 1. **App.jsx** (Main Application)
- **State Management**: Manages all stations, invoices, reports
- **Sidebar Navigation**: Dashboard, Pricing, Snacks, Reports
- **Dashboard Stats**: Active sessions, completed sessions, revenue
- **Multi-Device Sync**: Polls `paid_events` every 3 seconds
- **IST Time Display**: Shows current Indian Standard Time

**Key State Variables:**
```javascript
const [stations, setStations] = useState([])           // All stations
const [invoice, setInvoice] = useState(null)           // Current invoice
const [showPricingConfig, setShowPricingConfig] = useState(false)
const [showSnacksConfig, setShowSnacksConfig] = useState(false)
const [activeReport, setActiveReport] = useState(null) // Current report
const [snacksList, setSnacksList] = useState([])       // Available snacks
const [istTime, setIstTime] = useState('')             // IST time display
```

#### 2. **StationCard.jsx** (Individual Station)
- **Timer Management**: Start, Pause, Resume, Done, Reset
- **Real-time Updates**: Updates every second when running
- **Server Time Sync**: Syncs with server every 30 seconds
- **Pause Tracking**: Tracks paused duration for accurate billing
- **Customer Info**: Name and phone number input
- **Snacks Selection**: Dynamic snacks from database
- **Extra Controllers**: Add/remove extra controllers

**Key Functions:**
- `handleStart()` - Start timer and save to DB
- `handlePause()` - Pause timer and track pause time
- `handleResume()` - Resume from pause
- `handleDone()` - Mark session complete
- `handleReset()` - Reset station to initial state
- `calculateElapsedTime()` - Calculate accurate elapsed time

#### 3. **BillingPanel.jsx** (Billing & Invoice)
- **Session Selection**: Select completed sessions for billing
- **Cost Calculation**: Dynamic pricing based on game type, time, extras
- **Customer Lookup**: Phone number autocomplete
- **Discount**: Apply discount to total
- **Invoice Generation**: Create invoice and trigger PDF generation

**Pricing Logic:**
```javascript
// Dynamic pricing based on:
- Game Type (PS5, Steering Wheel, System)
- Day Type (Weekday, Weekend, Holiday)
- Time Played (with bonus time for paid hours)
- Extra Controllers
- Snacks consumed
```

#### 4. **InvoiceViewer.jsx** (Invoice Display & PDF)
- **Invoice Display**: Shows detailed invoice breakdown
- **PDF Generation**: Uses jsPDF and html2canvas
- **Payment Handling**: "Paid" button triggers station reset
- **Multi-Device Sync**: Creates paid_event for other browsers

#### 5. **Reports.jsx** (Reporting System)
- **Usage Report**: Station usage by date
- **Daily Revenue**: Revenue breakdown by date
- **Monthly Revenue**: Monthly revenue summary
- **Customer Report**: Customer visit history
- **Snacks Report**: Snacks sales analysis
- **Export**: Excel and PDF export functionality

#### 6. **PricingConfig.jsx** (Pricing Configuration)
- **Rate Management**: Configure rates for different game types
- **Day Types**: Weekday, Weekend, Holiday rates
- **Controller Rates**: Extra controller pricing
- **LocalStorage**: Stores pricing configuration

#### 7. **SnacksConfig.jsx** (Snacks Management)
- **CRUD Operations**: Create, Read, Update, Delete snacks
- **Active/Inactive**: Toggle snack availability
- **Display Order**: Reorder snacks
- **Database Sync**: All changes saved to database

### Utility Files

#### **api.js** - API Client
```javascript
// API endpoints for all backend operations
- stationsAPI: getAll, saveAll, update, delete
- invoicesAPI: getAll, getByNumber, create
- paidEventsAPI: create, getRecent
- snacksAPI: getAll, create, update, delete
- customersAPI: lookupByPhone, getAll, saveCustomer
- timeAPI: getServerTime
- reportsAPI: getUsageReport, getDailyRevenue, getMonthlyRevenue, etc.
```

#### **pricing.js** - Pricing Logic
```javascript
// Dynamic pricing calculations
- calculateCost(time, gameType, extraControllers, snacks)
- calculatePaidHours(time, gameType)
- getBonusTime(paidHours, gameType)
- getRate(gameType, dayType)
- getDayType(date) // Weekday, Weekend, Holiday
```

#### **timezone.js** - IST Time Management
```javascript
// All time operations use Indian Standard Time (Asia/Kolkata)
- getIndianTime() // Current IST Date object
- getIndianTimestamp() // IST timestamp in ms
- getIndianTimeISO() // ISO string in IST
- formatIndianDate() // Format IST date
- getIndianTimeString() // "HH:MM AM/PM" format
```

#### **storage.js** - Data Persistence
```javascript
// Load/save stations from/to database
- loadStations() // Fetch from API
- saveStations(stations) // Save to API
```

#### **alarm.js** - Audio Alerts
```javascript
// Audio notifications for timer events
- playAlarm() // Play alarm sound
- playWarning() // Play warning sound
```

---

## 🔌 Backend API Architecture

### Server Structure (server.js)
- **Express Server**: Runs on port 3001 (development)
- **CORS Enabled**: Allows frontend requests
- **Vercel Adapter**: Converts Vercel-style handlers to Express middleware
- **API Routes**: All routes prefixed with `/api`

### API Endpoints

#### **Stations API** (`/api/stations`)
```javascript
GET    /api/stations          // Get all stations
POST   /api/stations          // Save all stations (bulk)
PUT    /api/stations          // Update single station
DELETE /api/stations?id=:id   // Delete station
```

#### **Invoices API** (`/api/invoices`)
```javascript
GET    /api/invoices                        // Get all invoices
GET    /api/invoices?invoiceNumber=:number  // Get specific invoice
POST   /api/invoices                        // Create invoice
```

#### **Paid Events API** (`/api/paid-events`)
```javascript
GET    /api/paid-events?since=:timestamp    // Get recent paid events
POST   /api/paid-events                     // Create paid event
```

#### **Snacks API** (`/api/snacks`)
```javascript
GET    /api/snacks?active=true              // Get active snacks
POST   /api/snacks                          // Create snack
PUT    /api/snacks                          // Update snack
DELETE /api/snacks?id=:id&hardDelete=false  // Delete snack (soft/hard)
```

#### **Customers API** (`/api/customers`)
```javascript
GET    /api/customers?phoneNumber=:phone    // Lookup by phone
GET    /api/customers?getAll=true           // Get all customers
POST   /api/customers                       // Save customer
```

#### **Time API** (`/api/time`)
```javascript
GET    /api/time                            // Get server time (IST)
```

#### **Reports API** (`/api/reports`)
```javascript
GET    /api/reports?type=usage&date=:date
GET    /api/reports?type=daily-revenue&date=:date
GET    /api/reports?type=monthly-revenue&month=:month&year=:year
GET    /api/reports?type=customer-report
GET    /api/reports?type=snacks-report&date=:date
```

### Database Client (db.js)

**Environment Detection:**
- **Vercel**: Uses connection pooling with Supabase
- **Local**: Uses direct PostgreSQL connection

**Features:**
- Connection retry logic (3 attempts with exponential backoff)
- SSL configuration for Supabase
- Connection pooling for serverless
- Detailed error messages and logging
- Automatic connection string validation

---

## 🎯 Key Features

### 1. **Multi-Station Management**
- Default 7 stations (5 PS5, 1 Steering Wheel, 1 System)
- Add unlimited additional stations
- Each station tracks independently
- Real-time timer updates

### 2. **Dynamic Pricing System**
- **Game Types**: Different rates for PS5, Steering Wheel, System
- **Day Types**: Weekday, Weekend, Holiday pricing
- **Bonus Time**: Free time after paid hours (e.g., 15 min free per hour)
- **Extra Controllers**: Additional charges per controller
- **Snacks**: Configurable snacks with prices

### 3. **Session Management**
- **Start**: Begin gaming session with customer info
- **Pause/Resume**: Pause timer (doesn't count toward billing)
- **Done**: Mark session complete
- **Reset**: Clear session data
- **Elapsed Time Tracking**: Accurate time calculation using server time

### 4. **Billing & Invoicing**
- Select multiple completed sessions
- Apply discounts
- Generate PDF invoices
- Customer information on invoices
- Detailed cost breakdown

### 5. **Multi-Device Synchronization**
- **Paid Events Table**: Intermediate table for sync
- **Polling**: Frontend polls every 3 seconds
- **Automatic Reset**: Stations reset across all browsers when paid
- **Real-time Updates**: Changes propagate to all connected devices

### 6. **Comprehensive Reports**
- **Usage Report**: Station usage by date
- **Daily Revenue**: Revenue breakdown by date
- **Monthly Revenue**: Monthly summary with charts
- **Customer Report**: Customer visit history and spending
- **Snacks Report**: Snacks sales analysis
- **Export**: Excel and PDF export

### 7. **Customer Management**
- Phone number autocomplete
- Customer name lookup
- Visit history tracking
- Spending analytics

### 8. **Snacks Management**
- Add/edit/delete snacks
- Active/inactive status
- Display order customization
- Price management
- Usage tracking in reports

---

## 🔄 Data Flow

### 1. **Station Timer Flow**

```
User clicks "Start"
    ↓
StationCard.handleStart()
    ↓
Update local state (isRunning: true, startTime: IST time)
    ↓
stationsAPI.update(station) → PUT /api/stations
    ↓
Backend saves to PostgreSQL
    ↓
Every second: calculateElapsedTime() using server time
    ↓
Every 30 seconds: syncWithServerTime() for accuracy
    ↓
User clicks "Done"
    ↓
StationCard.handleDone()
    ↓
Update state (isDone: true, endTime: IST time)
    ↓
Save to database
    ↓
Station appears in "Completed Sessions"
```

### 2. **Billing & Invoice Flow**

```
User selects completed sessions in BillingPanel
    ↓
Enters customer info (phone autocompletes from DB)
    ↓
Applies discount (optional)
    ↓
Clicks "Generate Invoice"
    ↓
BillingPanel.handleGenerateInvoice()
    ↓
Calculate costs (time + controllers + snacks)
    ↓
invoicesAPI.create() → POST /api/invoices
    ↓
Backend saves invoice to database
    ↓
InvoiceViewer displays invoice
    ↓
User clicks "Paid"
    ↓
InvoiceViewer.onPaid() → App.handleInvoicePaid()
    ↓
Reset stations to initial state
    ↓
Save each station individually (PUT /api/stations)
    ↓
Create paid_event for multi-device sync
    ↓
paidEventsAPI.create() → POST /api/paid-events
    ↓
Other browsers poll and detect paid_event
    ↓
All browsers reset the same stations
```

### 3. **Multi-Device Sync Flow**

```
Browser A: User pays invoice
    ↓
App.handleInvoicePaid() resets stations
    ↓
Creates paid_event in database
    ↓
Browser B: Polling every 3 seconds
    ↓
paidEventsAPI.getRecent(since: lastCheckTime)
    ↓
Detects new paid_event
    ↓
Extracts station_ids and reset_data
    ↓
Resets same stations in Browser B
    ↓
Saves to database
    ↓
UI updates automatically
```

---

## 🔄 Multi-Device Sync

### How It Works

1. **Paid Events Table**: Acts as a message queue
2. **Polling**: Every browser polls every 3 seconds
3. **Timestamp Tracking**: Each browser tracks last check time
4. **Event Processing**: New events trigger station resets
5. **State Synchronization**: All browsers show same state

### Implementation Details

**Frontend (App.jsx):**
```javascript
// Poll every 3 seconds
useEffect(() => {
  const checkPaidEvents = async () => {
    const since = lastPaidEventCheckRef.current
    const events = await paidEventsAPI.getRecent(since)
    
    if (events.length > 0) {
      // Reset stations based on event data
      events.forEach(event => {
        resetStations(event.station_ids, event.reset_data)
      })
    }
    
    lastPaidEventCheckRef.current = Date.now()
  }
  
  const interval = setInterval(checkPaidEvents, 3000)
  return () => clearInterval(interval)
}, [])
```

**Backend (paid-events.js):**
```javascript
// Get events since timestamp
GET /api/paid-events?since=:timestamp
  → Returns events created after timestamp
  → Ordered by created_at DESC
  → Limited to last 100 events
```

---

## 🕐 Timezone Management

### Indian Standard Time (IST)

**All timestamps use IST (Asia/Kolkata) timezone:**
- Database: `SET timezone = 'Asia/Kolkata'`
- Backend: Server time API returns IST
- Frontend: All time utilities use IST

### Time Utilities (timezone.js)

```javascript
// Get current IST time
const istNow = getIndianTime()

// Get IST timestamp (milliseconds)
const timestamp = getIndianTimestamp()

// Format IST date
const formatted = formatIndianDate(date, options)

// Get IST time string "HH:MM AM/PM"
const timeString = getIndianTimeString(date)

// Get IST date string "YYYY-MM-DD"
const dateString = getIndianDateString(date)
```

### Server Time Sync

**Why?**
- Client clocks may be inaccurate
- Ensures consistent time across devices
- Accurate billing calculations

**How?**
```javascript
// Frontend syncs with server every 30 seconds
const serverTime = await timeAPI.getServerTime()
// Returns: { timestamp, timeString, dateString }

// Use server time for calculations
const elapsed = (serverTime.timestamp - startTime) / 1000
```

---

## 📁 File Structure

```
Gamersspot/
├── api/                          # Backend API handlers
│   ├── db.js                     # Database connection utility
│   ├── stations.js               # Stations CRUD API
│   ├── invoices.js               # Invoices API
│   ├── paid-events.js            # Multi-device sync API
│   ├── snacks.js                 # Snacks management API
│   ├── customers.js              # Customer lookup API
│   ├── time.js                   # Server time API
│   ├── reports.js                # Reports generation API
│   └── cleanup.js                # Database cleanup API
│
├── database/                     # SQL schemas and migrations
│   ├── schema.sql                # Main database schema
│   ├── paid_events_schema.sql    # Paid events table
│   ├── snacks_schema.sql         # Snacks table
│   ├── local_setup.sql           # Local development setup
│   └── [other migration files]
│
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── App.jsx               # Main application
│   │   ├── StationCard.jsx       # Individual station card
│   │   ├── BillingPanel.jsx      # Billing and invoice generation
│   │   ├── InvoiceViewer.jsx     # Invoice display and PDF
│   │   ├── Reports.jsx           # Reports dashboard
│   │   ├── PricingConfig.jsx     # Pricing configuration
│   │   ├── SnacksConfig.jsx      # Snacks management
│   │   ├── Logo.jsx              # Logo component
│   │   └── TimerDisplay.jsx      # Timer display component
│   │
│   ├── utils/                    # Utility functions
│   │   ├── api.js                # API client functions
│   │   ├── pricing.js            # Pricing calculations
│   │   ├── timezone.js           # IST time utilities
│   │   ├── storage.js            # Data persistence
│   │   ├── timer.js              # Timer formatting
│   │   ├── alarm.js              # Audio alerts
│   │   └── pdf.js                # PDF generation
│   │
│   ├── main.jsx                  # React entry point
│   └── index.css                 # Global styles
│
├── server.js                     # Local development server
├── package.json                  # Dependencies and scripts
├── vite.config.js                # Vite configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── vercel.json                   # Vercel deployment config
├── docker-compose.yml            # Docker setup (optional)
└── README.md                     # Project documentation
```

---

## 🚀 Development Workflow

### Local Development

1. **Install Dependencies**
```bash
npm install
```

2. **Setup Database**
```bash
# Option 1: Local PostgreSQL
# Run database/local_setup.sql in your PostgreSQL

# Option 2: Supabase
# Create project on Supabase
# Run database/schema.sql in SQL Editor
```

3. **Configure Environment**
```bash
# Create .env.local
POSTGRES_URL=postgresql://user:password@localhost:5432/gamersspot
# OR for Supabase
POSTGRES_URL=postgresql://postgres:[password]@[project].pooler.supabase.com:6543/postgres
```

4. **Run Development Servers**
```bash
# Run both frontend and backend
npm run dev:all

# OR run separately
npm run dev      # Frontend only (Vite)
npm run dev:api  # Backend only (Express)
```

5. **Access Application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

### Production Deployment (Vercel)

1. **Push to GitHub**
```bash
git push origin main
```

2. **Deploy to Vercel**
- Connect GitHub repository to Vercel
- Set environment variables:
  - `POSTGRES_URL`: Supabase pooled connection string
- Vercel auto-deploys on push

3. **Database Setup**
- Run all SQL files in Supabase SQL Editor:
  - `schema.sql`
  - `paid_events_schema.sql`
  - `snacks_schema.sql`

### Available Scripts

```json
{
  "dev": "vite",                    // Frontend dev server
  "dev:api": "node server.js",      // Backend dev server
  "dev:all": "concurrently ...",    // Both servers
  "build": "vite build",            // Production build
  "preview": "vite preview"         // Preview production build
}
```

---

## 🎯 Key Concepts to Understand

### 1. **State Management**
- React useState for local state
- No Redux/Context (simple prop drilling)
- Database as source of truth
- Optimistic UI updates with DB sync

### 2. **Real-time Updates**
- Timer updates every second (local calculation)
- Server time sync every 30 seconds (accuracy)
- Paid events polling every 3 seconds (multi-device)
- Individual station saves (PUT requests)

### 3. **Pricing System**
- Dynamic rates based on game type and day type
- Bonus time calculation (free time after paid hours)
- Extra controller charges
- Snacks from database (configurable)

### 4. **Database Design**
- Stations: Current state of all gaming stations
- Invoices: Historical billing records
- Paid Events: Multi-device sync mechanism
- Snacks: Configurable products
- Customers: Autocomplete and analytics

### 5. **Time Handling**
- All times in IST (Asia/Kolkata)
- Server time as source of truth
- Pause time tracking (excluded from billing)
- Start/end time stored as strings (display format)

---

## 🔧 Common Operations

### Adding a New Station
```javascript
// Frontend: App.jsx
handleAddStation(GAME_TYPES.PLAYSTATION)
  → Creates new station with unique ID
  → Saves to database
  → Appears in dashboard
```

### Starting a Session
```javascript
// Frontend: StationCard.jsx
handleStart()
  → Set isRunning: true
  → Set startTime: current IST time
  → Save to database (PUT /api/stations)
  → Start timer interval
```

### Generating Invoice
```javascript
// Frontend: BillingPanel.jsx
handleGenerateInvoice()
  → Calculate costs for selected stations
  → Apply discount
  → Create invoice in database
  → Show InvoiceViewer
```

### Paying Invoice
```javascript
// Frontend: InvoiceViewer.jsx → App.jsx
handleInvoicePaid()
  → Reset all stations in invoice
  → Save each station (PUT /api/stations)
  → Create paid_event for sync
  → Close invoice viewer
```

### Viewing Reports
```javascript
// Frontend: Reports.jsx
setActiveReport('daily-revenue')
  → Fetch report data from API
  → Display charts and tables
  → Export to Excel/PDF
```

---

## 📊 Data Models

### Station Object
```javascript
{
  id: 1,
  name: "PS5 Station 1",
  gameType: "playstation",
  elapsedTime: 3600,              // seconds
  isRunning: false,
  isDone: true,
  extraControllers: 1,
  snacks: { "1": 2, "2": 1 },     // snackId: quantity
  snacksEnabled: true,
  customerName: "John Doe",
  customerPhone: "9876543210",
  startTime: "02:30 PM",
  endTime: "03:30 PM",
  pausedAt: null,
  totalPausedTime: 0
}
```

### Invoice Object
```javascript
{
  invoiceNumber: "INV-1701234567890",
  stations: [/* array of station objects */],
  subtotal: 150.00,
  discount: 10.00,
  total: 140.00,
  date: "2024-12-03T14:30:00+05:30"
}
```

### Paid Event Object
```javascript
{
  id: 1,
  invoice_number: "INV-1701234567890",
  station_ids: [1, 2, 3],
  reset_data: [/* array of reset station states */],
  created_at: "2024-12-03T14:30:00+05:30",
  processed: false
}
```

---

## 🎓 Learning Path for New Developers

1. **Start with Frontend**
   - Understand App.jsx structure
   - Study StationCard.jsx timer logic
   - Review BillingPanel.jsx pricing

2. **Explore Backend**
   - Check server.js setup
   - Review api/stations.js CRUD operations
   - Understand db.js connection handling

3. **Database Schema**
   - Study schema.sql tables
   - Understand relationships
   - Review indexes and triggers

4. **Key Features**
   - Multi-device sync (paid_events)
   - Pricing calculations (pricing.js)
   - Time management (timezone.js)

5. **Reports System**
   - Study Reports.jsx component
   - Review api/reports.js queries
   - Understand data aggregation

---

## 🐛 Common Issues & Solutions

### Issue: Timer not updating
**Solution**: Check if `isRunning` is true and interval is set

### Issue: Multi-device sync not working
**Solution**: Verify paid_events table exists and polling is active

### Issue: Database connection timeout
**Solution**: Check if Supabase project is active (not paused)

### Issue: Pricing calculation wrong
**Solution**: Verify pricing config in localStorage and bonus time logic

### Issue: Invoice PDF not generating
**Solution**: Check jsPDF and html2canvas dependencies

---

## 📝 Next Steps for Development

### Potential Enhancements
1. **Authentication**: Add user login and roles
2. **Notifications**: Push notifications for timer alerts
3. **Analytics**: Advanced analytics dashboard
4. **Mobile App**: React Native mobile version
5. **Payment Integration**: Online payment gateway
6. **Inventory**: Track controller and equipment inventory
7. **Booking**: Advance booking system
8. **Loyalty**: Customer loyalty program

---

## 📚 Additional Resources

- **React Documentation**: https://react.dev
- **Vite Documentation**: https://vitejs.dev
- **TailwindCSS**: https://tailwindcss.com
- **PostgreSQL**: https://www.postgresql.org/docs
- **Supabase**: https://supabase.com/docs
- **Vercel**: https://vercel.com/docs

---

**Created**: December 3, 2024  
**Last Updated**: December 3, 2024  
**Version**: 1.0.0  
**Author**: Gamers Spot Development Team


