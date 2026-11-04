import { memo } from "react";

// Wave-glint tiles: small foam crescents scattered on a repeating tile so the
// drifting layer never shows a seam.
const svgTile = (w: number, h: number, marks: string, stroke: string, sw: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><g fill='none' stroke='${stroke}' stroke-width='${sw}' stroke-linecap='round'>${marks}</g></svg>`,
  )}")`;

const NEAR_TILE = svgTile(
  360,
  240,
  [
    "M18 40 q12 -5 24 0",
    "M120 22 q9 -4 18 0 q9 -4 18 0",
    "M250 60 q14 -6 28 0",
    "M66 118 q10 -4 20 0 q10 -4 20 0",
    "M196 140 q12 -5 24 0",
    "M300 176 q9 -4 18 0",
    "M30 200 q14 -6 28 0",
    "M150 214 q9 -3 18 0",
    "M320 108 q8 -3 16 0",
  ].map((d) => `<path d='${d}'/>`).join(""),
  "rgba(244,255,253,0.75)",
  2.6,
);

const FAR_TILE = svgTile(
  220,
  150,
  [
    "M14 24 q7 -3 14 0",
    "M96 12 q6 -3 12 0",
    "M168 48 q7 -3 14 0",
    "M48 84 q6 -3 12 0 q6 -3 12 0",
    "M136 104 q7 -3 14 0",
    "M200 132 q5 -3 10 0",
    "M20 136 q6 -3 12 0",
  ].map((d) => `<path d='${d}'/>`).join(""),
  "rgba(220,250,255,0.7)",
  1.8,
);

const CLOUDS = [
  { top: "8%", w: "46vw", h: "26vh", dur: 120, delay: -30 },
  { top: "46%", w: "38vw", h: "22vh", dur: 150, delay: -95 },
  { top: "70%", w: "52vw", h: "30vh", dur: 170, delay: -10 },
];

const SPARKLES = [
  { left: "12%", top: "9%", delay: 0 },
  { left: "22%", top: "16%", delay: 1.1 },
  { left: "31%", top: "7%", delay: 2.2 },
  { left: "8%", top: "24%", delay: 0.6 },
  { left: "40%", top: "14%", delay: 1.7 },
];

export const SeaBackdrop = memo(function SeaBackdrop() {
  return (
    <>
      <div className="rb-layer" style={{ zIndex: 0, overflow: "hidden" }}>
        <div className="rb-glints rb-glints--far" style={{ backgroundImage: FAR_TILE }} />
        <div className="rb-glints rb-glints--near" style={{ backgroundImage: NEAR_TILE }} />
      </div>
      <div className="rb-layer" style={{ zIndex: 1, overflow: "hidden" }}>
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            className="rb-cloud"
            style={{
              top: c.top,
              left: 0,
              width: c.w,
              height: c.h,
              animationDuration: `${c.dur}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
        {SPARKLES.map((s, i) => (
          <span key={i} className="rb-sparkle" style={{ left: s.left, top: s.top, animationDelay: `${s.delay}s` }} />
        ))}
      </div>
      <div className="rb-layer rb-vignette" />
    </>
  );
});
