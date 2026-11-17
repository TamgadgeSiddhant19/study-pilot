---
name: Technical Precision Workspace
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006398'
  on-secondary: '#ffffff'
  secondary-container: '#5bb8fe'
  on-secondary-container: '#00476e'
  tertiary: '#005338'
  on-tertiary: '#ffffff'
  tertiary-container: '#006e4c'
  on-tertiary-container: '#7df1bd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#85f8c4'
  tertiary-fixed-dim: '#68dba9'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#005137'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display:
    fontFamily: Geist
    fontSize: 3rem
    fontWeight: '600'
    lineHeight: 3.5rem
    letterSpacing: -0.03em
  display-mobile:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.025em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Geist
    fontSize: 1.125rem
    fontWeight: '500'
    lineHeight: 1.5rem
    letterSpacing: -0.015em
  body-lg:
    fontFamily: Geist
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: -0.01em
  body-md:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '400'
    lineHeight: 1rem
    letterSpacing: '0'
  label-md:
    fontFamily: Geist
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: -0.005em
  label-sm:
    fontFamily: Geist
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 0.875rem
    letterSpacing: 0.02em
  code-inline:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
    letterSpacing: -0.01em
  tabular-stat:
    fontFamily: JetBrains Mono
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: -0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xxs: 0.125rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-base: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system embodies the calculated elegance of high-performance developer tools, productivity engines, and technical command centers. Drawing direct inspiration from the refined ergonomics of Linear, the surgical utility of Raycast, and the structural clarity of Notion, it prioritizes density, optical balance, and absolute clarity.

The aesthetic follows **Technical Modernism**—a disciplined union of clean minimalism and utilitarian data density:
- **Tone:** Authoritative, razor-sharp, frictionless, and distraction-free.
- **Visual Weight:** Light-mode native, substituting heavy structural fills with micro-hairlines, pure white elevation planes, and purposeful typographic weight transitions.
- **Emotional Resonance:** Quiet confidence, terminal-like speed, and executive craftsmanship. Every pixel exists to elevate task velocity and contextual cognition.

## Colors

The palette balances clinical clarity with precise focal anchors. The canvas uses calibrated cool off-whites, layering crisp pure whites on top to create spatial hierarchy without heavy visual mass.

### Core Roles
- **Base Canvas (`#F8F9FA`):** The ground plane. Recedes visually to allow card layers and data grids to surface naturally.
- **Surface Elevation (`#FFFFFF`):** Work surfaces, interactive panels, floating palettes, and cards. Always pure white to maximize contrast against the backdrop.
- **Primary Brand Accent (`#4F46E5` / `#6366F1`):** Electric indigo. Reserved strictly for primary callouts, active command triggers, selection states, and primary keyboard focus indicators.
- **Text & Structure Neutral (`#0F172A`):** Deep slate/charcoal for headings and high-priority data points. Avoids dead `#000000` to prevent harsh visual fatigue.
- **Secondary Neutral (`#475569` / `#64748B`):** Muted slate for metadata, inline labels, keyboard shortcuts, and column headers.
- **Border Definers (`#E2E8F0` / `#EAECF0`):** Single-pixel micro-borders that structure boundaries without segmenting the UI aggressively.

### Semantic Status Tokens
- **Mastered / Success (`#059669`):** Emerald green for confirmed syncs, terminal success, and passed states. Paired with soft green tint surface (`#ECFDF5`).
- **Attention / Pending (`#D97706`):** Amber for review queues, warnings, and non-blocking locks. Paired with soft amber tint surface (`#FFFBEB`).
- **Critical / Mistake (`#E11D48`):** Crimson red for exceptions, destructive operations, and failed queries. Paired with soft red tint surface (`#FFF1F2`).
- **Focus / In-Progress (`#0284C7`):** Sky blue for active session timers, multi-select targets, and processing queues. Paired with soft sky tint surface (`#F0F9FF`).

## Typography

The typographic hierarchy is engineered for scanning efficiency, information density, and absolute legibility.

- **Primary Typeface (Geist):** Handles all headers, interface controls, navigation labels, and standard prose. Characterized by low optical friction, balanced geometric proportions, and deliberate neutrality.
- **Monospace Companion (JetBrains Mono):** Drives data metrics, code traces, execution counts, timestamps, and keybinding indicators (`⌘K`). Tabular numerals (`font-variant-numeric: tabular-nums`) must be enforced across all analytics grids, tables, and monetary figures to prevent horizontal jitter during real-time value mutations.
- **Optical Tightening:** Display and headline styles employ negative letter spacing (`-0.015em` to `-0.03em`) to bind headline phrases into single cohesive perceptual units.

## Layout & Spacing

The structural layout relies on an ultra-compact 4px/8px modular base scale, tailored for maximum content volume without visual overcrowding.

### Shell Architecture & Grid
- **Workspace Canvas:** A responsive fluid grid anchored by fixed-dimension utility panels. The standard desktop arrangement consists of a collapsed/expanded 240px utility sidebar, an optional 320px context pane, and a dynamic fluid center stage (`minmax(0, 1fr)`).
- **Desktop Breakpoints:**
  - `lg` (1024px+): Standard dual-pane workspace with 16px gutter.
  - `xl` (1280px+): Full tri-pane inspector setup with 24px gutter and 32px margins.
  - `md` (768px - 1023px): Collapsible drawer panels, 16px gutters, fluid stage.
  - `sm` (< 768px): Single-column stack, full-width cards, edge margins pinned to 16px.
