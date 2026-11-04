import { useMemo } from "react";
import { SailChip } from "./icons.tsx";
import { hashSeed, seededRandom, useTweenedNumber } from "./motion.ts";

const FESTIVE = ["#ffd25c", "#ffb627", "#ff5d4f", "#46cfd9", "#f4fffd", "#8ff0dd"];

/** Radial burst of confetti centred on a point (px) inside the board. */
export function ConfettiBurst({ x, y, color, count = 46 }: { x: number; y: number; color: string; count?: number }) {
  const pieces = useMemo(() => {
    const rnd = seededRandom(hashSeed(`burst${color}${count}`));
    return Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + rnd() * 0.4;
        const dist = 90 + rnd() * 170;
        return {
          i,
          w: 7 + rnd() * 8,
          h: 4 + rnd() * 6,
          color: i % 4 === 0 ? color : FESTIVE[i % FESTIVE.length],
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 40 + rnd() * 30,
          rot: (rnd() * 2 - 1) * 540,
          dur: 1.1 + rnd() * 0.8,
          delay: rnd() * 0.25,
        };
      });
  }, [count, color]);
  return (
    <div className="rb-confetti" style={{ left: x, top: y }} aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.i}
          style={{
            width: p.w,
            height: p.h,
            marginLeft: -p.w / 2,
            marginTop: -p.h / 2,
            background: p.color,
            ["--dx" as string]: `${p.dx}px`,
            ["--dy" as string]: `${p.dy}px`,
            ["--rot" as string]: `${p.rot}deg`,
            ["--dur" as string]: `${p.dur}s`,
            ["--delay" as string]: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Confetti falling across the whole viewport. */
function ConfettiRain({ color, count = 70 }: { color: string; count?: number }) {
  const pieces = useMemo(() => {
    const rnd = seededRandom(hashSeed(`rain${color}${count}`));
    return Array.from({ length: count }, (_, i) => ({
        i,
        left: rnd() * 100,
        w: 8 + rnd() * 8,
        h: 5 + rnd() * 7,
        color: i % 3 === 0 ? color : FESTIVE[i % FESTIVE.length],
        sway: (rnd() * 2 - 1) * 120,
        rot: (rnd() * 2 - 1) * 900,
        dur: 2.6 + rnd() * 2.2,
        delay: rnd() * 1.6,
      }));
  }, [count, color]);
  return (
    <div className="rb-rain rb-layer" aria-hidden="true">
      {pieces.map((p) => (
        <i
          key={p.i}
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.h,
            background: p.color,
            ["--sway" as string]: `${p.sway}px`,
            ["--rot" as string]: `${p.rot}deg`,
            ["--dur" as string]: `${p.dur}s`,
            ["--delay" as string]: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export interface ArrivalData {
  key: string;
  teamName: string;
  color: string;
  islandName: string;
  islandIdx: number;
  x: number;
  y: number;
  leaving?: boolean;
}

export function ArrivalCelebration({ arrival }: { arrival: ArrivalData }) {
  const isFinish = arrival.islandIdx === 3;
  return (
    <>
      <ConfettiBurst x={arrival.x} y={arrival.y} color={arrival.color} count={isFinish ? 80 : 50} />
      {isFinish && <ConfettiRain color={arrival.color} />}
      <div
        className={`rb-arrival${arrival.leaving ? " rb-arrival--out" : ""}`}
        style={{ ["--team" as string]: arrival.color }}
        role="status"
      >
        <SailChip color={arrival.color} size={44} />
        <span>
          {arrival.teamName} {isFinish ? "فاز ووصل" : "وصل"} <em>{arrival.islandName}</em>
        </span>
      </div>
    </>
  );
}

function AnnouncementPoints({ value }: { value: number }) {
  const shown = useTweenedNumber(value, 1100);
  const rounded = Math.ceil(shown);
  return <>{rounded > 0 ? `+${rounded.toLocaleString("en-US")}` : rounded.toLocaleString("en-US")}</>;
}

export function StudentAnnouncement({
  studentName,
  teamName,
  teamColor,
  points,
  replay,
}: {
  studentName: string;
  teamName: string;
  teamColor: string;
  points: number;
  replay: boolean;
}) {
  return (
    <div className="rb-ann" style={{ ["--team" as string]: teamColor }} role="status">
      <ConfettiRain color={teamColor} count={56} />
      <div className="rb-ann-card">
        <div className="rb-ann-name">{studentName}</div>
        {replay ? (
          <div className="rb-ann-pts rb-ann-pts--replay">إعادة عرض</div>
        ) : (
          <div className="rb-ann-pts">
            <bdi dir="ltr">
              <AnnouncementPoints value={points} />
            </bdi>
            <span className="rb-ann-unit">نقطة</span>
          </div>
        )}
        <div className="rb-ann-for">
          <span className="rb-ann-team">
            <SailChip color="#ffffff" size={34} />
            {teamName}
          </span>
        </div>
      </div>
    </div>
  );
}
