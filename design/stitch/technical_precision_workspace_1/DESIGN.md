---
name: Technical Precision Workspace
colors:
  surface: '#10141a'
  surface-dim: '#10141a'
  surface-bright: '#353940'
  surface-container-lowest: '#0a0e14'
  surface-container-low: '#181c22'
  surface-container: '#1c2026'
  surface-container-high: '#262a31'
  surface-container-highest: '#31353c'
  on-surface: '#dfe2eb'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dfe2eb'
  inverse-on-surface: '#2d3137'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#93ccff'
  on-secondary: '#003351'
  secondary-container: '#3198dc'
  on-secondary-container: '#002c47'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#00885d'
  on-tertiary-container: '#000703'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#cce5ff'
  secondary-fixed-dim: '#93ccff'
  on-secondary-fixed: '#001d31'
  on-secondary-fixed-variant: '#004b73'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#10141a'
  on-background: '#dfe2eb'
  surface-variant: '#31353c'
typography:
  display:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.06em
  kbd-shortcut:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.02em
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
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
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system targets ambitious software engineers, technical interview candidates, and high-velocity knowledge workers. The emotional resonance is defined by deep focus, frictionless speed, quiet competence, and professional rigor.

The aesthetic philosophy fuses:
- **Developer-Tool Precision:** High-density layouts, low-profile chrome, monospaced tabular data displays, and keyboard-first accessibility reminiscent of modern command palettes.
- **Editorial Minimalism:** Distraction-free typography, intentional negative space, and disciplined content staging that prioritizes uninterrupted flow states.
- **Subtle Modernism:** Hairline borders, directional light cues, translucent structural layers, and refined micro-states instead of superficial gamification or exaggerated drop shadows.

Every component feels engineered rather than merely drawn. Interactivity communicates deterministic responsiveness, reinforcing agency and mental clarity.

## Colors

The palette establishes an ergonomic, high-contrast, low-strain interface optimized for extended nocturnal coding sessions and analytical reviews.

### Role Tokens & Color Logic

- **Canvas & Surface Tokens:**
  - *Dark Mode (Default):* Canvas Root `#0D1117`, Surface Elevated `#161B22`, Surface Overlay / Modal `#21262D`, Border Hairline `#30363D`.
  - *Light Mode:* Canvas Root `#F8F9FA`, Surface Elevated `#FFFFFF`, Surface Muted `#F1F5F9`, Border Hairline `#E2E8F0`.
- **Text & Contrast:**
  - *Dark Mode:* Primary Text `#F0F6FC`, Secondary Text `#8B949E`, Muted / Code Syntax `#6E7681`.
  - *Light Mode:* Primary Text `#111827`, Secondary Text `#4B5563`, Muted Text `#9CA3AF`.
- **Brand & Accents:**
  - *Electric Indigo (`#6366F1` / `#4F46E5`):* Primary actions, active navigation states, cursor indicators, and focus outlines.
  - *Active Session Blue (`#0284C7`):* Live execution environments, active timers, and streaming AI synthesis.
- **Diagnostic / State Accents:**
  - *Emerald (`#10B981`):* Mastered concepts, test suite passing, resolved edge cases.
  - *Amber (`#F59E0B`):* Spaced repetition revision queues, warnings, computational complexity warnings.
  - *Rose (`#EF4444`):* Syntax errors, test failures, critical algorithmic antipatterns.

All color treatments avoid harsh saturation; background fills on badges and status markers rely on 8%–12% alpha layers paired with opaque semantic foreground text.

## Typography

Typography establishes an analytical hierarchy through rigorous weights, tightened tracking, and structural mono-elements:

- **Geist** delivers crisp geometric forms and tall x-height for interface navigation, document editing, and analytical breakdowns.
- **JetBrains Mono** governs system metadata, memory complexity expressions, tabular benchmarks, algorithmic input/output representations, and keyboard shortcuts.
- **Micro-Labels:** Use `label-mono` in uppercase for table headers, metadata tags, breadcrumb category titles, and execution telemetry.
- **Numbers:** Always activate `font-variant-numeric: tabular-nums` to guarantee vertical decimal alignment across timelines, run-time profiles, and dynamic scoring matrices.

## Layout & Spacing

The structural layout uses an engineered 12-column variable grid designed for multi-pane split workflows (code editor, AI mentor thread, problem specification).

