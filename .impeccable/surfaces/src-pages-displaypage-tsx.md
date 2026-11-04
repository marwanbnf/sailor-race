---
version: 1
slug: "src-pages-displaypage-tsx"
primary_target: "src/pages/DisplayPage.tsx"
related_targets: []
---

# Display — race board

Scope: `src/pages/DisplayPage.tsx` main board (sea, route, islands, ships, leaderboard, announcements, arrival celebrations). The operator SettingsPanel is out of scope apart from its entry button.
Visitor mode: **Experience**. The room watches the work itself during a weekly projector reveal.
Audience & job: five classes watch their ship advance and want to know "where are we and who's leading" from across the room.
Constraints: projector plus laptop. Use large type and thick strokes, run motion on transforms only, provide a reduced-motion path, and keep every piece of game logic, every point value, and the exact point-to-curve mapping unchanged.
Direction: pinned by the user (5 named upgrades), built code-led as an escalation of the incumbent sea-and-islands world rather than a new identity.

## Direction contract
THESIS: The board is a living Gulf sea that the classes cross in dhows. The race is read from the ships themselves and from one harbor tally. It refuses the flat gradient with a dashed line, the emoji markers, and the tiny floating labels.
OWN-WORLD: Sunlit turquoise-to-deep-teal water with drifting wave glints, cloud shadows, and shallow lagoons ringing each island. Sand-gold rope route with a lit "wake of the leader". Coral and white channel buoys carry big numerals. Each dhow has a lateen sail in its class color, and the type is rounded heavy Arabic (Baloo Bhaijaan 2) with Tajawal as the workhorse. A deep-ink harbor board sits on the right.
STORY: The room sees the whole route and every ship, reads the ranking at a glance, and cheers when a ship moves, overtakes, or lands on an island.
FIRST VIEWPORT: The map takes ~78% width on the left with the four islands and the full route. The right-hand strip holds the logo, then the ranked tally (rank, sail chip, name, points, progress to 6000), with discreet fullscreen and settings controls at its foot.
FORM: brief-pinned (no concept-seed roll); signature interaction = ship sails with heading-aware hull, wake and spray, buoys light as it passes, tally rows re-rank by FLIP, island arrival fires a named celebration banner and burst.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
