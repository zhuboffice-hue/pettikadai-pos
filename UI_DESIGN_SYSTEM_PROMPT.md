# Prompt: Kirana POS Design System & UI Specification

**Role**: Frontend Specialist / UX Designer
**Objective**: strictly replicate the existing visual identity, component library, and layout structure of the "Kirana" POS for the new Supermarket system.

---

## 1. Core Visual Identity
The system uses a strictly controlled **Black, White, and Gray** aesthetics (Monochrome) with functional colors only for status alerts.

### Color Palette (CSS Variables)
- **Primary**: Pure Black (`#000000`)
  - Used for: Primary Buttons, Active Navigation Links, Heavy Borders.
- **Secondary**: Dark Gray (`#4a4a4a`)
  - Used for: Secondary Actions, Sub-headers.
- **Backgrounds**:
  - `bg-base-100`: White (`#ffffff`) - Card backgrounds.
  - `bg-base-200`: Light Gray (`#f5f5f5`) - App background/Canvas.
  - `bg-base-300`: Medium Gray - Borders/Dividers.

### Typography
- **Font Family**: `Inter` or `sans-serif` (System Default).
- **Scale**:
  - Headings: `text-3xl font-bold` (Page Titles), `text-xl` (Card Headers).
  - Body: `text-base` for inputs, `text-sm` for secondary info.
  - Monospace: `font-mono` for Prices and Quantities.

### Functional Styles
- **Buttons**:
  - Shape: Slightly rounded (`rounded-xl` or `rounded-btn`).
  - `btn-primary`: Black bg, White text.
  - `btn-ghost`: Transparent, text-only.
- **Inputs**:
  - `input-bordered`: Standard border, `focus:ring-black`.
  - `no-spinner`: Hide number spinners on quantity inputs.

---

## 2. Layout Structure (Responsive)
The application uses a **Responsive Dashboard Layout** (`src/app/(dashboard)/layout.tsx`).

### Desktop (Sidebar Layout)
- **Sidebar**: Fixed, 64px width (or expandable to 256px).
  - Background: `bg-base-100/80` with `backdrop-blur-md`.
  - Content: Brand Logo (Top), Navigation Links (Center), User Profile/Logout (Bottom).
- **Main Content Area**:
  - Margin Left: `ml-64` (pushes content right of sidebar).
  - Container: `max-w-7xl mx-auto`.
  - Animation: `animate-in fade-in slide-in-from-bottom-4` for smooth page loads.

### Mobile (Bottom Nav Layout)
- **Header**: Sticky `h-20`, shows Logo only.
- **Bottom Navigation**: Fixed `h-16` at the bottom.
  - Items: 5 key links (POS, Orders, Khata, Inventory, Customers).
  - Active State: Icon scales up, primary color, top indicator line.

---

## 3. Component Specifications

### Navigation Items
- **Styles**:
  - Inactive: `text-gray-600 hover:bg-gray-100`.
  - Active: `bg-black text-white shadow-none font-bold`.
- **Icons**: Lucide React icons, stroke width adapts (2px normal, 2.5px active).

### Feedback Components
- **Toasts**: Use `react-hot-toast`.
  - Success: Green accent.
  - Error: Red accent.
- **Loading States**: `Loader2` icon with `animate-spin`.

### Glassmorphism Strategy
- Use `backdrop-blur-md` and `bg-base-100/80` for:
  - Sticky Headers.
  - Modals/Overlays.
  - Sidebar backgrounds.
- Do NOT use solid opaque backgrounds for floating elements.

---

## 4. Required Tech Stack Configuration
Ensure your project is configured with these exact tools:
1.  **Tailwind CSS**: v3.x or v4.x
2.  **DaisyUI**: For component primitives (`btn`, `card`, `input`).
    - *Theme Config*: Enforce "lofi" or custom monochrome theme.
3.  **Lucide React**: For all iconography.
4.  **React Hot Toast**: For notifications.

---

**Output**: When building the UI, copy the structure of `DashboardLayout` provided in the reference code exactly.
