import type { ReactNode } from "react";
import { SailChip } from "./icons.tsx";
import { useTweenedNumber } from "./motion.ts";

export interface TallyEntry {
  id: string;
  name: string;
  slot: number;
  color: string;
  points: number;
}

function TallyPoints({ value }: { value: number }) {
  const shown = useTweenedNumber(value);
  return <>{Math.round(shown).toLocaleString("en-US")}</>;
}

const ISLAND_MARKS = [2000, 4000];

export function Leaderboard({
  entries,
  maxPoints,
  movingId,
  logoSrc,
  footer,
}: {
  entries: TallyEntry[];
  maxPoints: number;
  movingId: string | null;
  logoSrc: string;
  footer: ReactNode;
}) {
  // Ranking follows the points on screen, so it changes as the ships sail.
  // Ties share a rank; slot order breaks visual ties.
  const ranked = [...entries].sort((a, b) => b.points - a.points || a.slot - b.slot);
  const rankOf: Record<string, { index: number; rank: number }> = {};
  ranked.forEach((e, i) => {
    const prev = ranked[i - 1];
    const rank = prev && Math.abs(prev.points - e.points) < 0.5 ? rankOf[prev.id].rank : i + 1;
    rankOf[e.id] = { index: i, rank };
  });
  const leaderPts = ranked[0]?.points ?? 0;

  return (
    <aside className="rb-tally" aria-label="ترتيب الفصول">
      <img className="rb-logo" src={logoSrc} alt="ربيع القلوب" />
      <h2>
        ترتيب الفصول <span aria-hidden="true" />
      </h2>
      <div
        className="rb-rows"
        style={{
          ["--row-h" as string]: "clamp(64px, 10.6vh, 124px)",
          height: `calc(${entries.length} * (clamp(64px, 10.6vh, 124px) + 10px))`,
        }}
      >
        {/* Rows keep DOM order by slot and glide to their rank with a transform. */}
        {entries.map((e) => {
          const { index, rank } = rankOf[e.id];
          const first = rank === 1 && leaderPts > 0;
          const pct = Math.max(0, Math.min(100, (e.points / maxPoints) * 100));
          return (
            <div
              key={e.id}
              className={`rb-row${first ? " rb-row--first" : ""}${movingId === e.id ? " rb-row--moving" : ""}`}
              style={{
                ["--team" as string]: e.color,
                transform: `translateY(calc(${index} * (var(--row-h) + 10px)))`,
              }}
            >
              <div className="rb-rank">{rank}</div>
              <SailChip color={e.color} size={30} label={e.slot} />
              <div className="rb-row-name">{e.name}</div>
              <div className="rb-row-pts">
                <TallyPoints value={e.points} />
              </div>
              <div className="rb-track" aria-hidden="true">
                <div className="rb-track-fill" style={{ transform: `scaleX(${pct / 100})` }} />
                {ISLAND_MARKS.map((m) => (
                  <span
                    key={m}
                    className={`rb-track-tick${e.points >= m ? " rb-track-tick--on" : ""}`}
                    style={{ right: `${(m / maxPoints) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rb-tally-foot">{footer}</div>
    </aside>
  );
}
