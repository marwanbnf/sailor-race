# SPEC

GOAL:    a student or parent watching on the projector or a phone understands in 40 s how effort becomes distance, and wants their class's ship to win.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps, Arabic RTL.
TIME:    42.5 s x 30 = 1275 frames. No music (no catalog sign-in); bundled SFX only.
LOOK:    the board's own medium (DESIGN.md "The Living Gulf"):
         - sea: 162deg gradient #46cfd9 → #1a9cc2 30% → #0b6e88 64% → #07485e, sun bloom rgba(255,252,214,.32) at 16% 6%, vignette 42% at the edges;
           the app's own foam-glint tiles drifting (near tile 360x240 at 0.55, far 220x150 at 0.35);
         - board: captured from the running app at 2x (route rope, buoys, islands, plates);
         - ships, tags, crown, gold wake route, lamps, arrival banner, Move Ships button: ported from the app's code (Dhow.tsx, icons.tsx, display.css);
         - type: Baloo Bhaijaan 2 800 for words (titles 76–96 px, -0 tracking), Tajawal 900 tabular for every number;
         - titles: white #fff8e8 with an ink contact shadow 0 4px 0 rgba(6,42,59,.45) plus 0 12px 34px rgba(3,30,55,.55);
         - gold (#ffd25c / #ffb627) only on points, the leader's crown and route, lit buoys and the Move Ships button.
OBJECTS: dhow (teak hull, lateen sail in the class colour, slot numeral, pennant, foam wake when sailing), points tag (class pill + ink pill with gold number),
         buoy lamp (slate → gold), crown, Riyada logo in its three layers (base, flag, star).
MOTION:  arrivals expo.out / power4.out 0.5–0.9 s; camera power2.inOut 1.2–1.8 s; exits power3.in 0.25 s; ship sail = ease-in-out-cubic along the route curve (as in the app);
         bob 4.4 s cycle at rest, 1.6 s while sailing, scale 1.14 while sailing; titles land and hold still.
SHOTS:   0.0–3.2   hero dhow (slot 3) close on the sea; question line per word; water drifts past.
         3.2–10.6  daily items fly into the tag: الحضور +10, الحفظ +30, المراجعة +30, الاستماع +20, إحضار الحقيبة +10 → 100; class stream → 400; full-attendance bonus +100 → 500.
         10.6–13.4 «كل 500 نقطة… عوّامة إلى الأمام»; the hero dhow shrinks into its place on the board (object becomes the world), the camera pulls back 2.4 → 1, the ship sails to buoy 1 and the lamp lights.
         13.4–21.0 title «سباق السفن»; the camera tours the route: التحدي 2,000 → التقدم 4,000 → الفوز 6,000.
         21.0–31.0 «كل أسبوع… لحظة الكشف»; the cursor presses «تحريك السفن»; ships sail one by one in slot order; the crown hops; فصل 2 reaches جزيرة التحدي (banner + confetti, impact).
         31.0–37.0 benefits, one line at a time over the fleet: team effort, visible effort, the weekly parent report.
         37.0–38.6 claim «كل جهد يقرّبك من جزيرة الفوز» as the camera nears جزيرة الفوز.
         38.6–42.5 end card: the board fades back to sea, the Riyada logo is built layer by layer (base, flag wave, star twinkle), then «سباق السفن».
BANNED:  dark void; glow/particles as decoration (confetti only on the arrival, as in the app); purple/mesh gradients; three cards in a row; a title over a dimmed screenshot;
         the logo docked in a corner; invented student names; text moving after it lands; every line entering the same way.
QA:      1.5 (hook), 6.0 (chips), 10.0 (500), 12.0 (pull back mid-move), 14.5 (title), 18.5 (الفوز), 22.6 (click), 26.4 (arrival), 33.5 (benefit line), 37.8 (claim), 41.5 (end card).

Data note: class names are the app's defaults (فصل 1–5). Points in the reveal are illustrative, not real results.
