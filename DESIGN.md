---
name: فريق ريادة التطوعي: Sailor Race
description: A living Gulf sea where five classes race dhows between four islands, read from across a projected room.
colors:
  sea-shallow: "#46cfd9"
  sea-mid: "#1a9cc2"
  sea-deep: "#0b6e88"
  sea-abyss: "#07485e"
  lagoon: "#8ff0dd"
  foam: "#f4fffd"
  rope: "#e9c37a"
  rope-dark: "#a5732f"
  wake-gold: "#ffe08a"
  wake-gold-dark: "#c98a12"
  gold: "#ffd25c"
  gold-hot: "#ffb627"
  sand: "#f2d28b"
  coral: "#ff5d4f"
  ink: "#062a3b"
  ink-2: "#0a3a50"
  paper: "#fff8e8"
  hull-teak: "#8a5527"
  class-1: "#3B82F6"
  class-2: "#EF4444"
  class-3: "#22C55E"
  class-4: "#8B5CF6"
  class-5: "#F97316"
typography:
  display:
    fontFamily: "Baloo Bhaijaan 2, Tajawal, sans-serif"
    fontSize: "clamp(46px, 6vw, 108px)"
    fontWeight: 800
    lineHeight: 1.1
  headline:
    fontFamily: "Baloo Bhaijaan 2, Tajawal, sans-serif"
    fontSize: "clamp(24px, 2.6vw, 46px)"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "Baloo Bhaijaan 2, Tajawal, sans-serif"
    fontSize: "max(15px, calc(clamp(78px, 5.6vw, 124px) * 0.19))"
    fontWeight: 800
    lineHeight: 1.15
  numeral-hero:
    fontFamily: "Tajawal, sans-serif"
    fontSize: "clamp(64px, 9vw, 160px)"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
  numeral:
    fontFamily: "Tajawal, sans-serif"
    fontSize: "0.86em"
    fontWeight: 900
    lineHeight: 1
    fontFeature: "\"tnum\" 1"
rounded:
  control: "14px"
  plaque: "22px"
  card: "40px"
  pill: "999px"
spacing:
  control-gap: "8px"
  edge-inset: "clamp(12px, 1.4vw, 26px)"
components:
  ship-tag:
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "0.1em 0.6em 0.16em"
  buoy-value:
    backgroundColor: "rgba(6, 42, 59, 0.78)"
    textColor: "{colors.sand}"
    rounded: "{rounded.pill}"
    padding: "0.05em 0.55em 0.1em"
  buoy-value-lit:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
  island-plate:
    backgroundColor: "{colors.sand}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.18em 0.85em 0.22em"
  logo-plaque:
    backgroundColor: "rgba(255, 248, 232, 0.92)"
    rounded: "{rounded.plaque}"
    padding: "clamp(8px, 0.7vw, 12px) clamp(12px, 1vw, 18px)"
    width: "clamp(104px, 8.5vw, 160px)"
  icon-button:
    backgroundColor: "rgba(6, 42, 59, 0.6)"
    textColor: "{colors.sand}"
    rounded: "{rounded.control}"
    size: "46px"
  icon-button-hover:
    backgroundColor: "rgba(242, 210, 139, 0.16)"
    textColor: "#ffffff"
  move-button:
    backgroundColor: "{colors.gold-hot}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    padding: "0.55em 1.5em 0.65em"
  arrival-banner:
    backgroundColor: "{colors.ink}"
    textColor: "#ffffff"
    typography: "{typography.headline}"
    rounded: "{rounded.pill}"
    padding: "0.35em 1.1em 0.45em"
  announcement-card:
    backgroundColor: "{colors.ink-2}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
    width: "min(1080px, 84vw)"
---

# Design System: فريق ريادة التطوعي: Sailor Race

## Overview

**Creative North Star: "The Living Gulf"**

The race board is a sunlit Gulf sea that five classes cross in dhows. Water runs from turquoise shallows in the upper corner down to deep teal and abyss, with wave glints drifting over it, cloud shadows sliding across, and lagoons ringing each island. A sand-gold rope marks the route. Coral-and-cream channel buoys carry big numerals, and each dhow flies a lateen sail in its class color. The sea fills the whole viewport. The logo rides on a cream plaque in the top corner, and two quiet controls float in the bottom corner.

The world is built for a projector at the back of a room. Everything is set thick, heavy, and large: 800 to 900 weights, fat strokes, pill-shaped labels on dark or sand grounds, and numerals in tabular figures. The race is read from the ships themselves: every dhow carries a tag with its class name and points, and the leader wears a crown. Spectacle (bobbing hulls, a foam wake, buoy lamps lighting, confetti on arrival) serves the reveal but never competes with the standings. The whole surface is Arabic and right-to-left.

