# Prompt: Build a Robust Supermarket & Mini-Mart POS System

**Role**: Senior Full-Stack Lead Developer
**Objective**: Build a high-performance, multi-counter Supermarket POS system that integrates advanced inventory control, supplier management, and granular analytics while maintaining an offline-first architecture.

---

## 1. Project Overview
We need to upgrade our existing single-store POS (based on the "Kirana" stack) into a scalable **Supermarket System**.
The core differentiator is the shift from a "Single Counter, Simple Stock" model to a **"Multi-Counter, Supplier-Centric, Shift-Based"** model.

**Tech Stack**:
- **Framework**: Next.js 14+ (App Router)
- **Database (Local)**: Dexie.js (IndexedDB) for offline-first speed.
- **Database (Cloud)**: Firebase Firestore for real-time sync and multi-device concurrency.
- **Styling**: Tailwind CSS + DaisyUI (Modern, clean aesthetics).
- **State Management**: React Context + RxJS (for complex sync logic if needed).

---

## 2. Core Functional Requirements (Module Breakdown)

### Module 1: Point of Sale (POS) & Billing
**Goal**: Handle high-traffic queues with multiple counters.
- **Multi-Device Sync**: Counter 1 & Counter 2 operate legally concurrently.
  - *Concurrency*: Use Firestore listeners (`onSnapshot`) for real-time stock updates.
- **Advanced Billing**:
  - **Barcode First**: Continuous scanning mode.
  - **Bulk & Loose Items**: Support "Scan once, type qty" and "Weighed Items" (kg/g).
  - **Hold & Recall**: Park bills to manage queue flow.
  - **Quick Actions**: Keyboard shortcuts for Search (/) and Pay (Enter).
- **Cart & Payments**:
  - **Split Payments**: Partial Cash + Partial UPI.
  - **Customer Linking**: Attach bill to Phone Number for Loyalty/Khata.
  - **Receipts**: 3-inch Thermal Print with customizable Shop Header/Footer.

### Module 2: Advanced Inventory & Supplier Management
**Goal**: Enterprise-grade stock control.
- **Supplier Systems**:
  - **Master Data**: Manage Suppliers (Name, GSTIN, Contacts).
  - **Purchase/Inwarding**: create "Inward Entries" against Invoices.
  - **Cost Management**: Track Cost Price changes per batch/purchase.
- **Stock Control**:
  - **Global Catalog**: Rapid item entry from master database.
  - **Batch Tracking (Optional)**: Expiry date management for perishables.
  - **Low Stock Alerts**: Configurable thresholds per category.
  - **Category Analytics**: Group by Dept (Dairy, Staples, etc.).

### Module 3: Khata (Customer Credit/Ledger)
**Goal**: Manage regular customer debts.
- **Profiles**: Search by Name/Phone.
- **Transactions**: Debit (Sale) and Credit (Payment) history.
- **Credit Limits**: (New) Set max credit limit per customer.
- **Settlement**: "Settle Balance" feature via Cash/UPI.

### Module 4: Staff & Shift Management (RBAC)
**Goal**: Cash security and accountability.
- **Shift Logic**:
  - **Clock-In/Out**: Float entry (Opening Cash) vs Actual Cash (Closing).
  - **Variance Report**: Calculate Shortage/Excess automatically.
  - **Z-Report**: End-of-day summary per counter.
- **Role Permissions**:
  - `Cashier`: POS Only. No Delete Access.
  - `Manager`: Stock Updates, Void Bills, Reports.
  - `Admin`: Full System Access.

### Module 5: Shop Administration & Analytics
**Goal**: Business health monitoring.
- **Financial Dashboard**:
  - Net Profit (Sales - COGS - Expenses).
  - Expense Tracker (Rent, Salaries).
- **Insights**:
  - **Hourly Heatmap**: Peak hour analysis.
  - **Top Leaders**: Best selling items, top customers, top suppliers.
  - **Stock Valuation**: Real-time inventory value.

### Module 6: Super Admin (Platform)
**Goal**: SaaS management for multiple shops.
- **Multi-Tenancy**: Create/Invite Shops.
- **Platform Metrics**: Total Revenue, Bill Counts, "Usage Score" (Database Ops).
- **Automated Reporting**: Email Monthly Usage Reports to Store Owners.

---

## 3. UI/UX & Frontend Specifications
**Goal**: A "Premium", accessible, and "Wow" interface.

### A. Visual Design System
**CRITICAL REQUIREMENT**: The UI must be an **exact replica** of the current "Kirana" POS system.
- **Reuse Existing Codebase**: Do not invent new styles. Port the existing `src/app/(dashboard)` layout, `globals.css`, and Tailwind config.
- **Framework**: Tailwind CSS + DaisyUI (Existing Version).
- **Aesthetics**:
  - **Maintain Glassmorphism**: Keep the subtle glass effects on modals and sticky headers exactly as they are.
  - **Clean Typography**: Inter/Roboto Google Fonts (same as current).
  - **Hierarchy**: Large prices, distinct call-to-action buttons (Pay, Print) - preserve current implementation.
- **Theme**: Light/Dark mode support (Default: Professional Light Mode).

### B. User Experience (UX) Enhancements
- **Speed Focus**:
  - **Keyboard First**: All POS actions (Search, Pay, Close) mappable to keys.
  - **Auto-Focus**: Inputs (Scanner) auto-focus after every action.
- **Feedback**:
  - **Toasts**: `react-hot-toast` for Success (Green), Error (Red), Info (Blue) - **Reuse existing toast implementation**.
  - **Micro-animations**: Button presses, Cart additions, Loading skeletons.
  - **Empty States**: Friendly illustrations when lists are empty.
- **Modals**: **Reuse existing Modal components** for consistent behavior (overlays, close buttons, animations).

### C. Responsive Design
- **Desktop/POS Terminal**: Optimized for landscape (1366x768+).
  - *Layout*: Left Product Grid (60%) | Right Cart Panel (40%).
- **Tablet**: Adaptive Grid (3-4 cols).
- **Mobile**: Stacked View (Catalog -> Cart Drawer).

---

## 4. Implementation Guidelines
1.  **Database Extensions**:
    - `counters` (id, active, currentCashierId).
    - `suppliers` (id, name, contact, balance).
    - `purchases` (id, supplierId, items[], totalCost, date).
    - `shifts` (id, cashierId, openingCash, closingCash, salesData).
2.  **Concurrency Strategy**:
    - Use `runTransaction` for Stock Deductions.
    - Use `onSnapshot` for Counter Status and "Global Settings".

**Output**: Please generate the folder structure and the key code modifications needed to implement the **Supplier Module** and **Multi-Counter Sync** logic first.
