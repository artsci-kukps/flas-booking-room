---
version: 1
slug: "src-app-login-page-tsx"
primary_target: "src/app/login/page.tsx"
related_targets: ["src/components/app-header.tsx"]
---

## Surface

`src/app/login/page.tsx` (+ `src/app/login/google-sign-in-button.tsx`). Related target: admin navigation in `src/components/app-header.tsx` and `src/app/(protected)/` layout.
Scope: login surface as the primary design surface; admin topbar replaced by a sidebar mount; global tokens/type updated to carry the same system. Not in scope: booking flow logic, auth behaviour, database.

## Mode

Persuade. One decision: sign in with a @ku.th account. The page must make the offer legible (which rooms, which hours, how booking actually works) and put the Google action in front of the visitor in its working form.

## Audience and job

KU Kampaeng Saen staff and faculty arriving with a specific intent: find a room and claim an hour block. They arrive on a laptop in daylight, mid-workday, between other tasks. They need to know this is the faculty's real booking system, not a generic portal, and that their @ku.th identity is the only way in.

## Constraints

- Only `@ku.th` accounts; two error notices already exist (`ku-domain`, `session`) — keep their meaning and Thai wording.
- Google OAuth flow, `redirect` for signed-in users, and the `getCurrentUser` guard stay exactly as they are.
- KU green `#0E7A4B` and the flat, border-only surface language (no shadow elevation) stay.
- Pinned UI reference from the brief: hookbook.so — generous rounded surfaces, pill controls, hairline borders, compact label type, tight-tracked display headings, restrained single accent.
- Responsive: split two-column at desktop, single column (form first) on mobile.

## Chosen direction and memorable moment

Plate Wall. The left half is the faculty's own corridor of room plates — real room codes, room types S/G/P, honest status — proving that this login belongs to these rooms and these hours; the right half is the door itself. The memorable moment: the visitor recognises an actual room code (S-204, G-101) before they ever sign in, and the plates answer the "which rooms?" question silently while the card asks the only question that matters.

## Unresolved decisions

- Real room codes/capacities/status for the plate wall must come from the rooms table; until then the wall carries clearly labelled representative values (no claim that they are live).
- Whether the plate wall becomes a live server-rendered status preview in a later pass.

## Direction contract

**THESIS.** Login as the faculty's own corridor of room plates: the page proves which rooms exist and which are free before asking for anything. It refuses the centred generic login card on a neutral ground — the incumbent — by giving the offer half the viewport and the action the other half.

**OWN-WORLD.** Warm paper canvas `#F4F4F1`, white surfaces, hairline `#E3E5E0` borders, ink `#0B0B0C`, one committed accent: KU green `#0E7A4B` (plus its soft tint) for room-type S and live status; amber `#B7791F` reserved for occupied; violet `#6941C6` for room type P. Components: flat plates with 16px radius, pill status chips, pill primary button in ink, tight-tracked bold headings, all numerals tabular. No shadows anywhere — elevation is a 1px border, once.

**STORY.** The visitor sees real room codes and honest status (S-204, G-101, P-012), understands that booking is hourly blocks inside 08:30–16:30, believes this is the faculty's own system and not a generic portal, and presses one button: เข้าสู่ระบบด้วย Google.

**FIRST VIEWPORT.** Left 54%: brand lockup (mark + Creative Space + faculty line), a display headline at ~4.6rem/weight 700/tracking -0.03em, one supporting paragraph at ≤46ch, and a 3×2 wall of room plates pinned to the bottom edge, each a code + name + status chip + type tile. Right 46%: a single white card, 24px radius, centred — "เข้าสู่ระบบ" heading, one line about @ku.th, the existing error notice slot, the full-width pill Google button (ink ground, white label), the @ku.th reassurance line, and a service-hours footer. At <1024px the wall drops below the card and the card leads.

**FORM.** Grounded candidate 4 of 7 (space furniture and room signage), raised by the brief-pinned hookbook UI language and by three declined challengers' disciplines (equal-width bands, one selection propagating to every plate, uniform outline weight, tabular numerals). Seed key `fbf12f6a`.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