Depth comes from water and light rather than cards: gradients, vignettes, blurred drop shadows under the islands and hulls, and soft glows on everything gold. The surface has no flat panels and no hard offset shadows.

**Key Characteristics:**
- Sea gradient, from turquoise shallows to deep-teal abyss, with drifting glint tiles and cloud shadows, filling the full viewport
- Sand-gold rope route, with the leader's travelled stretch gilded and flowing
- Authored SVG world objects (dhow, buoy, crown, sail chip, coin) instead of emoji or icon fonts
- Heavy rounded Arabic display type (Baloo Bhaijaan 2) over a Tajawal workhorse, with tabular numerals throughout
- Pills for every label that floats over water
- Ships that would overlap sail in an echelon formation, so no class is ever hidden
- Motion runs on transforms only and has a full reduced-motion path

## Colors

A sunlit sea palette: a teal water ramp, sand and gold for the route and for anything that means "earned", coral for the channel buoys, and deep ink for labels and overlays.

### Primary
- **Sunlit Turquoise to Abyss Teal** (sea-shallow, sea-mid, sea-deep, sea-abyss): the board itself, as a 162deg gradient from the shallows (top-left) to the abyss (bottom-right) under a warm sun bloom. Nothing else uses the water ramp as a fill.
- **Lagoon Mint** (lagoon): the shallow halos around islands and the faint outer channel of the route.
- **Sea Foam** (foam): wave glints, the hull wake, waterline foam, and lagoon rings, always at partial opacity.

### Secondary
- **Rope Gold / Rope Shadow** (rope, rope-dark): the full route, an 8-unit rope striped with short rope-shadow twists.
- **Wake Gold / Wake Amber** (wake-gold, wake-gold-dark): the leader's travelled route only. A wake-gold core with a flowing wake-amber twist sits over a blurred gold glow. Wake gold also tops the gradient on the Move Ships button.
- **Treasure Gold** (gold): earned and leading. Points on ship tags, lit buoy lamps and values, the reached-island glow, the crown, emphasized island names in the arrival banner, the announcement points, and the focus ring.
- **Hot Gold** (gold-hot): the lower stop of the Move Ships button and the deepest confetti tone.
- **Beach Sand** (sand): island plates, icon-button glyphs, buoy values at rest, and the unit word on the announcement.

### Tertiary
- **Buoy Coral** (coral): channel buoy bodies, crown jewels, and confetti.

### Neutral
- **Deep Ink** (ink): the page base under the sea, the arrival banner, the icon-button wash, buoy numerals, the nested points pill on ship tags, and text on gold and sand.
- **Raised Ink** (ink-2): the top of the announcement card gradient.
- **Chart Paper** (paper): default text on ink, the logo plaque (at 92%), and the cream band on each buoy.
- **Dhow Teak** (hull-teak): the mid tone of every hull and sail chip. Hulls are always wood and never take a class color, except for the gunwale band.

### Class Colors
- **Class 1 to 5** (class-1 blue, class-2 red, class-3 green, class-4 violet, class-5 orange): fixed by slot (`slot - 1` mod 5). They carry sails, pennants, the gunwale band, ship tags, the sail chip and team ring on the arrival banner, and the bloom, ring, and class pill on the announcement card.

### Named Rules
**The Gold Means Earned Rule.** Gold (treasure, wake, hot) marks only points, the leader, lit progress, and the one call to action. Do not use gold as decoration.

**The Class Owns Its Sail Rule.** Class color lives on canvas and labels (sail, pennant, gunwale band, tag, banner ring) and never on the sea or the route.

## Typography

**Display Font:** Baloo Bhaijaan 2 (with Tajawal, sans-serif), weights 700 and 800
**Body / Numeral Font:** Tajawal (with sans-serif), weights 400 to 900

**Character:** Baloo is round, heavy, and friendly, and it sets every name. Tajawal at 900 sets every number, so names and scores always read as two different voices.

### Hierarchy
- **Display** (800, clamp(46px, 6vw, 108px), 1.1): the student name on the announcement card.
- **Headline** (800, clamp(24px, 2.6vw, 46px), 1.15): the arrival banner and Move Ships button (the button uses the smaller clamp, 20 to 30px).
- **Title** (800, ship width × 0.19 with a 15px floor, 1.15): class names on ship tags. Island plates use the same face and weight at 22px × board factor.
- **Numeral Hero** (Tajawal 900, clamp(64px, 9vw, 160px), 1, tabular): announcement points, with a gold glow.
- **Numeral** (Tajawal 900, 0.86em of its host label, 1, tabular): ship-tag points and island-plate values. Buoy values use Tajawal 800 at 0.32 × buoy size.

