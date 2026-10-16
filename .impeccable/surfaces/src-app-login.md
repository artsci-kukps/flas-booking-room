---
version: 1
slug: "src-app-login"
primary_target: "src/app/login"
related_targets: []
---

## Surface
src/app/login/

## Mode
Persuade

## Scope
Refine login page (src/app/login/) to be split into left/right layout on desktop, responsive, improve admin topbar → sidebar for admin dashboard area.

## User
KU staff accessing booking system to log in. Primary action: sign in with Google (KU email only).

## Goal
Make login look better and more polished. Also redesign admin navigation from topbar to sidebar. Apply consistent style inspired by https://hookbook.so/ with good font, appropriate weight, good proportions.

## Constraints
- Keep KU domain restriction (@ku.th) intact
- Preserve Google OAuth login flow
- Preserve error messages and Thai text
- Respect existing color tokens and flat design (no shadows) - improve proportions/layout
- Stay consistent with existing product identity

## Notes
Need to update AppHeader for admin to become sidebar. Admin dashboard/layout will need restructuring.