- **Density Philosophy:** Compact internal element paddings (`space-sm` for table cells and button interiors) keep viewports productive, mimicking native IDE layouts.

## Elevation & Depth

Visual depth is achieved through **low-contrast micro-outlines paired with restrained ambient diffusion**. The system avoids deep skeuomorphic shadows and ungrounded floating elevations, staying anchored to the canvas plane.

### Elevation Levels
1. **Level 0 (Base / Canvas):** Surface color `#F8F9FA`. No borders, no shadows.
2. **Level 1 (Docked Containers & Grid Cards):** Surface `#FFFFFF`. Border: `1px solid #E2E8F0`. Shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.03)`.
3. **Level 2 (Interactive Hover & Active Splitters):** Surface `#FFFFFF`. Border: `1px solid #CBD5E1`. Shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.03)`.
4. **Level 3 (Command Menus, Popovers & Context Sheets):** Surface `#FFFFFF`. Border: `1px solid #E2E8F0`. Shadow: `0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)`.
5. **Level 4 (Modal Dialogs & Critical Interrupts):** Surface `#FFFFFF`. Border: `1px solid #E2E8F0`. Shadow: `0 24px 48px -12px rgba(15, 23, 42, 0.12)`. Accompanied by a diffused backdrop tint: `rgba(15, 23, 42, 0.2)` with `backdrop-filter: blur(4px)`.

## Shapes

The geometric signature is **Soft Precision (Level 1)**. Geometry remains disciplined, sharp, and structured:
- **Base Components (Inputs, Buttons, Badges):** `4px` (`0.25rem`). Imparts an architectural, software-engineered visual weight.
- **Cards, Drawers & Modals (`rounded-lg`):** `8px` (`0.5rem`). Prevents container corners from clipping dense internal child grids.
- **Floating Overlays & Toast Notifications (`rounded-xl`):** `12px` (`0.75rem`).
- **Pill Exception:** Status indicators, micro-dots, and circular avatar masks strictly use full radius (`9999px`).

## Components

### Buttons
- **Primary:** Background `#4F46E5`, text `#FFFFFF`, border `1px solid #4338CA`, shadow `0 1px 2px rgba(79, 70, 229, 0.2)`. Hover: `#4338CA`. Active: `#3730A3`.
- **Secondary / Subtle:** Background `#FFFFFF`, text `#0F172A`, border `1px solid #E2E8F0`, shadow `0 1px 2px rgba(15, 23, 42, 0.04)`. Hover: `#F8F9FA` with border `#CBD5E1`.
- **Ghost:** Background transparent, text `#475569`. Hover: Background `#F1F5F9`, text `#0F172A`.
- **Size Options:** Compact height of 28px (`space-xs` vertical, `space-sm` horizontal) for contextual row tools; standard height of 32px or 36px for global actions.

### Inputs & Select Fields
- Base background `#FFFFFF`, text `#0F172A`, placeholder `#94A3B8`.
- Resting border: `1px solid #E2E8F0`.
- Focus state: Border `1px solid #4F46E5`, outline `2px solid rgba(79, 70, 229, 0.15)`, outline-offset `0`.

### Chips, Status Badges & Keyboard Tags
- **Micro Status Badges:** Padding `2px 6px`, font size `0.6875rem`, font weight `500`. Accompanied by a 6px circular indicator dot.
  - *Mastered:* Background `#ECFDF5`, text `#047857`, border `1px solid #A7F3D0`.
  - *Revision:* Background `#FFFBEB`, text `#B45309`, border `1px solid #FDE68A`.
  - *Error:* Background `#FFF1F2`, text `#BE123C`, border `1px solid #FECDD3`.
  - *Active:* Background `#F0F9FF`, text `#0369A1`, border `1px solid #BAE6FD`.
- **Kbd / Keycap Indicator:** Monospace JetBrains Mono, background `#F8F9FA`, border `1px solid #CBD5E1`, border-bottom-width `2px`, text `#475569`, border-radius `3px`, padding `1px 4px`.

### Lists & Data Rows
- High-density table and tree structures: 36px row heights.
- Hover state: Entire row shifts to `#F8F9FA`.
- Selected state: Background `#EEF2FF`, left-edge indicator `2px solid #4F46E5`.

### Checkboxes & Radios
- Size: 14px × 14px. Radius: 3px (Checkbox) / 9999px (Radio).
- Unchecked: Background `#FFFFFF`, border `1px solid #CBD5E1`.
- Checked: Background `#4F46E5`, border `1px solid #4F46E5`, icon white.

### Cards & Panels
- White background with `1px solid #E2E8F0`. Padding structured at `space-base` (16px) or `space-lg` (24px).
- Optional card header: 40px height with a subtle bottom hairline border `1px solid #F1F5F9`.

### Command Palette (Raycast-Inspired)
- Centered modal container, 640px maximum width, radius 8px.
- Top query field: 48px height, unbordered, text `1rem`, inline shortcut indicator.
- Search result sections grouped by uppercase muted labels (`0.6875rem` tracking `0.05em`).
- Active navigation item highlighted with `#F1F5F9` and right-aligned action badges.