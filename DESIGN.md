---
name: Creative Space — ระบบจองห้องทำงาน
description: ระบบจองห้องทำงานรายชั่วโมง ของคณะศิลปศาสตร์และวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตกำแพงแสน
colors:
  ku-green: "#0e7a4b"
  ku-green-deep: "#0a6340"
  ku-green-soft: "#e9f4ee"
  amber: "#b7791f"
  amber-soft: "#fcf3e3"
  amber-ink: "#8a5a12"
  danger: "#b42318"
  danger-soft: "#fef3f2"
  danger-line: "#f3c9c4"
  room-blue: "#1d4ed8"
  room-blue-soft: "#eef2fd"
  room-violet: "#6941c6"
  room-violet-soft: "#f4f0fe"
  canvas: "#f4f4f1"
  surface: "#ffffff"
  border: "#e3e5e0"
  ink: "#0b0b0c"
  ink-muted: "#5a5f5b"
typography:
  display:
    fontFamily: "Anuphan, 'Leelawadee UI', 'Thonburi', ui-sans-serif, system-ui, sans-serif"
    fontSize: "4.25rem"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Anuphan, 'Leelawadee UI', 'Thonburi', ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Anuphan, 'Leelawadee UI', 'Thonburi', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Anuphan, 'Leelawadee UI', 'Thonburi', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Anuphan, 'Leelawadee UI', 'Thonburi', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  tile: "9px"
  nav: "12px"
  notice: "14px"
  plate: "16px"
  panel: "16px"
  card: "24px"
  pill: "999px"
spacing:
  hairline: "2px"
  plate-gap: "12px"
  control: "16px"
  card-pad: "40px"
  block: "24px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ku-green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ku-green-deep}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    height: "54px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "40px"
  plate:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "16px"
  chip-free:
    backgroundColor: "{colors.ku-green-soft}"
    textColor: "{colors.ku-green}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-busy:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  chip-full:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  nav-item:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.nav}"
    padding: "8px 12px"
    height: "38px"
  nav-item-active:
    backgroundColor: "{colors.ku-green-soft}"
    textColor: "{colors.ku-green}"
---

# Design System: Creative Space — ระบบจองห้องทำงาน

## Overview

**Creative North Star: "The Plate Wall"**

This is the room-booking desk of a faculty building, rendered as the wall of nameplates beside the door. Every room is a physical plate: a short code, a name, and an honest status chip. The login screen is that wall; the admin shell is the same wall's back office. The system's job is to make "which room, which hour, is it free?" answerable at a glance, in Thai, without decoration competing with the data.

The mood is **flat and legible**. Surfaces are warm paper (`#f4f4f1`) with white plates pinned on top, separated by 1px hairlines rather than shadows. KU green is the single accent and it means one thing — available, and the system's own action. Everything else is ink on paper. Generous radii keep the wall from feeling like paperwork; the absence of shadow keeps it from feeling like a product tour.

Density is calm but not sparse: plates sit on a 12px grid, navigation items on a 38px pitch, and the type scale does the ranking work. Thai is the primary language, so sizes run a step larger than a Latin-only equivalent and tracking stays conservative — negative tracking is reserved for display sizes where it tightens without clipping stacked tone marks.

**Key Characteristics:**
- Flat: 1px borders and tonal fills only; there is no shadow anywhere in the system.
- One accent: KU green marks availability and the primary action; amber is reserved for "busy"; blue and violet exist only to classify room types.
- Plates, not cards: room status is a nameplate with a code, a name, and a chip.
- Thai-first sizing: labels stay at 12px minimum, body at 16px, display at 68px desktop.
- Calm motion: a single authored transition (the sidebar drawer), 300ms, and disabled under `prefers-reduced-motion`.

## Colors

A warm neutral ground with a single green accent; every other hue is doing a narrow, named job.

### Primary
- **KU Green** (`#0e7a4b`): The system accent. Primary buttons, the active navigation item, links, focus rings, and the "available" status chip. It answers "yes, you can use this."
- **KU Green Deep** (`#0a6340`): Hover/active for green buttons and links only.
- **KU Green Soft** (`#e9f4ee`): Tinted fills — active nav item background, the "available" chip fill, avatar background.

### Secondary
- **Amber** (`#b7791f`): Reserved for "busy / in use". Used as the dot and the chip's status marker, never for large fills or text.
- **Amber Soft** (`#fcf3e3`): The "busy" chip fill.
- **Amber Ink** (`#8a5a12`): Amber-formatted text. The raw amber on amber-soft measures 3.31:1 and fails 4.5:1; chip text uses this darker ink (5.37:1) while the dot keeps the true amber.

