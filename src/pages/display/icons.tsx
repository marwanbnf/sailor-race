// Authored icon set for the race board: one stroke weight, one corner language.

type IconProps = { size?: number; color?: string };

export function CoinIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="#f5b32a" stroke="#9a6410" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5.2" fill="none" stroke="#fff0b8" strokeWidth="1.4" opacity="0.85" />
      <path d="M6.2 6.4 A5.5 5.5 0 0 1 11.6 4.8" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function CrownIcon({ size = 40 }: IconProps) {
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 50 40" aria-hidden="true">
      <defs>
        <linearGradient id="rb-crown-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.45" stopColor="#ffd25c" />
          <stop offset="1" stopColor="#d18a10" />
        </linearGradient>
      </defs>
      <path
        d="M5 34 L3 12 L15 22 L25 5 L35 22 L47 12 L45 34 Z"
        fill="url(#rb-crown-g)"
        stroke="#7a4a05"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <rect x="5" y="31" width="40" height="6" rx="2" fill="#e8a21c" stroke="#7a4a05" strokeWidth="2.2" />
      <circle cx="25" cy="5" r="3.2" fill="#ff5d4f" stroke="#7a4a05" strokeWidth="1.6" />
      <circle cx="3" cy="12" r="2.6" fill="#46cfd9" stroke="#7a4a05" strokeWidth="1.4" />
      <circle cx="47" cy="12" r="2.6" fill="#46cfd9" stroke="#7a4a05" strokeWidth="1.4" />
      <circle cx="25" cy="25" r="3" fill="#ff5d4f" />
    </svg>
  );
}

export function FullscreenIcon({ size = 22, exit = false }: IconProps & { exit?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {exit ? (
        <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
      ) : (
        <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
      )}
    </svg>
  );
}

export function HelmIcon({ size = 22 }: IconProps) {
  // ship's wheel: settings
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    </svg>
  );
}

export function SailChip({ color, size = 26, label }: { color: string; size?: number; label?: string | number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" className="rb-row-sail">
      <path d="M4 22 L24 22 Q22 26 18 26 L9 26 Q5 26 4 22 Z" fill="#8a5a2b" stroke="#3d240c" strokeWidth="1.2" />
      <path d="M14 2 L14 22" stroke="#3d240c" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14 3 Q24 10 22 20 L14 20 Z" fill={color} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
      <path d="M13 6 Q6 12 6 20 L13 20 Z" fill={color} opacity="0.7" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
      {label !== undefined && (
        <text x="18.2" y="16" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff" fontFamily="Tajawal, sans-serif">
          {label}
        </text>
      )}
    </svg>
  );
}

export function AnchorIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 7.2V21M8 11h8M4 14c0 4 3.6 7 8 7s8-3 8-7" />
    </svg>
  );
}
