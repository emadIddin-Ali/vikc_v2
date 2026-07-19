# Handoff: LEVLA — QR-baserad poäng- & belöningsapp för ungdomar

## Overview
LEVLA is a gamified attendance & rewards app for a municipal youth project (fritidsgård / ungdomsgård). Youth check in at activities by scanning a QR code (geo-locked to the venue), earn XP + points, level up with celebration animations, complete missions, spend points in a rewards shop, and compete on a weekly leaderboard. Leaders (admins) publish activities with a map-pinned check-in location and a background theme, take attendance manually, and manage rewards. The whole experience is in **Swedish** and aimed at a mixed 10–19 age group with a playful, game-like feel.

## About the Design Files
`Ungdomsapp.dc.html` in this bundle is a **design reference created in HTML** — an interactive prototype showing the intended look, motion, and behavior. It is **not production code to copy directly**. The task is to **recreate this design in the target codebase's environment** (React Native / Expo, Flutter, native iOS/Android, or a React web PWA) using that project's established patterns, component library, navigation, and state management. If no environment exists yet, choose the most appropriate framework for a mobile-first youth app (React Native / Expo is a good default) and implement there.

The prototype is authored as a single component with a role switcher (Ungdom / Ledare) purely for demo convenience. **In production these are two separate authenticated roles** — build proper auth + role-based routing, not an in-UI toggle.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, iconography (inline SVG), and interactions are all defined. Recreate the UI faithfully using the codebase's libraries. Exact tokens are listed below; when a value isn't listed, read it from the HTML source.

## Roles
- **Ungdom (youth):** home/dashboard, notifications, missions, shop, leaderboard, profile, attendance history, QR check-in with geo-lock, scan-success + level-up celebrations.
- **Ledare (admin/leader):** overview dashboard, publish activity (with map location picker + background theme), manual attendance, manage rewards.

## Screens / Views