### Tertiary
- **Room Blue** (`#1d4ed8`) / **Room Blue Soft** (`#eef2fd`): Room-type tile G (meeting rooms).
- **Room Violet** (`#6941c6`) / **Room Violet Soft** (`#f4f0fe`): Room-type tile P (prayer rooms).

### Neutral
- **Canvas** (`#f4f4f1`): The page ground. Warm paper, never pure white.
- **Surface** (`#ffffff`): Plates, panels, cards, sidebar, top bar. Pure white so plates read as pinned *on* the paper.
- **Border** (`#e3e5e0`): Every separation in the system — the 1px hairline that replaces shadow.
- **Ink** (`#0b0b0c`): Primary text and the neutral (login) button fill.
- **Ink Muted** (`#5a5f5b`): Secondary text, inactive navigation, labels, the "full" chip.

### Semantic
- **Danger** (`#b42318`) with **Danger Soft** (`#fef3f2`) and **Danger Line** (`#f3c9c4`): Error notices only (the `@ku.th` restriction and session failures).

### Named Rules
**The No-Second-Accent Rule.** KU green is the only accent. If a new element needs emphasis, it uses weight, size, or ink — not a new hue. Blue and violet are *category* colors, not accents, and never appear outside a room-type tile.

**The Named-Not-Shaded Rule.** Never introduce a colour whose meaning is only "looks nice here". Every hue in this file already means something: green = available, amber = busy, blue = G, violet = P, red = error.

## Typography

**Display Font:** Anuphan (with Leelawadee UI, Thonburi, system-ui)
**Body Font:** Anuphan (same family)
**Label Font:** Anuphan

**Character:** One family for the whole system, self-hosted via `next/font` — a warm, humanist Thai/Latin face that stays legible at 12px labels and holds up at 68px display without needing a second "display" face. Tabular numerals are switched on wherever numbers are compared.

### Hierarchy
- **Display** (700, 4.25rem / 68px desktop, line-height 0.98, tracking −0.03em): The login headline `ห้องว่างในคณะ พร้อมให้คุณ`. The only text this large in the system.
- **Headline** (700, 2rem / 32px, line-height 1.15, tracking −0.03em): Card headings (`เข้าสู่ระบบ`) and page titles.
- **Title** (700, 1.375rem / 22px, tracking −0.02em, tabular): Room codes on plates (`S-204`).
- **Body** (400, 1rem / 16px, line-height 1.625): Descriptions and explanatory copy; capped near 46ch in narrow columns.
- **Label** (600, 0.75rem / 12px): Sidebar group headings, status chips, meta rows, honesty notes.

### Named Rules
**The ±0.02 Rule.** Tracking is `normal` to `−0.02em` for everything at body size or below. Negative tracking is only used at title size (−0.02em) and larger (−0.03em). Thai stacks tone marks above ascenders; over-tightening at small sizes clips them.

**The No-Kicker Rule.** No element sits above a heading as an eyebrow, overline, or kicker. Headings open their own section. Section intros, if needed, follow the heading.

## Layout

The system is a warm canvas with a fixed-or-fluid left rail and a content column.

- **Login** is a split page: `lg:` two columns at `1.06fr / 0.94fr` with a 1px vertical hairline between them; below `lg` it collapses to a single column with the login card first (order 1) and the plate wall below (order 2).
- **Admin shell** uses a fixed sidebar, 17.5rem (280px) wide, from `lg` up; the content column is offset with `lg:pl-[17.5rem]`. Below `lg` the sidebar becomes an off-canvas drawer behind a top bar, opened by the menu button, closed by Escape, a scrim tap, or navigation.
- **Container** is `max-w-6xl` (1152px) with `px-4 sm:px-6`.

Breakpoints: `sm` 640px, `lg` 1024px. `lg` is the shell's transformation point (drawer → fixed sidebar, single column → split).

Rhythm: 12px plate gaps, 16px control padding, 24px block spacing, 40px card padding, 48px section spacing. More space above a heading than below it, at every scale.

## Elevation & Depth

**There are no shadows in this system.** Not subtle ones, not on hover, not on the drawer. A programmatic audit of every rendered element returns zero elements with a non-`none` `box-shadow`. Depth is conveyed entirely by three tools:

1. **Tonal layering** — white surfaces on a warm paper ground.
2. **1px hairlines** — `#e3e5e0` borders separate every surface, region, and row.
3. **A scrim** — the mobile drawer uses a flat `ink/25` overlay for one purpose only: showing that the page behind is inert. It is not a shadow.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest *and* in every state. Hover changes colour, not elevation. If something needs to feel "raised", it gets a 1px border and a white fill.