### Named Rules
**The Two Voices Rule.** Names in Baloo, numbers in Tajawal with tabular figures. A score never sets in the display face.

**The Back-Row Rule.** No board text is lighter than 800 weight. Running text on the board does not exist.

## Layout

The page is a single full-viewport sea board (100vw × 100vh, overflow hidden, right-to-left). Every map coordinate scales by one board factor, `k = clamp(0.62, min(w/1400, h/880), 1.6)`. Islands, plates, and route strokes derive from it, and buoy size is 72 × k held between 56 and 92px. Ship width is clamp(78px, 5.6vw, 124px), with the floor dropping to 52px when the board is narrower than 700px.

Two pieces of chrome float on the sea at the same edge inset (clamp(12px, 1.4vw, 26px) from the right). The logo plaque sits at the top right, and the fullscreen and settings icon buttons sit at the bottom right with an 8px gap. The Move Ships call to action is centred at the bottom, and the arrival banner is centred at the top.

Ships closer than 1.25 × ship width on screen form a group and sail in an echelon formation. Each member steps across the route by 0.42 × ship width and along it by 0.96 × ship width (0.38 and 0.86 for groups larger than 3), centred on the group. Each group then shifts as a unit to stay inside the board (0.62 × ship width from the sides, 0.72 from the top, 0.42 from the bottom), so spacing inside the formation is preserved.

Layering on the board, bottom to top: glints, clouds, vignette, lagoons, route, buoys, islands, hulls, then tags and crowns (so no class is ever hidden), then the logo and controls, the call to action, the arrival banner, and the announcement overlay.

## Elevation & Depth

Depth is atmospheric and always blurred. The sea gets depth from its gradient, a radial vignette, and cloud shadows. Objects sitting on the water cast soft drop shadows tinted toward deep sea navy (rgba(3, 30, 55, …)). Anything gold also emits a glow. Labels pair a tight contact shadow with a wide ambient one. The board has no hard offset shadows.

### Shadow Vocabulary
- **Island lift** (`filter: drop-shadow(0 14px 14px rgba(3, 35, 60, 0.45))`): island art. Reached islands add `drop-shadow(0 0 18px rgba(255, 210, 92, 0.65))`.
- **Label float** (`box-shadow: 0 3px 8px rgba(0, 0, 0, 0.32), 0 10px 20px rgba(3, 30, 55, 0.4)`): ship tags. Plates use the sand-tinted variant `0 3px 6px rgba(120, 80, 20, 0.45), 0 12px 22px rgba(3, 30, 55, 0.38)`.
- **Team ring** (`box-shadow: 0 0 0 4px var(--team), 0 0 0 8px rgba(6, 42, 59, 0.6), 0 24px 50px rgba(2, 20, 32, 0.55)`): the arrival banner. The announcement card uses 5px, 11px, and 0 40px 90px.
- **Gold call** (`box-shadow: 0 6px 14px rgba(150, 95, 10, 0.55), 0 16px 34px rgba(3, 30, 55, 0.5)`): the Move Ships button, plus a 16px gold pulse ring.

### Named Rules
**The Water Casts Soft Rule.** Every shadow on the board is blurred and tinted toward deep sea navy. Gold things glow instead of casting hard edges.

## Shapes

The board's form language is round and buoyant. Labels that float over water (ship tags, buoy values, island plates, the arrival banner, the class pill, and the Move Ships button) are full pills (999px). Icon buttons use 14px corners, the logo plaque 22px, and the announcement card 40px. Lagoons, clouds, and lagoon rings are ellipses. Borders are almost never drawn as strokes. Edges are inset box-shadow rings at 1 to 2px, or the class-color ring on banners. World objects are hand-drawn SVG with round caps and joins and dark wood or ink outlines.

## Components

