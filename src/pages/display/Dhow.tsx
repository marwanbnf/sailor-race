// A Gulf dhow (sambuk) with a lateen sail in the class colour.
// Drawn bow-right in a 140×120 box; the waterline centre sits at (75, 92).

export const DHOW_VB_W = 140;
export const DHOW_VB_H = 120;
export const DHOW_ANCHOR_X = 75;
export const DHOW_ANCHOR_Y = 92;

function shade(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n.slice(0, 6);
  const v = parseInt(full, 16);
  const mix = (c: number) => {
    const target = amount < 0 ? 0 : 255;
    const t = Math.abs(amount);
    return Math.round(c + (target - c) * t);
  };
  const r = mix((v >> 16) & 255);
  const g = mix((v >> 8) & 255);
  const b = mix(v & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function Dhow({
  color,
  label,
  flip,
  width,
}: {
  color: string;
  label: string | number;
  flip: 1 | -1;
  width: number;
}) {
  const id = color.replace("#", "") + "-" + String(label);
  const light = shade(color, 0.38);
  const deep = shade(color, -0.32);
  const height = (width * DHOW_VB_H) / DHOW_VB_W;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${DHOW_VB_W} ${DHOW_VB_H}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sail-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="0.55" stopColor={color} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <linearGradient id={`hull-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b77b3e" />
          <stop offset="0.5" stopColor="#8a5527" />
          <stop offset="1" stopColor="#4f2d10" />
        </linearGradient>
      </defs>

      {/* wake: trails astern (to the left) while sailing */}
      <g className="rb-wake">
        <path d="M 26 94 L -70 70 L -70 118 Z" fill="rgba(244,255,253,0.18)" />
        <path
          className="rb-wake-line"
          d="M 22 92 Q -14 86 -70 70"
          stroke="rgba(244,255,253,0.95)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path
          className="rb-wake-line"
          d="M 22 96 Q -14 104 -70 118"
          stroke="rgba(244,255,253,0.95)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M 30 94 Q -6 94 -44 95" stroke="rgba(244,255,253,0.55)" strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle className="rb-spray" cx="134" cy="84" r="5.5" fill="#fff" />
        <circle className="rb-spray" cx="140" cy="90" r="4.5" fill="#fff" style={{ animationDelay: "0.3s" }} />
        <circle className="rb-spray" cx="128" cy="80" r="4" fill="#fff" style={{ animationDelay: "0.6s" }} />
      </g>

      {/* shadow and foam at the waterline */}
      <ellipse cx="74" cy="100" rx="62" ry="7" fill="rgba(3,30,55,0.32)" />
      <ellipse cx="74" cy="94" rx="58" ry="4.5" fill="rgba(244,255,253,0.55)" />

      {/* mast (behind the sail) */}
      <path d="M 76 70 L 72 9" stroke="#3d240c" strokeWidth="3.4" strokeLinecap="round" />

      {/* pennant with the class colour */}
      <path className="rb-pennant" d="M 72 8 L 50 4 L 56 10 L 50 16 Z" fill={light} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />

      {/* lateen sail */}
      <g className="rb-sail">
        <path
          d={`M 128 44 L 24 3 Q 26 34 40 62 Q 88 62 128 44 Z`}
          fill={`url(#sail-${id})`}
          stroke="rgba(0,0,0,0.38)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* sail panels */}
        <path d="M 52 14 Q 54 38 62 61" stroke="rgba(255,255,255,0.28)" strokeWidth="1.4" fill="none" />
        <path d="M 80 25 Q 82 44 86 59" stroke="rgba(255,255,255,0.24)" strokeWidth="1.4" fill="none" />
        <path d="M 104 34 Q 106 44 108 53" stroke="rgba(255,255,255,0.2)" strokeWidth="1.4" fill="none" />
        {/* light catching the belly */}
        <path d="M 30 10 Q 34 34 44 56 Q 40 32 30 10 Z" fill="rgba(255,255,255,0.35)" />
        <g transform={`translate(70 40) scale(${flip} 1)`}>
          <text
            x="0"
            y="9"
            textAnchor="middle"
            fontSize="27"
            fontWeight="900"
            fontFamily="Tajawal, sans-serif"
            fill="#fff"
            stroke="rgba(0,0,0,0.45)"
            strokeWidth="3"
            paintOrder="stroke"
          >
            {label}
          </text>
        </g>
      </g>
      {/* yard (spar) */}
      <path d="M 130 45 L 22 2" stroke="#4f2d10" strokeWidth="3.2" strokeLinecap="round" />

      {/* hull */}
      <path
        d="M 8 56 Q 12 66 20 70 L 118 68 Q 130 64 139 52 Q 134 80 114 94 Q 76 100 40 96 Q 18 92 8 56 Z"
        fill={`url(#hull-${id})`}
        stroke="#2e1906"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* class-colour band under the gunwale */}
      <path d="M 14 68 Q 18 72 22 73 L 120 71 Q 128 68 134 62 L 132 70 Q 124 77 118 78 L 26 80 Q 18 78 14 68 Z" fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      {/* planking */}
      <path d="M 26 86 Q 70 90 122 80" stroke="rgba(255,226,180,0.35)" strokeWidth="1.4" fill="none" />
      {/* raised stern deck */}
      <path d="M 14 66 L 13 56 L 40 57 L 42 69 Z" fill="#c99358" stroke="#2e1906" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M 15 56 L 15 50 M 24 56.4 L 24 50.6 M 33 56.7 L 33 51 M 14 50 L 40 51" stroke="#2e1906" strokeWidth="1.5" strokeLinecap="round" />
      {/* bow ornament */}
      <path d="M 136 54 L 140 48" stroke="#2e1906" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