**The Scrim-Is-Not-Shadow Rule.** The only overlay in the system is the drawer scrim. It darkens; it never blurs or shadows.

## Shapes

Form language is **generously rounded, never pill-shaped except for actions and status**.

- **Cards and panels:** 24px (card) / 16px (panel, plate).
- **Navigation items:** 12px.
- **Small square marks** (room-type tiles): 9px.
- **Error notices:** 14px.
- **Buttons and chips:** fully pill (999px).

Borders are always 1px and always `#e3e5e0` (or a semantic line colour in notices). There is no double border, no 2px accent stripe, and no left-edge colour bar. Room-type tiles are the one place a solid colour block appears in the content area, and they are 28×28px squares.

## Components

Every component here is **flat and legible**: it states its function in one glance, and hover changes colour rather than depth.

### Buttons
- **Shape:** Pill (999px), height 44px (`.btn`) or 54px for the large login action (`.btn-lg`), horizontal padding 20px / 24px.
- **Primary:** KU green fill, white text, weight 600, 16px. Used for the system's own positive actions.
- **Ink (neutral action):** Ink fill, white text. Used **only** for "sign in with Google" — a neutral, external action, so it does not claim the green accent.
- **Outline:** White fill, 1px border, ink text; hover washes to canvas.
- **Hover / Focus:** Background shift only (`ku` → `ku-hover`); focus is a 2px KU-green outline with 2px offset (`:focus-visible`).
- **Disabled / Busy:** 60% opacity, `cursor: not-allowed`, paired with `aria-busy` (the Google button swaps its label to `กำลังพาไปที่ Google…` while the OAuth redirect is in flight).

### Chips
- **Style:** Pill, 4px/10px padding, 12px semibold text, with an 8px full-round dot before the label.
- **Free:** KU-green-soft fill, KU-green text and dot. **Busy:** amber-soft fill, amber-ink text, true-amber dot. **Full:** canvas fill, ink-muted text and dot, with a 1px border so the pill silhouette survives on a white plate (a plain canvas fill is invisible on white).

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** White surface.
- **Shadow Strategy:** None — see Elevation & Depth.
- **Border:** 1px `#e3e5e0`.
- **Internal Padding:** 32px on mobile, 40px from `sm`.

### Plates (signature component)
A room nameplate: tabular room code (22px/700), room name (13px muted), and a status chip opposite a 28×28 room-type tile. 16px radius, 1px border, white on canvas, 16px padding, laid on a 2-column (mobile) / 3-column (`sm`) grid with 12px gaps. The plate is the system's signature; the login wall is a grid of six of them.

### Navigation
- **Desktop:** fixed 17.5rem sidebar, white, 1px right border. Items are 12px-radius rows, 38px tall, 14px/500 inert-muted text with an 18px authored icon at 1.8 stroke. Group headings are 12px/600 muted labels (`พื้นที่ทำงาน`, `จัดการระบบ`).
- **Active:** KU-green-soft fill, KU-green semibold text, marked with `aria-current="page"`.
- **Mobile:** 56px top bar with brand and a menu button; the sidebar slides in behind a flat scrim.

### Notices
Inline, 14px radius, danger-soft fill, 1px danger-line border, a 20px authored warning icon, a 14px bold heading and 13px body. Used for the `@ku.th` restriction and session errors.

## Do's and Don'ts

### Do:
- **Do** keep depth flat: separate with a 1px `#e3e5e0` border and tonal fill, never a shadow.
- **Do** keep KU green (`#0e7a4b`) for availability and the system's own primary action, and amber (`#b7791f` / text `#8a5a12`) only for "busy".
- **Do** switch on `tabular-nums` for anything a person compares down a column (room codes, service hours).
- **Do** keep labels at 12px or larger and body at 16px — Thai needs the extra room.
- **Do** give a plate a code, a name, and a status chip; that trio is what makes it a plate.
- **Do** label representative data as representative (e.g. `ตัวอย่างข้อมูล · สถานะจริงแสดงหลังเข้าสู่ระบบ`).

### Don't:
- **Don't** add a shadow, blur, or elevation on hover — including on the drawer. The only overlay is the flat drawer scrim.
- **Don't** introduce a second accent colour. Blue and violet are room-type categories, not accents.
- **Don't** put a kicker, eyebrow, or overline above a heading.
- **Don't** tighten tracking below `−0.02em` at body size or smaller; Thai tone marks clip.
- **Don't** use an emoji or an icon font as an icon; icons are authored SVG at 1.8 stroke.
- **Don't** put the large ink (neutral) treatment on a primary action — it is reserved for the Google sign-in button.
- **Don't** use canvas (`#f4f4f1`) as a chip fill without a border on a white surface; the pill disappears.
