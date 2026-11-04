# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Audience on the display screen:** students grouped into five classes (فصول) who compete in a sailing race. Inferred from the Apps Script fields (حضور، حفظ، مراجعة، حقيبة، استماع) and the "ربيع القلوب" brand: this looks like a Quran memorization program, not a school. *(Inferred: confirm.)*
- **Operator:** the program supervisor. They run the display from a laptop and use the settings panel to move ships, adjust points, and review the day's entries.

## Product Purpose
Make weekly effort visible and exciting. Students earn points, the class points become distance on a sea route between four islands, and the ships move to show progress. Success means the weekly reveal feels like an event and every student can read their class's standing from across the room.

## Operating Context
- **Confirmed by the user:** the display is shown **once a week**, on a **projector** driven from a **laptop**. It is not a school installation.
- The page runs fullscreen. Projectors wash out thin lines, small text, and low-contrast tones, and the laptop has modest GPU power.
- Students' scores arrive through Google Apps Script (`VITE_APPS_URL`), and live state arrives over WebSocket (`server.ts`). Each score triggers a per-student announcement, and ships move one at a time in slot order.

## Capabilities and Constraints
- Five classes, each in a slot from 1 to 5 with a fixed color by slot. Four islands: الانطلاق، التحدي، التقدم، الفوز. Each square is worth 500 points and every island is 2000 points apart, so the finish is at 6000.
- Ship placement maps points exactly onto the route curve. Game logic, the WebSocket protocol, and the settings panel's operations must stay intact.
- Deployed to GitHub Pages with `bun run build`.

## Brand Commitments
- Name and logo: **ربيع القلوب** (`src/utils/logo.ts`, `public/mawadda-*`).
- Arabic, RTL.
- The four island illustrations in `src/pages/islandData.ts` are existing assets.

## Evidence on Hand
- Real class names and points come from the live sheet. No real student data is committed to the repo, and none may be invented in shipped UI.

## Product Principles
1. Readable from the back of the room first; spectacle second, but spectacle matters.
2. The reveal is the product: motion should build anticipation and pay it off.
3. Never misrepresent a class's points: whatever the screen shows must match the score.
4. Light enough to run smoothly on an ordinary laptop.