### Ship and Ship Tag (signature)
- **Dhow:** a teak hull with a class-color gunwale band, a lateen sail in a class-color gradient (lightened 38% to darkened 32%) with the slot numeral in white Tajawal 900, and a pennant. It bobs at rest (4.4s) and faster while moving (1.6s). Heading turns over 520ms.
- **Sailing:** each move is one continuous ease-in-out-cubic glide along the route curve, driven frame by frame (at least 900ms, longer with distance and the speed setting). The sailing ship scales to 1.14 over 600ms ease-out, rises above the fleet, and shows a broad foam wake (two 9-unit wake lines, an 18-unit foam band, and a translucent fan) and bow spray. Ships at rest settle over 650ms ease-out.
- **Formation:** overlapping ships sail in the echelon described in Layout.
- **Tag:** a class-color pill under the hull with the name in Baloo 800 and the class's points in a nested ink pill (55%) with gold Tajawal 900. Points show the current total directly, without a count-up. Tags render above every hull. The leader wears a floating crown sized 0.4 × ship width.

### Channel Buoy
A coral buoy with a cream band, a 13.5-unit ink numeral, and a lamp. Unlit lamps are slate. Once the leader passes, the lamp turns gold and pulses. The value pill below is ink with sand text, turns gold with ink text when lit, and fades out while a ship sits on that buoy.

### Island Plate
A sand gradient pill (#fff3cf to sand) in ink Baloo 800, with a coin icon and the island's point value in brown Tajawal 900 below.

### Logo
The Riyada volunteer-team logo floats directly on the sea at the top right, with no plaque. Its width is clamp(92px, 6.5vw, 132px), and it takes no pointer events. Instead of a plaque, a thin white halo keeps the navy lettering readable over the water: a 1.5px white drop-shadow, a 5px soft white glow, and a 12px navy cast below.

The logo ships as three stacked transparent layers in `src/assets/riyada/` (base, flag, star):
- The flag waves from its pole on a 1.8s skew.
- The star twinkles with a gold glow on a 3.2s loop.
- A white shine sweeps across every 7s, masked to the logo's own shape.
- On load the logo drops in from a blur once (1100ms), then floats 5px on a 6s loop.
- Reduced motion stops all of these loops.

The registration page header uses `mark.png`, the same mark without its text, at 46px with the same halo.

### Buttons
- **Icon button:** 46px square, 14px corners, a 60% ink wash, sand glyph, and a sand inset hairline. On hover it brightens to a sand tint with a white glyph. On press it scales to 0.94. Glyphs are authored SVG at a 2 to 2.2 stroke. The fullscreen and settings buttons float together at the bottom right at 0.55 opacity, rising to 1 over 200ms on hover or keyboard focus.
- **Move Ships (primary call to action):** a pill with a wake-gold to hot-gold gradient, ink headline text, an anchor icon, and the gold-call shadow with a 2s pulse ring. It lifts 2px on hover and sinks 4px on press. When disabled it desaturates and the pulse stops.
- **Focus:** a 3px gold outline at a 3px offset.

### Arrival Banner and Announcement Card
- **Arrival banner:** an ink pill with a class-color ring, a 44px sail chip, and a headline with the island name in gold. It enters by dropping 40px from a blur (700ms) and leaves upward (380ms), with a confetti burst at the island.
- **Announcement card:** an ink card with 40px corners, a class-color top bloom and ring, the student name in display, the points in numeral-hero gold counting up over 1100ms (ease-out cubic), and a class pill below the points. It rises in sequence (card, name, points pop, pill) over confetti rain.

## Do's and Don'ts

### Do:
- **Do** draw the route as a thick rope (rope with rope-dark twists) over a soft lagoon channel, and gild only the leader's travelled stretch with the wake-gold core, wake-amber twist, and blurred glow.
- **Do** size everything from the board factor `k` so the map holds together from 1366 to 1920 and beyond.
- **Do** set names in Baloo Bhaijaan 2 at 800 and every number in Tajawal with tabular figures.
- **Do** put labels that float over water in pills with the label-float shadow.
- **Do** resolve overlapping ships with the echelon formation and keep every group inside the board, so every hull, sail, and tag stays visible.
- **Do** animate only transform and opacity, and give every looping animation an off switch under prefers-reduced-motion. Confetti is removed entirely.
- **Do** draw world objects as authored SVG with round joins and wood or ink outlines.

### Don't:
- **Don't** draw the route as a thin dashed line on a flat gradient. Dashes belong only inside the rope's twist and the wake lines.
- **Don't** use emoji or icon-font glyphs as markers. Buoys, ships, crowns, and coins are drawn.
- **Don't** use hard, unblurred offset shadows on the board.
- **Don't** use tiny floating labels. Values on the map come in pills scaled from `k`, the buoy size, or the ship width, never below the 56px buoy floor or the 15px ship-tag floor.
- **Don't** fill a hull with a class color, or put class color on the sea or the route.
- **Don't** spend gold on decoration.
