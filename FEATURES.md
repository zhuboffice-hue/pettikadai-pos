# Features of Kiarna POS System

## 1. Point of Sale (POS) & Billing
The core billing interface designed for high-speed checkout and flexibility.

- **Product Search & Access**
  - Instant search by product name.
  - Barcode scanning support (via camera/device).
  - Quick-add "Loose Items" with custom weight input (kg/g).
  - Visual product grid with stock level indicators and prices.

- **Cart Management**
  - Add/Remove items.
  - Adjust quantities (increment/decrement).
  - Clear entire cart.
  - Real-time calculation of totals, subtotals, and taxes.

- **Checkout & Payments**
  - Multiple payment modes: **Cash**, **UPI**, **Credit (Udhaar)**.
  - Customer association (link bill to existing or new customer via phone number).
  - "Walk-in" customer support (no registration needed).
  - GST/Tax calculation support (Tax Inclusive/Exclusive logic).

- **Receipts**
  - Printable receipt generation.
  - Digital receipt preview.
  - Custom receipts (configurable shop details).

## 2. Inventory Management Capabilities
Complete system to track stock, prices, and product details.

- **Product Management**
  - Add/Edit/Delete products.
  - Fields: Name, Category, Cost Price, Selling Price, Unit (pcs, kg, l, etc.), Barcode.
  - **Global Catalog**: Rapidly add products from a pre-defined global database to your local inventory.
  - **Loose Items**: Flag products as "loose" to enable weight-based billing at POS.

- **Stock Tracking**
  - Track current stock levels.
  - **Low Stock Alerts**: Visual warnings for items falling below threshold (default: 5 units).
  - Initial stock setup when adding products.

- **Offline-First Architecture**
  - Works offline using local database (Dexie.js/IndexedDB).
  - Background synchronization queue to sync data with Cloud (Firebase) when online.

## 3. Khata (Credit/Ledger) Management
Digital ledger to manage customer debts and advances.

- **Customer Profiles**
  - Create customer profiles with Name and Phone Number.
  - Search customers by simplified attributes.

- **Balance Tracking**
  - Real-time tracking of **Due** (Receivable) or **Advance** amounts.
  - Credit transactions from POS automatically update customer balance.
  - View individual customer transaction history (implied structure).

## 4. Shop Administration & Analytics
Dashboard for shop owners to manage business health and operations.

- **Financial Overview**
  - **Total Revenue**: Aggregate of all sales.
  - **Net Profit**: Real-time calculation (Revenue - Cost of Goods - Expenses).
  - **Expense Tracking**: Log and categorize daily expenses (Rent, Utilities, Salaries).
  - **Expense/Revenue Ratio**: Visual progress bar for financial health.

- **Insights & Reports**
  - **Top Customers**: Identify most loyal/high-spending customers.
  - **Stock Value**: Total valuation of current inventory.
  - **Low Stock Report**: Dedicated list of items needing restock.

- **Staff Management (RBAC)**
  - **Role-Based Access Control**:
    - **Shop Admin**: Full access to settings, finance, and staff management.
    - **Shop User**: Restricted access (POS & Billing only).
  - Invite new staff via email.
  - Revoke access for existing staff.

## 5. Super Admin (Platform Level)
Features for the platform administrator managing multiple shops.

- **Multi-Tenancy Management**
  - Create and manage multiple Shops.
  - Invite Shop Owners via email to set up their store.
  - Monitor status of all shops on the platform.

- **Platform Analytics**
  - **Usage Metrics**: Track Bill Counts, Product Counts, and Revenue per shop.
  - **Usage Score**: specialized metric to estimate system load (Firebase Writes).
  - **Upgrade Status**: Indicators for shops exceeding free tier limits ("Needs Blaze" vs "Spark OK").

- **Reporting**
  - **Export to CSV**: Download detailed usage data.
  - **Email Reports**: Auto-generate and email usage reports to Shop Owners (Gmail integration).
  - **PDF Reports**: Generate official usage PDF documents.

## 6. Technical & System Features
- **Responsive Design**: Mobile-first UI compatible with Desktops, Tablets, and Phones.
- **PWA Capabilities**: (Implied by offline support) Ready for installable app-like experience.
- **Secure Authentication**: Firebase Authentication for secure login and data isolation.
- **Data Isolation**: Strict shop-level data segregation (Multi-tenant architecture).

## 7. UI/UX & Design Features
Modern, accessible, and responsive user interface designed for efficiency.

- **Visual Design System**
  - **Modern Aesthetics**: Clean, flat design using Tailwind CSS and DaisyUI components.
  - **Responsive Layout**: Seamless experience across Desktop, Tablet, and Mobile devices.
  - **Interactive Elements**: Hover effects, smooth transitions, and loading states (spinners/skeletons) for better feedback.
  - **Iconography**: comprehensive use of Lucide React icons for intuitive navigation and actions.

- **User Experience (UX) Enhancements**
  - **Fast Input Modes**: Optimized for high-speed data entry (Barcode scanning, quick-increment buttons).
  - **Modals & Dialogs**: Focused tasks (Adding Products, Checkout) handled in overlays to maintain context.
  - **Toast Notifications**: Real-time feedback for actions (Success, Error, Info alerts) using `react-hot-toast`.
  - **Empty States**: Helpful illustrations and prompts when lists (Cart, Inventory) are empty.
  - **Confirmation Dialogs**: Safety checks for critical actions like Deletions or discard changes.

- **Accessibility & Usability**
  - **Keyboard Navigation**: Input fields auto-focus (e.g., Barcode search) for keyboard-first workflows.
  - **Clear Visual Hierarchy**: Distinct typography for Prices, Totals, and Alerts.
  - **Status Indicators**: Color-coded badges for Stock Status (Low/Normal), Bills (Paid/Due), and Sync State.