### YOUTH — Home / Dashboard
- **Purpose:** At-a-glance status; entry point to scan and shop.
- **Layout:** Vertical scroll, 18px horizontal padding. Header row (greeting + name left; bell button + streak chip right) → level card → 2-up stat/CTA row → "Dagens uppdrag" list (2 items) → "Senaste besök" list (3 items). Fixed bottom nav.
- **Components:**
  - **Header greeting:** "God kväll" (12.5px, #8b7ab8, 500) over name "Elias" (20px, 700, #2c2340).
  - **Bell button:** 40×40, radius 14, white, soft purple shadow; bell SVG in #6c4cf1; unread badge = pink (#ff4d8d) pill top-right with count.
  - **Streak chip:** white pill, fire SVG (#ff7a4d) + count.
  - **Level card:** gradient `linear-gradient(140deg,#6c4cf1,#a24cf1)`, radius 26, white text, floating mascot SVG (Gnista) bottom-right. Contains "NIVÅ 7 · Nivåryttare" (12px, .05em tracking, 85% opacity), pep line (30px/700, max-width 160), XP progress bar (height 12, track rgba(255,255,255,.28), fill #ffd23f, width = xp/xpMax %), "280 XP till nivå 8".
  - **Points card:** white, coin SVG (#6c4cf1) + "1 240" (22px/700, #6c4cf1).
  - **Rewards CTA:** green (#22c55e) card, gift SVG + "Byt poäng", navigates to shop.
  - **Mission rows:** white card buttons, 44px tinted icon tile + title/desc + "+80 XP" (green).
  - **Recent visits:** pin tile + title/date + "+pts" (#6c4cf1).

### YOUTH — Notiser (Notifications)
- **Purpose:** Push notification inbox.
- **Layout:** Back button + "Notiser" title, then list of notification cards.
- **Components:** Card per notif: 42px tinted icon tile, title (13.5/600), body (12px, #8b7ab8), relative time (10.5px, #b3a6d0), unread dot (#ff4d8d, 9px). Unread cards have bg #f6f2ff; read cards white. Opening the screen marks all read.

### YOUTH — Uppdrag (Missions)
- **Purpose:** Missions & weekly challenge.
- **Layout:** "Uppdrag" title → weekly challenge banner (`linear-gradient(135deg,#ff7a4d,#ff4d8d)`, white, progress bar) → mission cards.
- **Mission card:** icon tile + title/desc, progress bar (track #f0ebff, fill = mission `bar` color), progress text, claim button. Button states: **pågår** (bg #f4f2fb, grey text, disabled feel), **redo att lösa in** (green gradient "Lös in +XP"), **inlöst** (bg #f0ebff, "✓ Inlöst"). Claiming adds XP+points and locks the button.

### YOUTH — Butik (Shop)
- **Purpose:** Redeem points for rewards.
- **Layout:** "Butik" title + points chip; 2-column grid of reward cards.
- **Reward card:** 74px tinted media area with large icon, title (13/600), tag (11px), redeem button. Button states: **affordable** (purple gradient, coin + cost), **too expensive** (bg #f4f2fb, muted), **redeemed** (bg #f0ebff, "✓ Uttagen", card opacity .55). Redeeming subtracts cost.

### YOUTH — Topplista (Leaderboard)
- **Purpose:** Weekly ranking, this venue.
- **Layout:** Title + trophy → podium (3 columns, middle = 1st, taller bar) → ranked list rows.
- **Podium:** avatar circle (2nd/3rd = 48px, 1st = 58px), place pill (silver #d7d7e0 / gold #ffd23f / bronze #e6b98a), name, colored bar (1st gold, others #c9bdf0) with points.
- **List row:** rank, avatar, name, points. Current user row highlighted: bg #ede7ff, 2px #6c4cf1 border.

### YOUTH — Profil
- **Purpose:** Identity, stats, badges, attendance entry.
- **Layout:** Centered avatar (96px purple gradient with mascot SVG + level pill) + name + subtitle → 3-up stat cards (points / visits / streak) → "Märken" 4-col badge grid → "Min närvaro" nav button.
- **Badge:** square tinted tile w/ icon + label; locked badges = opacity .4 and greyed icon color.

### YOUTH — Min närvaro (Attendance history)
- **Purpose:** Personal check-in log.
- **Layout:** Title + calendar → 2 stat cards (total visits purple gradient / this-month green) → "Incheckningar" list.
- **Row:** green check tile + title/date + "+pts" (green).

### YOUTH — Checka in (QR scan, geo-locked) — OVERLAY
- **Purpose:** Location-gated QR check-in.
- **Layout (full-screen overlay, bg #171226, white text):** Back button + "Checka in" → stylized map card (158px) → location status card → QR viewfinder → primary CTA + "simulate far away" link.
- **Map:** stylized (park rect #cbe8cd, water blob #bfe0f5, white roads), activity pin (pink #ff4d8d) at %-position, pulsing user dot (#2b6bff, `locpulse` animation).
- **Geo status card:** three states —
  - `searching`: bg #2a2247, locate icon (#7ea6ff), "Letar efter din plats… / Kontrollerar att du är på gården".
  - `inrange`: bg rgba(34,197,94,.22), check icon (#5ef0a0), "Du är på plats / Fritidsgården Centrum · 12 m bort".
  - `far`: bg rgba(255,77,141,.2), pin icon, "Du är för långt bort / 340 m … gå närmare".
- **QR viewfinder:** 150px dark rounded square, checker QR graphic, 4 yellow corner brackets; scanline animation while scanning; opacity .4 until in range.
- **CTA:** in range → yellow gradient "Simulera skanning" (prod: activate camera); not in range → disabled "Väntar på plats…". Link toggles a simulated far/near state (demo only).
- **Behavior:** On open, geo starts `searching`, resolves to `inrange` after ~1.7s (unless toggled far). Scan enabled only when `inrange`. Scan runs ~1.6s then success.
- **Production note:** Replace the simulation with real device geolocation (haversine distance to the activity's stored coordinates, with an accuracy/geofence radius, e.g. 75–150m) AND camera QR decode. The QR encodes the activity/venue id; server validates location + QR + time window before awarding points (never trust the client).

### YOUTH — Incheckad! (Scan success) — OVERLAY
- Full green gradient `linear-gradient(180deg,#22c55e,#16a34a)`, pinging white circle with mascot (`pop`+`ping`), "Incheckad!", venue line, two stat chips "+50 XP" / "+50 poäng" (`count` stagger), "Fortsätt". If the check-in crossed a level threshold, continuing opens Level up.

### YOUTH — Level up — OVERLAY
- Full purple gradient `linear-gradient(180deg,#6c4cf1,#3b1e8f)`, falling **confetti** (44 pieces, `confFall`), "LEVEL UP" (tracking .3em), floating mascot (130px), "Nivå N!", level name, unlocked perk line, "Nice!" button.

### ADMIN — Översikt (Overview)
- **Layout:** Header (venue + "Hej Sara" + avatar) → tab bar (Översikt / Aktiviteter / Närvaro / Belöningar) → 2×2 KPI grid (incheckade idag, poäng utdelade idag, aktiva ungdomar, aktiviteter) → "Snabbåtgärder" list (take attendance / publish activity / manage rewards).

### ADMIN — Aktiviteter (Publish activity)
- **Purpose:** Create an activity with time, points, **map-pinned check-in location**, and a **background theme**.
- **Form (white card):** name input → row(time input + points number) → **Incheckningsplats** map picker → **Bakgrundsmall** theme picker → live preview → "Lägg upp aktivitet".
- **Map picker:** 150px stylized map, `cursor:crosshair`; tapping drops a purple pin at the tapped %-coords (`onMapTap` reads `getBoundingClientRect`, clamps x 6–94 / y 14–96). Status label "Ej satt" → "Plats satt ✓" (green). **Production:** use a real map SDK (MapLibre/Google/Mapbox) and store lat/lng; the check-in geofence uses these coordinates.
- **Theme picker (Bakgrundsmall):** horizontal row of 6 swatches. Each theme = `{id, name, icon, bg gradient, ink text color, accent}`:
  - Fika — coffee — `linear-gradient(135deg,#ffe6c2,#ffb877)` — ink #5a3611 — accent #c07a1e
  - Sport — soccer — `linear-gradient(135deg,#bfe6ff,#5cc0f5)` — ink #0b3a52 — accent #0284c7
  - Skapar — palette — `linear-gradient(135deg,#d9ccff,#a988ff)` — ink #33206b — accent #6c4cf1
  - Gaming — gamepad — `linear-gradient(135deg,#c3f0d0,#4fd67f)` — ink #0d4527 — accent #16a34a
  - Event — sparkles — `linear-gradient(135deg,#ffcfe9,#ff7ac0)` — ink #5c123f — accent #db2777
  - Plugg — book — `linear-gradient(135deg,#fdeeaa,#f6cf4a)` — ink #4d3a02 — accent #caa500
  - Selected swatch: 2.5px #2c2340 ring + white check circle. Each swatch shows the theme icon as a faint bottom-right watermark.
- **Live preview:** a card in the chosen theme (gradient bg, watermark icon at .16 opacity, ink-colored title/meta) reflecting the typed name/time/points.
- **Activity list:** each published activity renders in its theme (gradient bg, watermark icon, ink text), a white-ish icon tile, title, "when · pin place", "+Np", and a "QR aktiv" badge.
- **Behavior:** Publishing requires a name AND a placed pin (else toast). On publish it prepends to the list, resets the form (theme back to `fika`), toasts, and **fires a push notification** to youth ("Ny aktivitet: …").

### ADMIN — Närvaro (Manual attendance)
- **Purpose:** Mark who's present; awards points instantly.
- **Layout:** Context line ("Kvällsfik · idag 18:00 …") → youth rows (avatar, name, monthly-visits sub, mark button).
- **Behavior:** "Markera" → marks present, button becomes green "✓ +30p", increments KPIs (checkedToday +1, awardedToday +30), toasts. **Production:** this awards real points server-side.

### ADMIN — Belöningar (Manage rewards)
- **Form:** name input, icon `<select>` (Bio/event=film, Fika=coffee, Prylar/merch=shirt, Biljett=ticket, Gaming=gamepad), points number, "Lägg till belöning" (green gradient). Prepends to the shared rewards list used by the youth shop.
- **List:** tinted icon tile + title/tag + "Np".

## Interactions & Behavior
- **Navigation:** Youth bottom nav = Hem / Uppdrag / Scan (center FAB) / Butik / Profil (active = opacity 1, inactive .4). Admin uses a top tab bar. Scan/success/level-up are full-screen overlays that hide the nav.
- **Push notifications:** In-app: an incoming push banner slides down from the top (`pushin` animation), auto-dismisses after ~4.2s, tappable → opens Notiser and marks read. A demo push fires ~2.6s after mount. Publishing an activity fires a push. **Production:** wire real push (APNs/FCM / Expo Notifications); the banner is the in-app foreground presentation.
- **Toasts:** dark pill top-center (`toastin`), auto-dismiss ~2.2s, used for claim/redeem/validation/attendance feedback.
- **Animations (all defined as @keyframes in the HTML):** `floaty` (mascot bob), `fillbar` (bars grow from 0), `scanline`, `pop`, `ping`, `rise`, `count`, `confFall` (confetti), `toastin`, `pushin`, `locpulse`. Respect `prefers-reduced-motion` in production.
- **Sound/haptics:** The brief calls for "ljudkänsla". Add short SFX + haptic feedback on scan success and level-up (not in the HTML prototype).

## State Management
Per-user (youth): `points`, `xp`, `xpMax` (1000), `level`, `visits`, `streak`, `missions[] {prog,goal,done}`, `redeemed{}` (reward ids), `notifs[] {unread}`, `attendance[]`, `badges[] {unlocked}`.
Transient/UI: `role`, `screen`, `scan` (idle|scanning|success), `geo` (searching|inrange|far), `far` (demo), `pendingUp`, `gainPts`/`gainXp`, `showUp`, `toast`, `pushBanner`.
Admin/shared: `activities[] {title,when,pts,place,theme, +lat/lng in prod}`, `rewards[] {icon,tint,title,tag,cost}`, `youth[] {present}`, `checkedToday`, `awardedToday`, activity form fields (`fTitle,fWhen,fPts,fTheme,adminPlaced,adminPinX,adminPinY`), reward form fields (`bTitle,bIcon,bCost`).
**Key transitions:** scan→award XP/points (+level up if xp≥xpMax, carry remainder); claim mission→+xp/points, lock; redeem→−cost, mark redeemed; mark present→+30p + KPI bump; publish activity→prepend + push; add reward→prepend to shop.
**Data:** In production, points/level/attendance/leaderboard are server-owned; check-in is validated server-side (QR + geofence + time window) to prevent cheating.

## Design Tokens
**Colors**
- Primary purple: `#6c4cf1`; purple 2 (gradient end): `#a24cf1`; deep purple: `#3b1e8f`
- Ink / text dark: `#2c2340`; muted text: `#8b7ab8` / `#9a8bc0`; faint: `#b3a6d0`
- Success green: `#22c55e` / `#16a34a`; accent orange: `#ff7a4d`; pink: `#ff4d8d`; gold/points: `#ffd23f`; info blue: `#2b6bff` / `#0ea5e9`
- Overlay dark bg: `#171226`; app bg gradient: `radial-gradient(120% 90% at 50% 0%,#efe9ff,#f7eee6 55%,#efe9ff)`; admin bg: `#f4f2fb`
- Card white: `#fff`; tints: purple #ede7ff/#f0ebff, orange #ffe9d6/#fff3e0, green #dcfce7, blue #e0f2fe, red #fee2e2, yellow #fef9c3
- Input border: `#eae4fb`
- Theme gradients & tokens: see ADMIN — Aktiviteter above.

**Typography:** Font family **Fredoka** (Google Fonts, weights 400–700). Sizes: display 30–44px/700, H1 22px/700, card title 13.5–14px/600–700, body 12–13px, meta 10.5–12px, micro 10px.

**Radius:** buttons/tiles 12–14, cards 18–26, chips/pills 20–999, phone screen 36.
**Shadows:** cards `0 12px 26px -18px rgba(108,76,241,.5)`; elevated CTAs use color-matched soft shadows (see source).
**Spacing:** 18px screen padding; 10–14px gaps; nav padding 9px 12px 20px.
**Icon system:** all icons are inline SVG on a 24×24 grid (2px stroke, round caps), no emoji. Names: bell, fire, coin, gift, target, home, bag, user, camera, pin, check, calendar, trophy, map, locate, arrowL, chev, palette, heart, book, soccer, moon, diamond, shirt, ticket, film, gamepad, sparkles, coffee, wrench, status. Recreate as a shared Icon component. Avatars & the "Gnista" mascot are custom SVG (a 4-point yellow star face) — keep them.

## Assets
No external images. Everything is inline SVG (icons, avatars, mascot, stylized map, QR placeholder). The QR graphic is a CSS conic-gradient placeholder — replace with a real QR renderer/scanner. Fonts load from Google Fonts (Fredoka).

## Multi-tenancy (flera föreningar — data får ALDRIG blandas)
Each **förening** (association/venue) is a separate tenant. All data is scoped per förening and must never leak across tenants.

- **Data model:** every domain row (user membership, activity, reward, check-in, points ledger, leaderboard entry, notification) carries a `foreningId`. Every read/write is filtered by the caller's active `foreningId`. Leaderboards, shop and activities are therefore per-förening automatically.
- **Roles:**
  - **Ungdom (youth):** belongs to one or more föreningar; sees only that förening's data. If a member of several, they pick/switch active förening (the prototype shows this as the "byt förening" pill).
  - **Ledare (leader):** scoped to their förening only — publishes activities, takes attendance, manages that förening's rewards.
  - **Kommun / superadmin:** the municipal umbrella. Sees an aggregated overview of ALL föreningar (totals) and can create föreningar and open any one "as leader". Represented by the **Kommun** view in the prototype (summed KPIs + a per-förening list + the explicit "separat data" note).
- **Enforcement is server-side, not client-side.** Use row-level security (e.g. Postgres RLS / Supabase policies) keyed on `foreningId` derived from the authenticated session — never trust a `foreningId` sent from the client. The in-app förening switcher only changes the *active* context; the server must still authorize that the user belongs to that förening.
- **QR & geo-lock carry `foreningId`:** each activity's QR encodes `{foreningId, activityId, venueCoords}`. On check-in the server validates membership + QR + geofence + time window before awarding points, so a scan can never credit the wrong förening.
- **Prototype note:** the role switcher (Ungdom / Ledare / Kommun) and the "byt förening" pill are demo affordances. In production these become real auth + role-based routing + tenant context; the three demo föreningar (Fritidsgården Centrum, Ungdomshuset Norrby, Aktivitetshuset Väster) illustrate scoping.

## Recommended architecture & development path
1. **Client:** React Native / Expo (mobile-first, iOS + Android) — or a React PWA if web-first. Push via Expo Notifications / FCM+APNs. Real map SDK (MapLibre/Mapbox/Google) for the location picker + geofence; camera QR decode (e.g. `expo-camera` / `vision-camera`).
2. **Backend:** an auth + database service with multi-tenant row-level security. **Supabase (Postgres + RLS + Auth + Realtime)** is a fast fit; alternatively a custom Node/Postgres API. Points, levels, leaderboards and check-in validation are **server-owned** to prevent cheating.
3. **Core tables (sketch):** `forening`, `user`, `membership(userId, foreningId, role)`, `activity(foreningId, coords, qrToken, theme, points)`, `checkin(foreningId, userId, activityId, ts, awarded)`, `reward(foreningId, cost)`, `redemption`, `points_ledger(foreningId, userId, delta, reason)`, `notification`. Derive leaderboards from the ledger, scoped by `foreningId` + time window.
4. **Build order suggestion:** auth + membership/tenant context → youth home/dashboard read models → QR check-in (server validation) → points/level engine → missions/rewards → leaderboard → leader tools (publish activity + map pin, manual attendance) → kommun overview → push notifications → polish (animations, sound/haptics, accessibility).
5. Use this bundle's HTML as the visual/interaction spec; implement in the chosen stack's components.

## Files
- `Ungdomsapp.dc.html` — the full interactive prototype (all screens, both roles, animations, icon system). Open in a browser to explore. It is a "Design Component" (`.dc.html`); the markup + a `Component` logic class hold everything. Read the source for any exact value not captured above.