### Breakpoints & Layout Rules
- **Desktop (≥1280px):** 3-pane flexible layout. Fixed left rail navigation (240px or 56px collapsed), elastic editor canvas (min 600px), collapsible context panel (380px fixed width). Gutters set to `1.5rem`.
- **Tablet (768px – 1279px):** 2-pane mode. Left sidebar collapses to an icon dock. Context panels become overlay drawers triggered via `⌘/`. Gutters drop to `1rem`.
- **Mobile (<768px):** Single vertical stream. Tab-swapped code/problem views. Persistent bottom utility bar replaces side rails. Edge margin is strictly `1rem`.

Compact density rules apply across all panes: internal component spacing prioritizes high data density without feeling clustered.

## Elevation & Depth

Visual hierarchy uses tonal surface step-ups and crisp 1px borders rather than diffuse drop shadows.

1. **Layer Hierarchy:**
   - **Level 0 (Canvas):** Pure `#0D1117` base.
   - **Level 1 (Panels & Sub-sections):** `#161B22` background with a continuous border: `1px solid #30363D`.
   - **Level 2 (Modals & Command Palettes):** `#21262D` background surrounded by `1px solid rgba(240, 246, 252, 0.1)` and an ambient shadow (`box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.6)`).
   - **Level 3 (Tooltips & Popovers):** `#2D333B` with `1px solid #444C56` and directional highlight glow.

2. **Light Ingress & Inner Borders:**
   - Interactive cards and command elements utilize an inset hairline light stroke (`inset 0 1px 0 0 rgba(255, 255, 255, 0.05)`) along the top edge to simulate refined micro-beveling.
   - Diffuse accent glows are limited to active keyboard focus rings (`0 0 0 2px rgba(99, 102, 241, 0.35)`).

## Shapes

The design system adopts a **Soft (Level 1)** geometric standard. This geometry mirrors the angular precision of modern code editors and developer CLI tools, avoiding playful bubbles.

- **Base Corner Radius (0.25rem / 4px):** Code blocks, shortcut keys (`<kbd>`), inner table cells, segmented tabs, and discrete form controls.
- **Containers & Cards (0.5rem / 8px):** Resizable panels, modal frames, problem prompt containers, and visual inspection blocks.
- **Pill Geometry (9999px):** Strictly reserved for atomic status chips (e.g., "Optimal", "O(log n)"), online indicators, and small interactive tags.

## Components

### Buttons
- **Primary:** Background `#6366F1`, text `#FFFFFF`, subtle top inner-bevel (`inset 0 1px 0 rgba(255,255,255,0.2)`). Height: 32px (default) or 28px (compact).
- **Secondary / Ghost:** Transparent background, text `#F0F6FC`, border `1px solid #30363D`. On hover: background `#21262D`, border `#8B949E`.
- **Keyboard Affordance:** Always embed right-aligned `<kbd>` icons styled with background `#0D1117`, border `1px solid #30363D`, text `#8B949E`.

### Segmented Controls (Linear Style)
- A unified `#161B22` track with `1px solid #30363D` housing flush interior segments.
- The active item transitions using a solid `#21262D` plate with `box-shadow: 0 1px 3px rgba(0,0,0,0.4)` and `#F0F6FC` primary typography.

### Status Chips & Badges
- Pill-shaped (`rounded-full`), padding `2px 8px`, font `label-mono`.
- Consists of an 8px circular status ping alongside monochromatic text.
  - *Mastered:* Background `rgba(16, 185, 129, 0.12)`, text `#10B981`, ping `#10B981`.
  - *Review Needed:* Background `rgba(245, 158, 11, 0.12)`, text `#F59E0B`, ping `#F59E0B`.
  - *Failed:* Background `rgba(239, 68, 68, 0.12)`, text `#EF4444`, ping `#EF4444`.

### Input Fields & Command Palettes (Raycast Style)
- Flat background `#161B22`, border `1px solid #30363D`, font `body-md`.
- Focus state: border `#6366F1` with an outer indigo aura (`0 0 0 1px #6366F1`).
- Fast search inputs feature a leading monospaced glyph (`>`) and a trailing `ESC` badge.

### Structured Data Tables
- Edge-to-edge layout within Level 1 panels. 
- Headers: height 32px, `label-mono`, uppercase, text `#8B949E`, bottom border `1px solid #30363D`.
- Rows: height 36px, alternating subtle hover state `#1C2128`, borderless interior dividers.

### Refined Progress Rings
- SVG-based, stroke thickness 2px or 3px.
- Track background `rgba(255, 255, 255, 0.08)`, stroke color `#6366F1` or `#10B981`. Never show oversized radial charts; keep dimensions inside a 24px–48px footprint.