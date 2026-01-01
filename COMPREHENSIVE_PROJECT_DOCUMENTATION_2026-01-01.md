# 🎮 Gamers Spot - Comprehensive Project Documentation
**Generated:** January 2, 2026  
**Version:** 2.5  
**Project Type:** Gaming Station Management System

---

## 📑 Table of Contents
1. [Project Overview](#project-overview)
2. [Business Context](#business-context)
3. [Technical Stack](#technical-stack)
4. [System Architecture](#system-architecture)
5. [Database Schema & Mappings](#database-schema--mappings)
6. [Application Flow](#application-flow)
7. [Frontend Architecture](#frontend-architecture)
8. [Backend Architecture](#backend-architecture)
9. [Key Features](#key-features)
10. [API Endpoints](#api-endpoints)
11. [Data Flow Diagrams](#data-flow-diagrams)
12. [Deployment Architecture](#deployment-architecture)
13. [Environment Configuration](#environment-configuration)
14. [Development Workflow](#development-workflow)
15. [Version History & Changelog](#version-history--changelog)

---

## 🎯 Project Overview

### What is Gamers Spot?
**Gamers Spot** is a comprehensive **Gaming Station Management System** designed specifically for gaming cafes and gaming zones. It provides real-time session tracking, dynamic pricing, billing, invoicing, and comprehensive reporting capabilities.

### Core Purpose
The application solves the operational challenges of running a gaming cafe by:
- **Tracking** multiple gaming sessions simultaneously across different station types
- **Calculating** costs dynamically based on time, game type, day of week, and extras
- **Generating** professional PDF invoices with detailed breakdowns
- **Synchronizing** data across multiple devices/browsers in real-time
- **Reporting** on usage patterns, revenue, customer behavior, and inventory

### Target Users
- Gaming cafe owners and operators
- Gaming zone managers
- Staff members managing gaming stations
- Billing/cashier personnel

### Business Value
- **Eliminates manual time tracking** - Automated timer management
- **Prevents revenue loss** - Accurate billing with bonus time calculations
- **Improves customer experience** - Fast invoice generation and professional receipts
- **Enables data-driven decisions** - Comprehensive reports and analytics
- **Supports multi-device operations** - Real-time sync across all terminals

---

## 💼 Business Context

### Problem Statement
Gaming cafes face several operational challenges:
1. **Manual time tracking** is error-prone and leads to disputes
2. **Complex pricing** (weekday/weekend, different game types, bonuses) is hard to calculate manually
3. **Multiple stations** running simultaneously require constant monitoring
4. **Revenue tracking** and reporting is time-consuming without automation
5. **Multi-device coordination** when multiple staff members are working

### Solution Approach
Gamers Spot provides:
- **Automated timer management** with server-time synchronization
- **Dynamic pricing engine** with configurable rates and bonus time
- **Real-time multi-device sync** using database polling
- **Professional invoicing** with PDF generation
- **Comprehensive analytics** with multiple report types

### Business Model
The system supports:
- **Zero-config start** (Start with empty database, create stations as needed)
- **Unlimited additional stations** can be added
- **Configurable pricing** for different game types and day types
- **Snacks/extras management** with inventory tracking
- **Customer database** for repeat business tracking

---

## 🛠️ Technical Stack

### Frontend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI framework for component-based architecture |
| **Vite** | 5.0.8 | Build tool and development server (fast HMR) |
| **TailwindCSS** | 3.4.0 | Utility-first CSS framework for styling |
| **jsPDF** | 2.5.1 | PDF generation for invoices |
| **html2canvas** | 1.4.1 | Canvas rendering for PDF content |
| **XLSX** | 0.18.5 | Excel export for reports |

### Backend Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | JavaScript runtime environment |
| **Express.js** | 5.1.0 | Web application framework |
| **PostgreSQL** | 14+ | Relational database (ACID compliant) |
| **pg** | 8.16.3 | PostgreSQL client for Node.js |
| **dotenv** | 17.2.3 | Environment variable management |
| **CORS** | 2.8.5 | Cross-origin resource sharing |
| **WebSocket (ws)** | 8.18.3 | Real-time communication (optional) |

### Development Tools
| Tool | Purpose |
|------|---------|
| **Concurrently** | Run frontend and backend simultaneously |
| **PostCSS** | CSS processing and optimization |
| **Autoprefixer** | Automatic vendor prefixing for CSS |

### Deployment & Hosting
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend and serverless API hosting |
| **Supabase** | PostgreSQL database hosting (production) |
| **Docker** | Local development database (optional) |

---

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Browser)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   React UI   │  │  Timer Logic │  │ PDF Generator│          │
│  │  (App.jsx)   │  │(StationCard) │  │(InvoiceView) │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
│                   ┌───────▼────────┐                             │
│                   │   API Client   │                             │
│                   │   (api.js)     │                             │
│                   └───────┬────────┘                             │
140: └───────────────────────────┼──────────────────────────────────────┘
                            │
                   HTTP/REST (JSON)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                  APPLICATION LAYER (Express)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Stations │  │ Invoices │  │  Snacks  │  │ Reports  │        │
│  │   API    │  │   API    │  │   API    │  │   API    │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │              │             │               │
│       └─────────────┴──────────────┴─────────────┘               │
│                           │                                      │
│                   ┌───────▼────────┐                             │
│                   │  DB Client     │                             │
│                   │  (db.js)       │                             │
│                   │  - Connection  │                             │
│                   │  - Pooling     │                             │
│                   │  - Retry Logic │                             │
│                   └───────┬────────┘                             │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                   PostgreSQL Protocol
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                   DATA LAYER (PostgreSQL)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ stations │  │ invoices │  │  snacks  │  │customers │        │
│  │          │  │          │  │          │  │          │        │
│  │ - State  │  │ - Bills  │  │ - Items  │  │ - Phone  │        │
│  │ - Timers │  │ - Totals │  │ - Prices │  │ - Names  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │ paid_events  │  │ pricing_rules│  │  bonus_config  │         │
│  │              │  │              │  │                │         │
│  │ - Sync Data  │  │ - Base Rates │  │ - Bonus Logic  │         │
│  │ - Reset Info │  │              │  │                │         │
│  └──────────────┘  └──────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action (Start Timer)
    ↓
StationCard Component
    ↓
Update Local State (Optimistic)
    ↓
API Call (stationsAPI.update)
    ↓
Express Route Handler (/api/stations PUT)
    ↓
Database Client (db.js)
    ↓
PostgreSQL (UPDATE stations)
    ↓
Response to Client
    ↓
UI Update (Confirmed)
```

---

## 🗄️ Database Schema & Mappings

### Database: PostgreSQL (UTC Storage)
All timestamps are stored in **UTC** and dynamically converted to **Indian Standard Time (Asia/Kolkata)** for reporting and display to ensure accuracy across day boundaries.

### Table 1: `stations`
**Purpose:** Stores current state of all gaming stations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | COMPOSITE PK | Station Slot ID (1, 2, 3...) |
| `shop_id` | UUID | COMPOSITE PK | Shop Identifier |
| `name` | VARCHAR(255) | NOT NULL | Station display name (e.g., "PS5 Station 1") |
| `game_type` | VARCHAR(50) | NOT NULL | Game type: 'Playstation', 'Steering Wheel', 'System' |
| `elapsed_time` | INTEGER | DEFAULT 0 | Elapsed time in seconds |
| `is_running` | BOOLEAN | DEFAULT false | Timer running status |
| `is_done` | BOOLEAN | DEFAULT false | Session completed flag |
| `is_paused` | BOOLEAN | DEFAULT false | Timer paused status |
| `paused_time` | INTEGER | DEFAULT 0 | Total paused duration in seconds |
| `pause_start_time` | VARCHAR(50) | NULL | Timestamp when pause started |
| `extra_controllers` | INTEGER | DEFAULT 0 | Number of extra controllers |
| `snacks` | JSONB | DEFAULT '{}' | Snacks consumed: `{snackId: quantity}` |
| `snacks_enabled` | BOOLEAN | DEFAULT false | Snacks feature enabled for station |
| `customer_name` | VARCHAR(255) | NULL | Customer name |
| `customer_phone` | VARCHAR(20) | NULL | Customer phone number |
| `start_time` | VARCHAR(50) | NULL | Session start time (IST string) |
| `end_time` | VARCHAR(50) | NULL | Session end time (IST string) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp (UTC) |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp (UTC) |

**Indexes:**
- `idx_stations_is_done` on `is_done`
- `idx_stations_game_type` on `game_type`

**Triggers:**
- `update_stations_updated_at` - Auto-updates `updated_at` on UPDATE

---

### Table 2: `invoices`
**Purpose:** Stores generated invoices for billing history

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `invoice_number` | VARCHAR(255) | PRIMARY KEY | Unique invoice number (format: INV-YYYYMMDD-HHMMSS) |
| `shop_id` | UUID | NOT NULL | Shop Identifier |
| `id` | SERIAL | UNIQUE | Auto-increment internal ID |
| `stations` | JSONB | NOT NULL | Array of station data with costs |
| `subtotal` | DECIMAL(10,2) | NOT NULL | Subtotal before discount |
| `discount` | DECIMAL(10,2) | DEFAULT 0 | Discount amount applied |
| `total` | DECIMAL(10,2) | NOT NULL | Final total after discount |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Invoice creation timestamp (UTC) |

**Indexes:**
- `idx_invoices_created_at` on `created_at`

---

### Table 3: `snacks`
**Purpose:** Configurable snacks/items with prices

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment snack ID |
| `name` | VARCHAR(255) | UNIQUE NOT NULL | Snack name (e.g., "Coke Bottle") |
| `price` | DECIMAL(10,2) | NOT NULL | Price per unit |
| `active` | BOOLEAN | DEFAULT true | Active/inactive status |
| `display_order` | INTEGER | DEFAULT 0 | Display order in UI |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp (UTC) |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp (UTC) |

**Indexes:**
- `idx_snacks_active` on `active`
- `idx_snacks_display_order` on `display_order`

---

### Table 4: `customers`
**Purpose:** Customer information for autocomplete and tracking

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment customer ID |
| `shop_id` | UUID | NOT NULL | Shop Identifier |
| `phone_number` | VARCHAR(20) | NOT NULL | Customer phone number |
| `customer_name` | VARCHAR(255) | NOT NULL | Customer name |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | First visit timestamp (UTC) |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp (UTC) |

**Constraints:**
- `UNIQUE (shop_id, phone_number)`: Ensures phone numbers are unique per shop but re-usable across shops.

**Indexes:**
- `idx_customers_phone_number` on `phone_number`

---

### Table 5: `paid_events`
**Purpose:** Multi-device synchronization for paid invoices

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment event ID |
| `invoice_number` | VARCHAR(255) | NULL | Associated invoice number |
| `station_ids` | INTEGER[] | NOT NULL | Array of station IDs that were reset |
| `reset_data` | JSONB | NOT NULL | Station reset state data |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Event creation timestamp (UTC) |
| `processed` | BOOLEAN | DEFAULT false | Processing status flag |

**Indexes:**
- `idx_paid_events_created_at` on `created_at DESC`
- `idx_paid_events_processed` on `processed`

---

### Table 6: `pricing_rules`
**Purpose:** Configurable pricing rates per game type and day type

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Rule ID |
| `shop_id` | UUID | NOT NULL | Shop Identifier |
| `game_type` | VARCHAR | NOT NULL | Game type (Playstation, etc.) |
| `weekday_rate` | INTEGER | NOT NULL | Rate per hour on weekdays |
| `weekend_rate` | INTEGER | NOT NULL | Rate per hour on weekends |

**Constraints:**
- `UNIQUE (shop_id, game_type)`: One rate rule per game type per shop.
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Update timestamp |

---

### Table 7: `bonus_config`
**Purpose:** Configuration for bonus time calculations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Config ID |
| `shop_id` | UUID | UNIQUE NOT NULL | Shop Identifier (One config per shop) |
| `config_data` | JSONB | NOT NULL | Nested JSON containing bonus tiers |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Update timestamp |

---

### Table 8: `admin_users`
**Purpose:** Authentication and access control

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | User ID |
| `username` | VARCHAR | UNIQUE | Login username |
| `password_hash` | VARCHAR | NOT NULL | Hashed password |
| `is_active` | BOOLEAN | DEFAULT true | User active status |
| `last_login` | TIMESTAMPTZ | NULL | Last login timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

---

## 🔄 Application Flow
*(Refer to version 2.1 documentation for standard flows - Unchanged in v2.4)*

---

## 🚀 Deployment Architecture

### Local Development

```
┌─────────────────────────────────────────┐
│         Developer Machine               │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   Vite Dev   │  │  Express API │   │
│  │   :5173      │  │   :3001      │   │
│  └──────┬───────┘  └──────┬───────┘   │
│         │                 │            │
│         └────────┬────────┘            │
│                  │                     │
│         ┌────────▼────────┐            │
│         │   PostgreSQL    │            │
│         │   :5432  (DB:   │            │
│         │   multivendor)  │            │
│         └─────────────────┘            │
└─────────────────────────────────────────┘
```

**Commands:**
```bash
npm run dev:all  # Run both frontend and backend
npm run dev      # Frontend only
npm run dev:api  # Backend only
```

---

## ⚙️ Environment Configuration

### `.env.local` (Local Development)
```env
# Local PostgreSQL connection (using 'multivendor' database)
POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/multivendor

# OR Supabase connection for local testing
# POSTGRES_URL=postgresql://postgres:[PASSWORD]@[PROJECT].pooler.supabase.com:6543/postgres
```

### `.env.test` (Vercel Preview)
```env
# Test database for preview deployments
TEST_POSTGRES_URL=postgresql://postgres:[PASSWORD]@[TEST-PROJECT].pooler.supabase.com:6543/postgres
```

### `.env.prod` (Vercel Production)
```env
# Production database
POSTGRES_URL=postgresql://postgres:[PASSWORD]@[PROD-PROJECT].pooler.supabase.com:6543/postgres
```

---

## 📜 Version History & Changelog

### Version 2.5 - January 2, 2026 (Super Admin & Critical Fixes)

#### Super Admin Dashboard & Multi-Tenancy
1.  **Impersonation Logic Overhaul**:
    -   Implemented a "Fresh Login" simulation when Super Admins switch shops, ensuring 100% data isolation.
    -   Triggers a comprehensive reset of UI state and forces a full reload of all shop-specific data (stations, snacks, pricing, revenue) to prevent data bleeding between shops.
    -   Fixed shop selector behavior to ensure the dropdown remains accessible and functional at all times.
2.  **Data Integrity Constraints**:
    -   Resolved "Failed to update bonus configuration" and Customer Creation errors by adding `UNIQUE` constraints (`shop_id` composite keys) to `bonus_config` and `customers` tables.
3.  **Enhanced Subscription Management**:
    -   Added detailed subscription tracking in the Admin Dashboard, showing distinct "Trial" vs "Premium" statuses.
    -   Implemented "Days Remaining" calculation with visual alerts for expiring plans.

#### Critical Bug Fixes
1.  **Station Transfer Logic**:
    -   **Timer Precision**: Rewrote `recalculateElapsedTime` to parse full ISO date-time strings instead of lossy HH:MM regex, fixing precision errors and "ghost time" additions during transfers.
    -   **State Synchronization**: Updated `StationCard` to force-sync internal timer references when a station receives a new `startTime`, ensuring transferred sessions resume immediately with the correct elapsed time.
2.  **Billing Panel**:
    -   **Snack Sync**: Fixed issue where selected snacks in Station Cards didn't initially appear in the Billing Panel dropdowns.
    -   **Usability**: Increased snack selection limit from 5 to 20 per item.

### Version 2.4 - January 1, 2026 (Database Structure Modernization)

#### Database Architecture Update
1.  **New `multivendor` Database**:
    - Created a fresh database structure named `multivendor` to replace the deprecated `gamersspot` local database.
    - **Flattened Schema**: Removed complex multi-tenant isolation layers that were unnecessary for the current deployment scale. All tables now reside directly in the `public` schema.
    - **Clean Slate**: Started with a fresh, empty state for stations, invoices, and events, while preserving essential configuration (snacks).

2.  **Constraint Enforcement**:
    - Identified and fixed critical missing Primary Key constraints in the new database structure.
    - Added `PRIMARY KEY` to `stations(id)`, `snacks(id)`, `invoices(invoice_number)`, and `paid_events(id)`.
    - Using `ON CONFLICT` clauses in API queries now correctly leverages these constraints for robust data upserts.

3.  **Dedicated Configuration Tables**:
    - Migrated from virtual JSONB-only settings to dedicated tables for critical configurations:
        - `pricing_rules`: Stores dynamic pricing for Game Types (Weekday/Weekend rates).
        - `bonus_config`: Stores complex bonus time logic.
        - `admin_users`: Stores authentication credentials securely.

#### Technical Improvements
- **Connection Verification**: Implemented robust database connection verification scripts (`verify-new-db.cjs`) to ensure schema integrity before application startup.
- **Simplified Local Setup**: Local development now defaults to the standardized `multivendor` database, reducing configuration friction for new developers.

### Version 2.3 - December 31, 2025 (Continue Feature & UX Improvements)

#### Major Features
1. **Continue After Done**:
   - Added **Continue** button to resume "Done" sessions.
   - Preserves all session data implies seamless extension of play time.
   - Automatically synchronizes across all devices.
   
2. **Timer Display Fix**:
   - Fixed timer resetting to 00:00:00 on "Done". Now correctly freezes at final elapsed time.

3. **UX Polish**:
   - Standardized button sizing and styling across Station Cards.
   - Auto-clearing of Billing Panel when a station is resumed.

### Version 2.2 - December 31, 2025 (Reports Module Overhaul)
- **Native PDF Generation**: Switched to `jspdf` for selectable text and better print quality.
- **Enhanced Exports**: Consistent Excel/PDF export buttons across all reports.
- **Interactive Sorting**: Customer reports now support column-based sorting.

### Version 2.1 - December 31, 2025 (Timezone & Stability)
- **Timezone Fix**: Fixed "IST-shifted UTC" double conversion bugs. Tables now store varying true UTC, and UI converts to IST.
- **Station Persistence**: Fixed deleted stations reappearing.

---

**End of Documentation**  
*Last Updated: January 2, 2026*
