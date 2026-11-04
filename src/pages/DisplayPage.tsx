import { useEffect, useState, useMemo, useRef } from "react";
import { ISLAND_IMAGES, ISLAND_NAMES } from "./islandData.ts";
import { AdminPanelEmbed } from "./AdminPanelEmbed.tsx";
import * as wsClient from "../websocket/websocketClient.ts";
import { LOGO_B64 } from "../utils/logo.ts";
import "@fontsource/baloo-bhaijaan-2/700.css";
import "@fontsource/baloo-bhaijaan-2/800.css";
import "@fontsource/tajawal/400.css";
import "@fontsource/tajawal/700.css";
import "@fontsource/tajawal/800.css";
import "@fontsource/tajawal/900.css";
import "./display/display.css";
import { SeaBackdrop } from "./display/SeaBackdrop.tsx";
import { Dhow, DHOW_ANCHOR_X, DHOW_ANCHOR_Y, DHOW_VB_H, DHOW_VB_W } from "./display/Dhow.tsx";
import { Leaderboard, TweenedPoints } from "./display/Leaderboard.tsx";
import { ArrivalCelebration, StudentAnnouncement, type ArrivalData } from "./display/Celebrations.tsx";
import { AnchorIcon, CoinIcon, CrownIcon, FullscreenIcon, HelmIcon } from "./display/icons.tsx";


// ── Types ──────────────────────────────────────────────────────────────
type Position = { x: number; y: number };
type DisplayVersion = 1 | 2 | 3;
type TeamId = string;

interface Team {
  id: TeamId;
  points: number;
  roundPoints?: number;
  /**
   * Canonical board position received from the server.
   * New values written by this screen are stored in square-index units:
   * 0 = start, 1 = 50 points, 4 = 200 points.
   */
  position?: number;
  name?: string;
  color?: string;
  sheetId?: number;
  slot?: number;
  version?: DisplayVersion;
  displayVersion?: DisplayVersion;
}

interface QueuedMove extends Team {
  prevPosition: number;
  position: number;
}

interface AnnouncementData {
  id?: string;
  studentName: string;
  /** Actual delta carried by the server event. */
  points: number;
  /** Points that should be shown in the announcement card. */
  displayPoints?: number;
  displayOnly?: boolean;
  teamColor: string;
  teamName: string;
  /** نسخة العرض محفوظة للتوافق، والنظام الحالي يستخدم نسخة واحدة فقط. */
  version?: number;
}

interface PendingPositions {
  [teamId: string]: number;
}

interface TodayEntry {
  studentName: string;
  points: number;
  hudur?: string;
  hifzScore?: string | number;
  muraScore?: string | number;
  haqiba?: string;
  istima?: string;
}

// ── Constants ──────────────────────────────────────────────────────────
interface SchoolClass {
  id: string;
  classId: string;
  name: string;
  className: string;
  sheetId: number;
  slot: number;
  version: DisplayVersion;
  displayVersion: DisplayVersion;
  students?: string[];
}

const CLASS_COLOR_PALETTE = [
  "#3B82F6", // أزرق
  "#EF4444", // أحمر
  "#22C55E", // أخضر
  "#8B5CF6", // بنفسجي
  "#F97316", // برتقالي
  "#06B6D4", // سماوي
  "#14B8A6", // تركوازي
  "#D97706", // ذهبي غامق
] as const;

function classColorBySlot(slot?: number, _version?: number): string {
  const safeSlot = Number(slot || 0);
  const localIndex = Math.max(0, safeSlot - 1);
  return CLASS_COLOR_PALETTE[localIndex % 5];
}

function compareTeamsBySlot(a: Team, b: Team): number {
  const aSlot = Number.isFinite(Number(a.slot)) ? Number(a.slot) : Number.MAX_SAFE_INTEGER;
  const bSlot = Number.isFinite(Number(b.slot)) ? Number(b.slot) : Number.MAX_SAFE_INTEGER;
  return aSlot - bSlot;
}

function getTeamColor(team?: Team | null): string {
  if (!team) return CLASS_COLOR_PALETTE[0];
  return classColorBySlot(team.slot, team.version ?? team.displayVersion);
}

const DISPLAY_EVENT_STORAGE_KEY = "sailor-race:display-event";
const DISPLAY_EVENT_CHANNEL = "sailor-race-display-events";
const APPS_SCRIPT_URL = String(import.meta.env.VITE_APPS_URL || "");

function getRiyadhDateISO(offsetDays = 0): string {
  // «اليوم الدراسي» يبدأ الساعة 6:00 صباحاً بتوقيت السعودية — نفس منطق صفحة التسجيل:
  // قبل 6 صباحاً نعرض بيانات أمس الدراسي، وبعده تبدأ جلسة اليوم الجديد.
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);

  const year = parts.find((p) => p.type === "year")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function formatHistoryDateLabel(dateValue: string): string {
  if (!dateValue) return "";
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!year || !month || !day) return dateValue;
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "Asia/Riyadh",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

const SQUARES_PER_SEGMENT = 4;
const TOTAL_POSITIONS = SQUARES_PER_SEGMENT * 3 + 1;
const ISLAND_INDICES = [0, 4, 8, 12];
const ISLAND_SIZES = [150, 150, 140, 170];

// Reference layout: start/challenge across the top, progress/win across the bottom.
const ISLANDS_POS: Position[] = [
  { x: 10, y: 18 },
  { x: 95, y: 39 },
  { x: 5, y: 71 },
  { x: 94, y: 82 },
];

const SEGMENTS: Record<string, Position>[] = [
  { cp1: { x: 52, y: 2 }, cp2: { x: 58, y: 18 } },
  { cp1: { x: 80, y: 46 }, cp2: { x: 20, y: 52 } },
  { cp1: { x: 42, y: 72 }, cp2: { x: 52, y: 78 } },
];

// ── Helper Functions ───────────────────────────────────────────────────
function cubicBezier(
  t: number,
  p0: Position,
  p1: Position,
  p2: Position,
  p3: Position,
): Position {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,
    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function getPathPositions(): Position[] {
  const pos: Position[] = [];
  for (let seg = 0; seg < 3; seg++) {
    if (seg === 0) pos.push(ISLANDS_POS[0]);
    for (let j = 1; j <= SQUARES_PER_SEGMENT; j++)
      pos.push(
        cubicBezier(
          j / SQUARES_PER_SEGMENT,
          ISLANDS_POS[seg],
          SEGMENTS[seg].cp1,
          SEGMENTS[seg].cp2,
          ISLANDS_POS[seg + 1],
        ),
      );
  }
  return pos;
}

// ── Board pixel geometry (visual layout only) ─────────────────────────
type BoardSize = { w: number; h: number };
const BOARD_PAD_X = 0.07;
const BOARD_PAD_Y = 0.085;

function boardPoint(p: Position, size: BoardSize): Position {
  const px = size.w * BOARD_PAD_X;
  const py = size.h * BOARD_PAD_Y;
  return {
    x: px + (p.x / 100) * (size.w - 2 * px),
    y: py + (p.y / 100) * (size.h - 2 * py),
  };
}

// Direction of travel (in px) at a square-index on the route.
function indexToTangent(index: number, size: BoardSize): Position {
  const maxIndex = TOTAL_POSITIONS - 1;
  const clamped = Math.max(0, Math.min(index, maxIndex));
  const seg = Math.min(Math.floor(clamped / SQUARES_PER_SEGMENT), SEGMENTS.length - 1);
  const t = (clamped - seg * SQUARES_PER_SEGMENT) / SQUARES_PER_SEGMENT;
  const p0 = ISLANDS_POS[seg];
  const p1 = SEGMENTS[seg].cp1;
  const p2 = SEGMENTS[seg].cp2;
  const p3 = ISLANDS_POS[seg + 1];
  const mt = 1 - t;
  const dx = 3 * mt * mt * (p1.x - p0.x) + 6 * mt * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const dy = 3 * mt * mt * (p1.y - p0.y) + 6 * mt * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const sx = (size.w * (1 - 2 * BOARD_PAD_X)) / 100;
  const sy = (size.h * (1 - 2 * BOARD_PAD_Y)) / 100;
  const vx = dx * sx;
  const vy = dy * sy;
  const len = Math.hypot(vx, vy) || 1;
  return { x: vx / len, y: vy / len };
}

// Route polyline in px from square-index 0 up to `upTo`.
function routePathD(size: BoardSize, upTo: number): string {
  const end = Math.max(0, Math.min(upTo, TOTAL_POSITIONS - 1));
  if (end <= 0) return "";
  const steps = Math.max(2, Math.ceil(end * 14));
  const pathPositions = getPathPositions();
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const idx = (end * i) / steps;
    const p = boardPoint(indexToExactPos(idx, pathPositions), size);
    d += `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
  }
  return d;
}

// Each board interval is worth 500 points.
// Four intervals separate every two islands: 4 × 500 = 2000 points.
const POINTS_PER_SQUARE = 500;
const POSITION_EPSILON = 0.0001;
const MOVE_STEP_INDEX = 0.15; // خمس عشر مربع لكل خطوة: حركة أدق وأكثر سلاسة
const DEFAULT_MOVE_STEP_MS = 230;
const MIN_MOVE_STEP_MS = 140;
const MAX_MOVE_STEP_MS = 400;
const IDLE_TRANSITION_MS = 140;
const DEBUG_SHIP_POSITIONS = true;
const SHIP_SPEED_OPTIONS = [
  { label: "سريع", description: "حركة نشيطة", stepMs: 180, icon: "⚡" },
  { label: "متوازن", description: "مناسب للمسابقة", stepMs: 230, icon: "⛵" },
  { label: "هادئ", description: "أوضح للمتابعة", stepMs: 300, icon: "🌊" },
] as const;

function normalizeMoveStepMs(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MOVE_STEP_MS;
  return Math.round(Math.min(MAX_MOVE_STEP_MS, Math.max(MIN_MOVE_STEP_MS, numeric)));
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function formatPoints(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return Math.ceil(safeValue).toLocaleString();
}

// Continuous (possibly fractional) index along the path for a given points
// value, clamped to the available squares. This is the exact mapping the
// board uses: 30 => 0.6, 50 => 1, 200 => 4, 720 => 14.4.
function pointsToIndex(pts: number): number {
  const maxIndex = TOTAL_POSITIONS - 1;
  const safePts = Number.isFinite(pts) ? pts : 0;
  return Math.max(0, Math.min(safePts / POINTS_PER_SQUARE, maxIndex));
}

function indexToPoints(index: number): number {
  return index * POINTS_PER_SQUARE;
}

// Converts a value that may have been saved by an older version as raw points
// into the canonical square-index value used by the renderer.
// Examples:
//   4    => 4   (already square-index, meaning 2000 pts)
//   0.6  => 0.6 (already square-index, meaning 300 pts)
//   2000 => 4   (legacy/raw points)
//   300  => 0.6 (legacy/raw points)
function storedPositionToIndex(
  rawPosition: number | undefined,
  fallbackPoints?: number,
): number {
  const raw = Number(rawPosition ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  const maxIndex = TOTAL_POSITIONS - 1;
  const safeFallbackPoints = Number(fallbackPoints ?? NaN);

  // أي قيمة أكبر من آخر موضع في المسار لا يمكن أن تكون رقم مربع، إذن هي نقاط خام.
  if (raw > maxIndex) return pointsToIndex(raw);

  // مهم جداً للقيم الأقل من 50:
  // إذا كان السيرفر خزّن position كنقاط، والـ points لنفس الفريق تساوي نفس الرقم،
  // فلا نعاملها كرقم مربع بل نحوّلها حسب قيمة 500 نقطة للمربع.
  if (
    Number.isFinite(safeFallbackPoints) &&
    Math.abs(raw - safeFallbackPoints) <= POSITION_EPSILON &&
    Math.abs(raw - pointsToIndex(safeFallbackPoints)) > POSITION_EPSILON
  ) {
    return pointsToIndex(raw);
  }

  // غير ذلك نعتبرها قيمة حديثة بصيغة رقم مربع كسري:
  // 0.6 => بين 0 و1، و4 => مربع 4، و8.5 => بين 8 و9.
  return Math.max(0, Math.min(raw, maxIndex));
}

// Computes the exact {x, y} location on the path for a given points value,
// using the same Bézier curve as the visible dashed path.
function pointsToExactPos(pts: number, pathPositions: Position[]): Position {
  const index = pointsToIndex(pts);
  return indexToExactPos(index, pathPositions);
}

// Computes the exact {x, y} location on the path for a square-index value.
function indexToExactPos(index: number, pathPositions: Position[]): Position {
  const maxIndex = pathPositions.length - 1;
  const clampedIndex = Math.max(0, Math.min(index, maxIndex));

  // المسار مكوّن من 3 منحنيات، وكل منحنى فيه 4 فواصل × 500 = 2000 نقطة بين كل جزيرتين.
  // بدلاً من خط مستقيم بين علامتين، نحسب موقع السفينة على نفس cubicBezier
  // المستخدم لرسم الخط الأصفر، لذلك 500 يقف فوق أول مربع تماماً،
  // و1000 يقف فوق المربع الثاني على المنحنى.
  const squaresPerSegment = SQUARES_PER_SEGMENT;
  const seg = Math.min(
    Math.floor(clampedIndex / squaresPerSegment),
    SEGMENTS.length - 1,
  );
  const localT = (clampedIndex - seg * squaresPerSegment) / squaresPerSegment;

  return cubicBezier(
    localT,
    ISLANDS_POS[seg],
    SEGMENTS[seg].cp1,
    SEGMENTS[seg].cp2,
    ISLANDS_POS[seg + 1],
  );
}

// No visual offset is applied: the rendered ship center is exactly the
// mathematical location of its points on the path.
function calcShipOffset(
  team: Team,
  allTeams: Team[],
  posOf: (t: Team) => number,
): { ox: number; oy: number; ptsNudge: number } {
  void team;
  void allTeams;
  void posOf;

  // لا نضيف أي إزاحة بصرية. موقع السفينة يجب أن يكون هو موقع نقاطها 100%.
  // إذا فريقان عند 300 نقطة فسيكونان فوق بعض بالضبط على مربع 300.
  // وإذا الفرق 10 نقاط فقط، فالفرق الطبيعي سيكون 10/50 = 0.2 مربع
  // بدون تفريق صناعي يبعد السفينة عن المسار.
  return { ox: 0, oy: 0, ptsNudge: 0 };
}

// تسجيل أقدم من هذا لا يُعرض كإعلان جديد (مثلاً بعد فتح الصفحة أو إعادة الاتصال).
const DISPLAY_EVENT_MAX_AGE_MS = 60_000;

function isStaleDisplayEvent(createdAt: unknown): boolean {
  const ts = typeof createdAt === "number" ? createdAt : Date.parse(String(createdAt ?? ""));
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts > DISPLAY_EVENT_MAX_AGE_MS;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function callAppsScriptJsonp(
  url: string,
  action: string,
  params: Record<string, string> = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!url.includes("script.google.com")) {
      reject(new Error("رابط Apps Script غير مضبوط في VITE_APPS_URL"));
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("لا يمكن تنفيذ العملية من هذا المتصفح"));
      return;
    }

    const callbackName = `__sailorDisplay_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;
    let timer: number | undefined;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (timer !== undefined) window.clearTimeout(timer);
      delete (window as any)[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("انتهت مهلة تحميل التسجيلات"));
    }, 15000);

    (window as any)[callbackName] = (payload: any) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("تعذر الاتصال بـ Google Sheets"));
    };

    const query = new URLSearchParams({
      action,
      callback: callbackName,
      _: String(Date.now()),
      ...params,
    });

    const separator = url.includes("?") ? "&" : "?";
    script.src = `${url}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}

// ── Sub-components ─────────────────────────────────────────────────────
function SettingsPanel({
  teams,
  onClose,
  currentPositions,
  shipMoveStepMs,
  onChangeShipSpeed,
  onMovePending,
  onAdjustPoints,
  onResetAll,
}: {
  teams: Team[];
  onClose: () => void;
  currentPositions: Record<string, number>;
  shipMoveStepMs: number;
  onChangeShipSpeed: (stepMs: number) => void;
  onMovePending: (
    pending: PendingPositions,
    divisors: Record<string, number>,
  ) => void;
  onAdjustPoints: (teamId: TeamId, amount: number) => void;
  onResetAll: () => void;
}) {
  const [tab, setTab] = useState<"move" | "adjust" | "today" | "admin">("move");
  const [divisors, setDiv] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    teams.forEach((t) => (d[t.id] = ""));
    return d;
  });
  const [adjusts, setAdj] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    teams.forEach((t) => (d[t.id] = ""));
    return d;
  });
  const [calcDone, setCalcDone] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [todayTeam, setTodayTeam] = useState<TeamId>(teams[0]?.id || "");
  const [selectedEntriesDate, setSelectedEntriesDate] = useState(() => getRiyadhDateISO(0));
  const [todayEntries, setTodayEntries] = useState<TodayEntry[]>([]);
  const [todayDate, setTodayDate] = useState("");
  const [todayLoading, setTodayLoading] = useState(false);
  const [todayError, setTodayError] = useState("");

  useEffect(() => {
    if (teams.length === 0) {
      if (todayTeam) setTodayTeam("");
      return;
    }
    if (!todayTeam || !teams.some((team) => team.id === todayTeam)) {
      setTodayTeam([...teams].sort(compareTeamsBySlot)[0].id);
    }
  }, [teams, todayTeam]);

  const loadTodayEntries = async (
    teamId: TeamId = todayTeam,
    dateValue: string = selectedEntriesDate,
  ) => {
    setTodayLoading(true);
    setTodayError("");
    try {
      const result = await callAppsScriptJsonp(APPS_SCRIPT_URL, "getTodayEntries", {
        teamId,
        date: dateValue,
      });
      if (result?.status === "error") throw new Error(result.message || "تعذر تحميل التسجيلات");
      setTodayEntries(Array.isArray(result?.entries) ? result.entries : []);
      setTodayDate(String(result?.date || dateValue));
    } catch (err: any) {
      setTodayEntries([]);
      setTodayError(err?.message || "تعذر تحميل التسجيلات");
    } finally {
      setTodayLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "today") return;
    loadTodayEntries(todayTeam, selectedEntriesDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, todayTeam, selectedEntriesDate]);

  const handleDone = () => {
    const pending: PendingPositions = {};
    const divisorValues: Record<string, number> = {};

    teams.forEach((t) => {
      const rawRoundPoints = Number(t.roundPoints ?? 0);
      // القاسم الذي أدخله المعلم — إذا تُرك فارغاً يُستخدم 1 (بلا قسمة)
      const divisor = Math.max(1, Number(divisors[t.id]) || 1);
      // النقاط بعد المتوسط: نقرّب أي كسر للأعلى دائماً (مثال: 111.11 => 112)
      const effectivePts = Math.ceil(rawRoundPoints / divisor);
      // نستخدم الموضع الظاهر الحالي أولاً حتى لا تضيع القيم الكسرية مثل 0.6
      const currentIndex =
        currentPositions[t.id] ?? storedPositionToIndex(t.position, t.points);
      const deltaIndex = pointsToIndex(effectivePts);
      const nextIndex = Math.max(
        0,
        Math.min(currentIndex + deltaIndex, TOTAL_POSITIONS - 1),
      );

      pending[t.id] = nextIndex;
      divisorValues[t.id] = divisor;

      console.log("[MoveCalc]", {
        team: t.id,
        rawRoundPoints,
        divisor,
        effectivePts,
        currentIndex: round3(currentIndex),
        deltaIndex: round3(deltaIndex),
        nextIndex: round3(nextIndex),
        expectedSquareFromEffectivePts: round3(
          effectivePts / POINTS_PER_SQUARE,
        ),
        targetPointLabel: round3(indexToPoints(nextIndex)),
      });
    });

    onMovePending(pending, divisorValues);
    setCalcDone(true);
  };

  const handleAdjust = (teamId: TeamId, sign: 1 | -1) => {
    const val = parseInt(adjusts[teamId]) || 0;
    if (val <= 0) return;
    onAdjustPoints(teamId, val * sign);
  };

  const displayName = (t: Team) => t.name || `فصل ${t.slot || ""}`;

  const TAB = (active: boolean) => ({
    flex: "1 1 30%",
    minWidth: 90,
    padding: "10px 4px",
    borderRadius: 12,
    border: "none",
    cursor: "pointer",
    fontSize: "clamp(11px,3vw,13px)",
    fontFamily: "'Tajawal',sans-serif",
    fontWeight: active ? 800 : 400,
    background: active
      ? "linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.12))"
      : "rgba(255,255,255,0.06)",
    color: active ? "#fff" : "rgba(255,255,255,0.45)",
    boxShadow: active
      ? "0 3px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.24)"
      : "none",
    whiteSpace: "nowrap",
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(2,6,23,0.94)",
        backdropFilter: "blur(14px)",
        animation: "fadeIn 0.2s ease-out",
        padding: "10px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,#1e293b,#0f172a)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 26,
          padding: "22px 16px",
          width: "100%",
          maxWidth: 430,
          maxHeight: "94vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          direction: "rtl",
          fontFamily: "'Tajawal',sans-serif",
          boxShadow: "0 30px 70px rgba(0,0,0,0.8)",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: "rgba(255,255,255,0.07)",
            border: "none",
            color: "rgba(255,255,255,0.4)",
            borderRadius: "50%",
            width: 30,
            height: 30,
            cursor: "pointer",
            fontSize: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ✕
        </button>
        <h3
          style={{
            color: "#fff",
            fontSize: 17,
            fontWeight: 800,
            marginBottom: 14,
            textAlign: "center",
          }}
        >
          ⚙️ الإعدادات
        </h3>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 18,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 14,
            padding: 4,
          }}
        >
          <button className="smooth-btn" style={TAB(tab === "move")} onClick={() => setTab("move")}>
            🚢 تحريك السفن
          </button>
          <button
            className="smooth-btn"
            style={TAB(tab === "adjust")}
            onClick={() => setTab("adjust")}
          >
            ✏️ تعديل النقاط
          </button>
          <button className="smooth-btn" style={TAB(tab === "today")} onClick={() => setTab("today")}>
            📅 التسجيلات حسب التاريخ
          </button>
          <button className="smooth-btn" style={TAB(tab === "admin")} onClick={() => setTab("admin")}>
            📋 لوحة التحكم
          </button>
        </div>

        {tab === "move" && (
          <div>
            <div
              style={{
                padding: 12,
                marginBottom: 14,
                borderRadius: 16,
                border: "1px solid rgba(56,189,248,0.24)",
                background:
                  "linear-gradient(145deg,rgba(14,116,144,0.18),rgba(255,255,255,0.045))",
              }}
            >
              <div
                style={{
                  color: "#e0f2fe",
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 9,
                  textAlign: "center",
                }}
              >
                🚢 سرعة حركة السفن
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                  gap: 7,
                }}
              >
                {SHIP_SPEED_OPTIONS.map((option) => {
                  const selected = shipMoveStepMs === option.stepMs;
                  return (
                    <button
                      key={option.stepMs}
                      type="button"
                      className="smooth-btn"
                      aria-pressed={selected}
                      onClick={() => onChangeShipSpeed(option.stepMs)}
                      style={{
                        minWidth: 0,
                        padding: "10px 4px 8px",
                        borderRadius: 12,
                        cursor: "pointer",
                        fontFamily: "'Tajawal',sans-serif",
                        background: selected
                          ? "linear-gradient(180deg,#38bdf8,#0369a1)"
                          : "rgba(255,255,255,0.055)",
                        color: selected ? "#fff" : "rgba(255,255,255,0.62)",
                        border: selected
                          ? "1.5px solid rgba(125,211,252,0.8)"
                          : "1.5px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <span style={{ display: "block", fontSize: 17, lineHeight: 1 }}>
                        {option.icon}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 900,
                          marginTop: 5,
                        }}
                      >
                        {option.label}
                      </span>
                      <span
                        style={{
                          display: "block",
                          fontSize: 8.5,
                          fontWeight: 700,
                          opacity: 0.68,
                          marginTop: 2,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              اكتب الرقم الذي تريد قسمة نقاط كل فريق عليه
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {teams.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${getTeamColor(t)}33`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 3,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: getTeamColor(t),
                          boxShadow: `0 0 6px ${getTeamColor(t)}`,
                        }}
                      />
                      <span
                        style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}
                      >
                        {displayName(t)}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "#fde047",
                        fontSize: 12,
                        fontWeight: 600,
                        paddingRight: 17,
                      }}
                    >
                      {(t.roundPoints ?? 0).toLocaleString()} نقطة
                    </div>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={divisors[t.id]}
                    onChange={(e) =>
                      setDiv((p) => ({ ...p, [t.id]: e.target.value }))
                    }
                    placeholder="÷"
                    style={{
                      width: 68,
                      background: "rgba(255,255,255,0.08)",
                      border: `1.5px solid ${getTeamColor(t)}66`,
                      borderRadius: 10,
                      color: "#fff",
                      fontSize: 18,
                      fontWeight: 700,
                      padding: "8px",
                      outline: "none",
                      fontFamily: "'Tajawal',sans-serif",
                      textAlign: "center",
                    }}
                  />
                </div>
              ))}
            </div>
            {!calcDone ? (
              <button
                onClick={handleDone}
                className="smooth-btn btn-shine"
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 16,
                  border: "none",
                  position: "relative",
                  overflow: "hidden",
                  background: "linear-gradient(180deg,#6366f1,#4f46e5)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 900,
                  cursor: "pointer",
                  fontFamily: "'Tajawal',sans-serif",
                  boxShadow:
                    "0 6px 22px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                ✔ احسب المواضع الجديدة
              </button>
            ) : (
              <div
                style={{
                  padding: "12px",
                  borderRadius: 12,
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#4ade80",
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ✅ اضغط زر "تحريك السفن" على الشاشة
              </div>
            )}
          </div>
        )}

        {tab === "adjust" && (
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              اكتب عدد النقاط ثم اضغط + أو −
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              {teams.map((t) => (
                <div
                  key={t.id}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${getTeamColor(t)}33`,
                    borderRadius: 14,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        marginBottom: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: getTeamColor(t),
                          boxShadow: `0 0 6px ${getTeamColor(t)}`,
                        }}
                      />
                      <span
                        style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}
                      >
                        {displayName(t)}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "#fde047",
                        fontSize: 11,
                        paddingRight: 17,
                      }}
                    >
                      {t.points.toLocaleString()} نقطة
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={adjusts[t.id]}
                    onChange={(e) =>
                      setAdj((p) => ({ ...p, [t.id]: e.target.value }))
                    }
                    placeholder="0"
                    style={{
                      width: 70,
                      background: "rgba(255,255,255,0.08)",
                      border: "1.5px solid rgba(255,255,255,0.15)",
                      borderRadius: 10,
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 700,
                      padding: "7px",
                      outline: "none",
                      fontFamily: "'Tajawal',sans-serif",
                      textAlign: "center",
                    }}
                  />
                  <div style={{ display: "flex", gap: 5 }}>
                    <button
                      onClick={() => handleAdjust(t.id, 1)}
                      className="smooth-btn"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        border: "none",
                        background:
                          "linear-gradient(180deg,rgba(34,197,94,0.45),rgba(21,128,61,0.35))",
                        color: "#4ade80",
                        fontSize: 18,
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow:
                          "0 3px 10px rgba(34,197,94,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }}
                    >
                      +
                    </button>
                    <button
                      onClick={() => handleAdjust(t.id, -1)}
                      className="smooth-btn"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        border: "none",
                        background:
                          "linear-gradient(180deg,rgba(239,68,68,0.45),rgba(185,28,28,0.35))",
                        color: "#f87171",
                        fontSize: 18,
                        fontWeight: 900,
                        cursor: "pointer",
                        boxShadow:
                          "0 3px 10px rgba(239,68,68,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                      }}
                    >
                      −
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "today" && (
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 12,
                marginBottom: 12,
                textAlign: "center",
                lineHeight: 1.7,
              }}
            >
              اختر التاريخ والحلقة لعرض النقاط التي سُجلت للطلاب في ذلك اليوم
            </p>

            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 14,
                padding: 10,
                marginBottom: 12,
              }}
            >
              <label
                style={{
                  display: "block",
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 12,
                  fontWeight: 800,
                  marginBottom: 7,
                }}
              >
                📆 اختر التاريخ
              </label>
              <input
                type="date"
                value={selectedEntriesDate}
                max={getRiyadhDateISO(0)}
                onChange={(event) => setSelectedEntriesDate(event.target.value || getRiyadhDateISO(0))}
                style={{
                  width: "100%",
                  borderRadius: 11,
                  border: "1px solid rgba(255,255,255,0.16)",
                  background: "rgba(15,23,42,0.78)",
                  color: "#fff",
                  padding: "10px 12px",
                  fontFamily: "'Tajawal',sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  colorScheme: "dark",
                  marginBottom: 8,
                }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[
                  { label: "اليوم", date: getRiyadhDateISO(0) },
                  { label: "أمس", date: getRiyadhDateISO(-1) },
                  { label: "قبل أمس", date: getRiyadhDateISO(-2) },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setSelectedEntriesDate(item.date)}
                    className="smooth-btn"
                    style={{
                      padding: "8px 4px",
                      borderRadius: 11,
                      border: `1px solid ${selectedEntriesDate === item.date ? "#38bdf8" : "rgba(255,255,255,0.12)"}`,
                      background: selectedEntriesDate === item.date
                        ? "linear-gradient(180deg,rgba(56,189,248,0.5),rgba(2,132,199,0.4))"
                        : "rgba(255,255,255,0.05)",
                      color: selectedEntriesDate === item.date ? "#fff" : "rgba(255,255,255,0.62)",
                      fontFamily: "'Tajawal',sans-serif",
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: selectedEntriesDate === item.date
                        ? "0 3px 10px rgba(56,189,248,0.3), inset 0 1px 0 rgba(255,255,255,0.2)"
                        : "none",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
                marginBottom: 12,
              }}
            >
              {[...teams].sort(compareTeamsBySlot).map((team) => {
                const teamColor = getTeamColor(team);
                return (
                  <button
                    key={team.id}
                    onClick={() => setTodayTeam(team.id)}
                    className="smooth-btn"
                    style={{
                      padding: "11px 8px",
                      borderRadius: 12,
                      border: `1.5px solid ${todayTeam === team.id ? teamColor : "rgba(255,255,255,0.12)"}`,
                      background: todayTeam === team.id
                        ? `linear-gradient(180deg, ${teamColor}66, ${teamColor}33)`
                        : "rgba(255,255,255,0.06)",
                      color: todayTeam === team.id ? "#fff" : "rgba(255,255,255,0.6)",
                      fontFamily: "'Tajawal',sans-serif",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: todayTeam === team.id
                        ? `0 3px 12px ${teamColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`
                        : "none",
                    }}
                  >
                    {displayName(team)}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => loadTodayEntries(todayTeam, selectedEntriesDate)}
              disabled={todayLoading}
              className="smooth-btn"
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: todayLoading
                  ? "rgba(255,255,255,0.07)"
                  : "linear-gradient(180deg,rgba(56,189,248,0.45),rgba(2,132,199,0.35))",
                color: todayLoading ? "rgba(255,255,255,0.35)" : "#fff",
                fontFamily: "'Tajawal',sans-serif",
                fontSize: 13,
                fontWeight: 800,
                cursor: todayLoading ? "not-allowed" : "pointer",
                marginBottom: 12,
                boxShadow: todayLoading
                  ? "none"
                  : "0 3px 12px rgba(56,189,248,0.25), inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              {todayLoading ? "⏳ جارٍ التحميل..." : "🔄 تحديث تسجيلات التاريخ"}
            </button>

            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${getTeamColor(teams.find((team) => team.id === todayTeam))}33`,
                borderRadius: 16,
                padding: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  gap: 10,
                }}
              >
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>
                  {displayName(teams.find((team) => team.id === todayTeam) || teams[0] || { id: todayTeam, points: 0 })}
                </span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
                  {formatHistoryDateLabel(todayDate || selectedEntriesDate)}
                </span>
              </div>

              {todayError && (
                <div
                  style={{
                    color: "#fca5a5",
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 12,
                    padding: 12,
                    textAlign: "center",
                    fontSize: 12,
                    lineHeight: 1.7,
                  }}
                >
                  ⚠️ {todayError}
                </div>
              )}

              {!todayLoading && !todayError && todayEntries.length === 0 && (
                <div
                  style={{
                    color: "rgba(255,255,255,0.42)",
                    textAlign: "center",
                    fontSize: 13,
                    padding: "18px 8px",
                    lineHeight: 1.7,
                  }}
                >
                  لا توجد تسجيلات لهذه الحلقة في التاريخ المختار
                </div>
              )}

              {!todayError && todayEntries.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {todayEntries.map((entry, idx) => (
                    <div
                      key={`${entry.studentName}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        borderRadius: 12,
                        padding: "10px 12px",
                        background: "rgba(15,23,42,0.55)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <span
                        style={{
                          color: "rgba(255,255,255,0.86)",
                          fontWeight: 800,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.studentName}
                      </span>
                      <span
                        style={{
                          color: "#fde047",
                          fontWeight: 900,
                          fontSize: 13,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatPoints(Number(entry.points || 0))} نقطة
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "admin" && (
          <div style={{ marginTop: 8 }}>
            <AdminPanelEmbed />
          </div>
        )}

        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.07)",
            margin: "14px 0 12px",
          }}
        />
        {!showReset ? (
          <button
            onClick={() => setShowReset(true)}
            className="smooth-btn"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 12,
              border: "1px solid rgba(239,68,68,0.3)",
              background: "linear-gradient(180deg,rgba(239,68,68,0.2),rgba(127,29,29,0.18))",
              color: "#f87171",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "'Tajawal',sans-serif",
              boxShadow: "0 3px 12px rgba(239,68,68,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            🔄 إعادة المسابقة من البداية
          </button>
        ) : (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 14,
              padding: "14px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>
              ستعود جميع السفن للبداية وتُصفَّر النقاط. متأكد؟
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onResetAll}
                className="smooth-btn"
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(180deg,#ef4444,#b91c1c)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Tajawal',sans-serif",
                  boxShadow: "0 3px 12px rgba(239,68,68,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              >
                نعم، إعادة
              </button>
              <button
                onClick={() => setShowReset(false)}
                className="smooth-btn"
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 12,
                  border: "none",
                  background: "rgba(255,255,255,0.1)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "'Tajawal',sans-serif",
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────
export default function DisplayPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "ربيع القلوب";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const [allTeams, setAllTeams] = useState<Team[]>([]);
  // نسخة واحدة فقط: جميع الفصول الخمسة تظهر معاً على نفس شاشة السباق.
  const teams = useMemo(
    () => allTeams
      .filter((team) => Number(team.slot) >= 1 && Number(team.slot) <= 5)
      .sort(compareTeamsBySlot),
    [allTeams],
  );
  const [announcement, setAnn] = useState<AnnouncementData | null>(null);
  const localQueueRef = useRef<AnnouncementData[]>([]);
  const isShowingRef = useRef(false);
  const lastActionSeenRef = useRef<string>("");
  const firstStateSeenRef = useRef(false);
  const externalDisplayEventSeenRef = useRef<string>("");
  const recentAnnouncementKeysRef = useRef<Record<string, number>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [pendingPos, setPendingPos] = useState<PendingPositions | null>(null);
  const [movingId, setMovingId] = useState<TeamId | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // The position actually rendered for each ship. Kept separate from
  // `team.position` (the authoritative value from the server) so that when
  // several ships' positions change at once, we can reveal the moves one
  // ship at a time instead of animating all of them simultaneously.
  const [displayPositions, setDisplayPositions] = useState<
    Record<string, number>
  >({});
  const displayPositionsRef = useRef<Record<string, number>>({});
  // مدة الانتقال (CSS transition) لكل سفينة بالمللي ثانية — قيمة ثابتة
  // صغيرة بشكل افتراضي (لتعديلات بسيطة)، وتُرفع مؤقتاً أثناء حركة فعلية
  // طويلة عشان تكون الحركة سلسة ومتصلة بدل "نط" من مربع لمربع.
  const [transitionDurations, setTransitionDurations] = useState<
    Record<string, number>
  >({});
  const transitionDurationsRef = useRef<Record<string, number>>({});
  const moveQueueRef = useRef<QueuedMove[]>([]);
  const isAnimatingRef = useRef(false);
  const initializedPositionsRef = useRef(false);
  const [shipMoveStepMs, setShipMoveStepMs] = useState(DEFAULT_MOVE_STEP_MS);
  const shipMoveStepMsRef = useRef(DEFAULT_MOVE_STEP_MS);

  const positions = useMemo(() => getPathPositions(), []);

  // Board size in px: the route, islands and ships are laid out in real pixels
  // so strokes stay even and ships can turn to face their heading.
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [boardSize, setBoardSize] = useState<BoardSize>({ w: 1440, h: 900 });
  const boardSizeRef = useRef<BoardSize>({ w: 1440, h: 900 });
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () => {
      const next = { w: el.clientWidth || 1, h: el.clientHeight || 1 };
      boardSizeRef.current = next;
      setBoardSize(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Island-arrival celebration (visual only; does not touch scores).
  const [arrival, setArrival] = useState<ArrivalData | null>(null);
  const arrivalTimersRef = useRef<number[]>([]);
  const celebrateArrival = (team: Team, islandIdx: number) => {
    arrivalTimersRef.current.forEach((t) => window.clearTimeout(t));
    const p = boardPoint(ISLANDS_POS[islandIdx], boardSizeRef.current);
    const key = `${team.id}-${islandIdx}-${Date.now()}`;
    setArrival({
      key,
      teamName: team.name || `فصل ${team.slot || ""}`,
      color: getTeamColor(team),
      islandName: ISLAND_NAMES[islandIdx],
      islandIdx,
      x: p.x,
      y: p.y,
    });
    arrivalTimersRef.current = [
      window.setTimeout(() => setArrival((a) => (a && a.key === key ? { ...a, leaving: true } : a)), 3600),
      window.setTimeout(() => setArrival((a) => (a && a.key === key ? null : a)), 4000),
    ];
  };
  useEffect(() => () => arrivalTimersRef.current.forEach((t) => window.clearTimeout(t)), []);

  useEffect(() => {
    document.body.className = "display-page";
    return () => {
      document.body.className = "";
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadAndSyncClasses = async () => {
      try {
        const result = await callAppsScriptJsonp(APPS_SCRIPT_URL, "getClasses");
        if (!active || result?.status === "error") return;

        const classes: SchoolClass[] = (Array.isArray(result?.classes) ? result.classes : [])
          .map((item: any) => ({
            id: String(item?.classId || item?.id || ""),
            classId: String(item?.classId || item?.id || ""),
            name: String(item?.className || item?.name || ""),
            className: String(item?.className || item?.name || ""),
            sheetId: Number(item?.sheetId || 0),
            slot: Number(item?.slot || 0),
            version: 1,
            displayVersion: 1,
            students: Array.isArray(item?.students) ? item.students : [],
          }))
          .filter((item: SchoolClass) =>
            item.classId.startsWith("class-") &&
            item.slot >= 1 &&
            item.slot <= 5,
          )
          .sort((a: SchoolClass, b: SchoolClass) => a.slot - b.slot);

        if (classes.length === 0) return;

        wsClient.syncClasses(
          classes.map((item) => ({
            ...item,
            color: classColorBySlot(item.slot, item.version),
          })),
        );
      } catch (err) {
        console.warn("[DisplayPage] getClasses sync failed:", err);
      }
    };

    loadAndSyncClasses();
    const onFocus = () => loadAndSyncClasses();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(loadAndSyncClasses, 60000);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, []);

  const enqueueAnnouncement = (msg: AnnouncementData) => {
    // نسخة واحدة فقط: لا يوجد فلترة للإعلانات حسب نسخة العرض.

    const studentName = String(msg?.studentName || "").trim();
    const normalizedName = studentName.replace(/\s+/g, " ").toLowerCase();
    const points = Number((msg as any)?.displayPoints ?? (msg as any)?.points ?? 0);

    // لا نعرض أي إشعار ناتج عن تصحيح صامت أو خصم داخلي.
    // بعض النسخ القديمة ترسل الاسم الفارغ من السيرفر كـ "غير معروف"؛ هذا يجب تجاهله.
    if (!studentName) return;
    if (["غير معروف", "unknown", "undefined", "null"].includes(normalizedName)) return;
    if (!Number.isFinite(points)) return;
    if (points < 0) return;
    if (points === 0 && !(msg as any)?.displayOnly) return;

    const now = Date.now();

    const key = `${studentName}|${msg.teamName}|${points}|${(msg as any).displayOnly ? "display" : "score"}`;

    // منع التكرار لو وصل نفس الإعلان من onAnnouncement ومن lastAction معاً.
    Object.keys(recentAnnouncementKeysRef.current).forEach((oldKey) => {
      if (now - recentAnnouncementKeysRef.current[oldKey] > 2500) {
        delete recentAnnouncementKeysRef.current[oldKey];
      }
    });

    if (recentAnnouncementKeysRef.current[key] && now - recentAnnouncementKeysRef.current[key] < 2500) {
      return;
    }

    recentAnnouncementKeysRef.current[key] = now;
    localQueueRef.current = [
      ...localQueueRef.current,
      {
        ...msg,
        studentName,
        id: msg.id || `${key}|${now}`,
        points,
        displayPoints: points,
        displayOnly: Boolean((msg as any).displayOnly),
      },
    ];
    processQueue();
  };

  const handleExternalDisplayEvent = (raw: unknown, primeOnly = false) => {
    try {
      const event: any = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!event || typeof event !== "object") return;

      const shownPoints = Number(event.displayPoints ?? event.points ?? 0);
      const eventKey = String(
        event.eventId ||
          event.id ||
          `${event.createdAt || ""}|${event.teamId || ""}|${event.studentName || ""}|${shownPoints}`,
      );

      if (!eventKey || eventKey === externalDisplayEventSeenRef.current) return;
      externalDisplayEventSeenRef.current = eventKey;

      // آخر تسجيل يبقى محفوظاً في المتصفح؛ عند فتح الصفحة نعلّمه كمُشاهَد بدون عرضه،
      // ولا نعرض أي تسجيل قديم وصل متأخراً.
      if (primeOnly || isStaleDisplayEvent(event.createdAt)) return;

      enqueueAnnouncement({
        id: eventKey,
        studentName: String(event.studentName || ""),
        points: Number(event.points || 0),
        displayPoints: shownPoints,
        displayOnly: Boolean(event.displayOnly),
        teamColor: String(event.teamColor || "#6366f1"),
        teamName: String(event.teamName || ""),
        version: Number(event.version || 0),
      });
    } catch (err) {
      console.warn("Display local event ignored:", err);
    }
  };

  // WebSocket connection & subscriptions
  useEffect(() => {
    wsClient.connect();
    const unsubState = wsClient.subscribe((state: any) => {
      const nextShipMoveStepMs = normalizeMoveStepMs(
        state?.settings?.shipMoveStepMs,
      );
      shipMoveStepMsRef.current = nextShipMoveStepMs;
      setShipMoveStepMs(nextShipMoveStepMs);
      const fixedTeams = (state.teams || [])
        .map((t: any) => ({
          ...t,
          roundPoints: typeof t.roundPoints === "number" ? t.roundPoints : 0,
        }))
        .filter((t: any) => Number(t.slot) >= 1 && Number(t.slot) <= 5);
      setAllTeams(fixedTeams);

      // احتياط مهم: بعض النسخ لا ترسل onAnnouncement بشكل ثابت،
      // لكن AdminPage يرسل lastAction مع كل تسجيل. إذا وصل lastAction جديد
      // نعرض اسم الطالب في DisplayPage مثل النسخة القديمة تماماً.
      const action = state?.lastAction;
      const isFirstState = !firstStateSeenRef.current;
      firstStateSeenRef.current = true;
      if (action?.studentName) {
        const shownPoints = Number(action.displayPoints ?? action.points ?? 0);
        const actionKey = `${action.createdAt || ""}|${action.teamId || ""}|${action.studentName}|${shownPoints}`;
        if (actionKey !== lastActionSeenRef.current) {
          lastActionSeenRef.current = actionKey;
          // أول حالة تصل عند فتح الصفحة تحمل آخر تسجيل قديم: لا نعرضه.
          if (isFirstState || isStaleDisplayEvent(action.createdAt)) return;
          enqueueAnnouncement({
            id: actionKey,
            studentName: String(action.studentName || ""),
            points: Number(action.points || 0),
            displayPoints: shownPoints,
            displayOnly: Boolean(action.displayOnly),
            teamColor: String(action.teamColor || "#6366f1"),
            teamName: String(action.teamName || ""),
            version: Number(action.version || 0),
          });
        }
      }
    });
    const unsubAnn = wsClient.onAnnouncement((msg: AnnouncementData) => {
      enqueueAnnouncement(msg);
    });

    const readStoredDisplayEvent = (primeOnly = false) => {
      try {
        const raw = window.localStorage.getItem(DISPLAY_EVENT_STORAGE_KEY);
        if (raw) handleExternalDisplayEvent(raw, primeOnly);
      } catch (err) {}
    };

    readStoredDisplayEvent(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === DISPLAY_EVENT_STORAGE_KEY && event.newValue) {
        handleExternalDisplayEvent(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(DISPLAY_EVENT_CHANNEL);
      channel.onmessage = (event) => handleExternalDisplayEvent(event.data);
    } catch (err) {
      channel = null;
    }

    const pollTimer = window.setInterval(() => readStoredDisplayEvent(), 700);

    return () => {
      unsubState();
      unsubAnn();
      window.removeEventListener("storage", onStorage);
      window.clearInterval(pollTimer);
      if (channel) channel.close();
    };
  }, []);

  const processQueue = () => {
    if (isShowingRef.current || localQueueRef.current.length === 0) return;
    isShowingRef.current = true;
    const item = localQueueRef.current[0];
    setAnn(item);
    setTimeout(() => {
      setAnn(null);
      localQueueRef.current = localQueueRef.current.slice(1);
      isShowingRef.current = false;
      setTimeout(() => processQueue(), 400);
    }, 5500);
  };

  /* fullscreen */
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleChangeShipSpeed = (stepMs: number) => {
    const normalized = normalizeMoveStepMs(stepMs);
    shipMoveStepMsRef.current = normalized;
    setShipMoveStepMs(normalized);
    wsClient.setShipMoveStepMs(normalized);
  };

  /* تحريك السفن سفينة واحدة في كل مرة، ربع مربع/ربع مربع على المسار */
  const drainMoveQueue = async () => {
    if (isAnimatingRef.current || moveQueueRef.current.length === 0) return;

    isAnimatingRef.current = true;
    setIsMoving(true);

    while (moveQueueRef.current.length > 0) {
      const ordered = [...moveQueueRef.current].sort(
        (a, b) => compareTeamsBySlot(a, b),
      );
      const next = ordered[0];
      moveQueueRef.current = moveQueueRef.current.filter(
        (t) => t.id !== next.id,
      );
      setMovingId(next.id);

      const startPos =
        displayPositionsRef.current[next.id] ?? next.prevPosition ?? 0;
      const endPos = storedPositionToIndex(next.position);
      const direction = endPos >= startPos ? 1 : -1;
      const distance = Math.abs(endPos - startPos);

      console.log("[DrainMoveQueue:start]", {
        team: next.id,
        startPos: round3(startPos),
        endPos: round3(endPos),
        startPoints: round3(indexToPoints(startPos)),
        endPoints: round3(indexToPoints(endPos)),
        distance: round3(distance),
      });

      // ثبّت السفينة أولاً على نقطة البداية بدون transition حتى لا يحدث وميض.
      transitionDurationsRef.current = {
        ...transitionDurationsRef.current,
        [next.id]: 0,
      };
      setTransitionDurations({ ...transitionDurationsRef.current });
      displayPositionsRef.current = {
        ...displayPositionsRef.current,
        [next.id]: startPos,
      };
      setDisplayPositions({ ...displayPositionsRef.current });

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      if (distance <= POSITION_EPSILON) {
        transitionDurationsRef.current = {
          ...transitionDurationsRef.current,
          [next.id]: IDLE_TRANSITION_MS,
        };
        setTransitionDurations({ ...transitionDurationsRef.current });
        displayPositionsRef.current = {
          ...displayPositionsRef.current,
          [next.id]: endPos,
        };
        setDisplayPositions({ ...displayPositionsRef.current });
        await sleep(250);
        continue;
      }

      // حركة تدريجية على المسار: كل خطوة تغيّر الموضع الكسري فقط، وReact
      // يعيد حساب left/top من pointsToExactPos على نفس منحنى SVG، فتتحرك السفينة فوق المنحنى
      // بدل خط مستقيم طويل يقطع أسفل/أعلى المسار.
      let current = startPos;
      while (Math.abs(endPos - current) > POSITION_EPSILON) {
        const remaining = Math.abs(endPos - current);
        const step = Math.min(MOVE_STEP_INDEX, remaining);
        const nextStep = current + direction * step;
        const currentStepMs = shipMoveStepMsRef.current;

        transitionDurationsRef.current = {
          ...transitionDurationsRef.current,
          [next.id]: currentStepMs,
        };
        setTransitionDurations({ ...transitionDurationsRef.current });

        displayPositionsRef.current = {
          ...displayPositionsRef.current,
          [next.id]: nextStep,
        };
        setDisplayPositions({ ...displayPositionsRef.current });

        console.log("[DrainMoveQueue:step]", {
          team: next.id,
          index: nextStep,
          points: round3(indexToPoints(nextStep)),
        });

        current = nextStep;
        await sleep(currentStepMs + 30);
      }

      transitionDurationsRef.current = {
        ...transitionDurationsRef.current,
        [next.id]: IDLE_TRANSITION_MS,
      };
      setTransitionDurations({ ...transitionDurationsRef.current });

      // تأكيد نهائي للقيمة بالضبط، بدون تقريب.
      displayPositionsRef.current = {
        ...displayPositionsRef.current,
        [next.id]: endPos,
      };
      setDisplayPositions({ ...displayPositionsRef.current });

      console.log("[DrainMoveQueue:done]", {
        team: next.id,
        finalIndex: round3(endPos),
        finalPoints: round3(indexToPoints(endPos)),
      });

      // احتفال عند الوصول لجزيرة جديدة أثناء هذه الحركة (للأمام فقط).
      const reachedIslands = ISLAND_INDICES.filter(
        (k) => k > 0 && startPos < k - POSITION_EPSILON && endPos >= k - POSITION_EPSILON,
      );
      if (reachedIslands.length > 0) {
        const islandIndex = ISLAND_INDICES.indexOf(Math.max(...reachedIslands));
        celebrateArrival(next, islandIndex);
        await sleep(2200);
      }

      await sleep(250);
    }

    setMovingId(null);
    setIsMoving(false);
    setPendingPos(null);
    isAnimatingRef.current = false;
  };

  // Whenever the authoritative `teams` state changes, queue up any ships
  // whose position actually moved and animate them one at a time. This is
  // what makes the ships move individually instead of all at once — the CSS
  // transition only fires when a ship's *own* entry in displayPositions
  // changes, and we only change one entry every 3.4s.
  useEffect(() => {
    if (teams.length === 0) return;

    if (!initializedPositionsRef.current) {
      // First load: show every ship at its real position immediately, no animation.
      const initial: Record<string, number> = {};
      teams.forEach((t) => {
        initial[t.id] = storedPositionToIndex(t.position, t.points);
      });
      displayPositionsRef.current = initial;
      setDisplayPositions(initial);
      initializedPositionsRef.current = true;
      return;
    }

    teams.forEach((t) => {
      const target = storedPositionToIndex(t.position, t.points);
      const currentDisplay = displayPositionsRef.current[t.id] ?? 0;

      if (Math.abs(target - currentDisplay) > POSITION_EPSILON) {
        const queued = moveQueueRef.current.find((q) => q.id === t.id);
        if (queued) {
          queued.position = target;
        } else {
          // احفظ الموضع الكسري الحقيقي كنقطة بداية؛ لا نُقرِّب أبداً.
          // هذا ضروري للقيم مثل 0.6 = 30 نقطة بين مربع 0 و 1.
          moveQueueRef.current.push({
            ...t,
            position: target,
            prevPosition: currentDisplay,
          });
        }
      }
    });
    drainMoveQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  const handleMoveShips = () => {
    if (!pendingPos || isMoving) return;
    const orderedTeams = [...teams].sort(
      (a, b) => compareTeamsBySlot(a, b),
    );
    const positionsToSend: Record<string, number> = {};
    orderedTeams.forEach((t) => {
      positionsToSend[t.id] =
        pendingPos[t.id] ?? storedPositionToIndex(t.position, t.points);
    });
    console.log("[MoveShips:send]", positionsToSend);
    setIsMoving(true); // instant button feedback; drainMoveQueue() takes over
    // once the server broadcasts the new positions back to this client.
    wsClient.moveShips(positionsToSend);
  };

  const handleAdjustPoints = async (teamId: TeamId, amount: number) => {
    wsClient.adjustPoints(teamId, amount);
  };

  const handleResetAll = () => {
    wsClient.resetGame();
    setPendingPos(null);
    setShowSettings(false);
  };

  const posOf = (t: Team) =>
    displayPositions[t.id] ?? storedPositionToIndex(t.position, t.points);

  const getShipPos = (
    team: Team,
  ): {
    x: number;
    y: number;
    ptsNudge: number;
    boardIndex: number;
    effectivePts: number;
  } => {
    const boardIndex = posOf(team);
    const { ox, oy, ptsNudge } = calcShipOffset(team, teams, posOf);
    const exactIndex = boardIndex + ptsNudge;
    const effectivePts = indexToPoints(exactIndex);
    const exact = pointsToExactPos(effectivePts, positions);
    return {
      x: exact.x + ox,
      y: exact.y + oy,
      ptsNudge,
      boardIndex,
      effectivePts,
    };
  };

  const leaderPosition = Math.max(0, ...teams.map((t) => posOf(t)));

  // التاج يظهر لكل السفن المتصدرة بنفس الموضع — حتى لو متعادلة
  const isLeader = (team: Team) =>
    leaderPosition > POSITION_EPSILON &&
    Math.abs(posOf(team) - leaderPosition) <= POSITION_EPSILON;

  useEffect(() => {
    if (!DEBUG_SHIP_POSITIONS || teams.length === 0) return;

    console.table(
      teams.map((t) => {
        const boardIndex = posOf(t);
        const effectivePts = indexToPoints(boardIndex);
        const exact = pointsToExactPos(effectivePts, positions);
        return {
          team: t.id,
          storedPosition: t.position ?? 0,
          boardIndex: round3(boardIndex),
          effectivePts: round3(effectivePts),
          expectedSquare: round3(effectivePts / POINTS_PER_SQUARE),
          x: round3(exact.x),
          y: round3(exact.y),
          shipLocationPoints: round3(indexToPoints(boardIndex)),
          isLeader: isLeader(t),
        };
      }),
    );
  }, [teams, displayPositions, positions, leaderPosition]);

  const displayName = (t: Team) => t.name || `فصل ${t.slot || ""}`;

  // ── Board layout in px ──
  const k = Math.max(0.62, Math.min(1.6, Math.min(boardSize.w / 1400, boardSize.h / 880)));
  const islandScale = k * 1.08;
  const shipW = Math.round(Math.max(boardSize.w < 700 ? 58 : 92, Math.min(150, boardSize.w * 0.076)));
  const shipH = (shipW * DHOW_VB_H) / DHOW_VB_W;
  const shipAnchorX = (shipW * DHOW_ANCHOR_X) / DHOW_VB_W;
  const shipAnchorY = (shipW * DHOW_ANCHOR_Y) / DHOW_VB_W;
  const buoySize = Math.round(Math.max(56, Math.min(92, 72 * k)));
  const fullRouteD = routePathD(boardSize, TOTAL_POSITIONS - 1);
  const leaderRouteD = routePathD(boardSize, leaderPosition);

  // Ships sharing a stretch of route fan out across it (perpendicular to the
  // route), so every class stays visible. Progress along the route is untouched.
  const shipLayouts = (() => {
    const base = [...teams].sort(compareTeamsBySlot).map((team) => {
      const pos = getShipPos(team);
      const pt = boardPoint({ x: pos.x, y: pos.y }, boardSize);
      const tan = indexToTangent(pos.boardIndex, boardSize);
      const flip: 1 | -1 = tan.x >= 0 ? 1 : -1;
      const rawRot = flip === 1 ? Math.atan2(tan.y, tan.x) : Math.atan2(-tan.y, -tan.x);
      const rot = Math.max(-20, Math.min(20, (rawRot * 180) / Math.PI));
      return { team, x: pt.x, y: pt.y, tan, flip, rot, boardIndex: pos.boardIndex, effectivePts: pos.effectivePts };
    });
    const byIndex = [...base].sort((a, b) => a.boardIndex - b.boardIndex || compareTeamsBySlot(a.team, b.team));
    const groups: (typeof base)[] = [];
    byIndex.forEach((s) => {
      const g = groups[groups.length - 1];
      if (g && s.boardIndex - g[g.length - 1].boardIndex < 0.45) g.push(s);
      else groups.push([s]);
    });
    groups.forEach((g) => {
      if (g.length < 2) return;
      const spacing = shipW * (g.length > 3 ? 0.92 : 1.12);
      const ordered = [...g].sort((a, b) => compareTeamsBySlot(a.team, b.team));
      ordered.forEach((s, j) => {
        let nx = -s.tan.y;
        let ny = s.tan.x;
        if (ny < 0) {
          nx = -nx;
          ny = -ny;
        }
        const off = (j - (ordered.length - 1) / 2) * spacing;
        s.x += nx * off;
        s.y += ny * off;
      });
    });
    return base;
  })();

  const tallyEntries = teams.map((t) => ({
    id: t.id,
    name: displayName(t),
    slot: Number(t.slot || 0),
    color: getTeamColor(t),
    points: indexToPoints(posOf(t)),
  }));

  const announcementPoints = announcement ? Number(announcement.displayPoints ?? announcement.points ?? 0) : 0;
  // displayOnly مع displayPoints أكبر من صفر يجب أن يعرض النقاط السابقة مثل +100،
  // ولا يتحول إلى عبارة "إعادة عرض" إلا إذا لم تُرسل نقاط للعرض.
  const announcementReplay = Boolean(announcement?.displayOnly) && announcementPoints === 0;

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes move-ready{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.7)}50%{box-shadow:0 0 0 14px rgba(34,197,94,0)}}
        /* زر كرتوني: حدود سميكة + ظل صلب سفلي (تأثير 3D) + ضغطة نازلة واضحة */
        .smooth-btn {
          transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.16s ease, background 0.2s ease, border-color 0.2s ease, color 0.2s ease !important;
          will-change: transform;
          border: 3px solid rgba(0,0,0,0.30) !important;
          box-shadow: 0 5px 0 rgba(0,0,0,0.38), inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.15) !important;
        }
        .smooth-btn:hover:not(:disabled):not(.btn-float) {
          transform: translateY(-2px) !important;
          filter: brightness(1.08);
          box-shadow: 0 7px 0 rgba(0,0,0,0.38), inset 0 2px 0 rgba(255,255,255,0.40), inset 0 -3px 0 rgba(0,0,0,0.15) !important;
        }
        .smooth-btn:active:not(:disabled):not(.btn-float) {
          transform: translateY(4px) !important;
          filter: brightness(0.96);
          box-shadow: 0 1px 0 rgba(0,0,0,0.38), inset 0 2px 0 rgba(255,255,255,0.28), inset 0 -2px 0 rgba(0,0,0,0.15) !important;
        }
        /* زر عائم (مثبّت بالمنتصف): يحافظ على توسيطه عند الحركة + حدود كرتونية */
        .btn-float {
          transition: transform 0.14s ease, box-shadow 0.14s ease, filter 0.16s ease !important;
          will-change: transform;
          border: 3px solid rgba(0,0,0,0.30) !important;
        }
        .btn-float:hover:not(:disabled) {
          transform: translateX(-50%) translateY(-3px) !important;
          filter: brightness(1.08);
        }
        .btn-float:active:not(:disabled) {
          transform: translateX(-50%) translateY(3px) !important;
          filter: brightness(0.96);
        }
        /* لمعان يمر على الزر الرئيسي */
        .btn-shine {
          position: relative;
          overflow: hidden;
        }
        .btn-shine::after {
          content: "";
          position: absolute;
          top: 0;
          left: -60%;
          width: 40%;
          height: 100%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          animation: btn-shine 3.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes btn-shine {
          0%, 60% { left: -60%; }
          85%, 100% { left: 140%; }
        }
      `}</style>

      <div className="rb-root">
        <Leaderboard
          entries={tallyEntries}
          maxPoints={indexToPoints(TOTAL_POSITIONS - 1)}
          movingId={movingId}
          logoSrc={`data:image/png;base64,${LOGO_B64}`}
          footer={
            <>
              <div className="rb-legend">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CoinIcon size={16} /> كل عوّامة = {formatPoints(POINTS_PER_SQUARE)} نقطة
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="rb-icon-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "تصغير" : "ملء الشاشة"}
                  aria-label={isFullscreen ? "تصغير" : "ملء الشاشة"}
                >
                  <FullscreenIcon exit={isFullscreen} />
                </button>
                <button
                  type="button"
                  className="rb-icon-btn"
                  onClick={() => setShowSettings(true)}
                  title="الإعدادات"
                  aria-label="الإعدادات"
                >
                  <HelmIcon />
                </button>
              </div>
            </>
          }
        />

        <main className="rb-board" ref={boardRef} aria-label="خريطة السباق">
          <SeaBackdrop />

          {/* Lagoons sit under the route so the channel reads as leaving the shallows */}
          {ISLANDS_POS.map((pos, islandIdx) => {
            const p = boardPoint(pos, boardSize);
            const size = ISLAND_SIZES[islandIdx] * islandScale;
            return (
              <div
                key={`lagoon-${islandIdx}`}
                className="rb-layer"
                style={{ zIndex: 4 }}
                aria-hidden="true"
              >
                <div
                  className="rb-lagoon"
                  style={{
                    left: p.x - size * 1.05,
                    top: p.y - size * 0.62,
                    width: size * 2.1,
                    height: size * 1.36,
                  }}
                />
                <div
                  className="rb-lagoon-ring"
                  style={{
                    left: p.x - size * 0.78,
                    top: p.y - size * 0.44,
                    width: size * 1.56,
                    height: size * 1.0,
                    animationDelay: `${islandIdx * 0.9}s`,
                  }}
                />
              </div>
            );
          })}

          {/* Route: shallow channel, rope, and the leader's lit wake */}
          <svg
            className="rb-layer"
            style={{ zIndex: 5 }}
            width={boardSize.w}
            height={boardSize.h}
            viewBox={`0 0 ${boardSize.w} ${boardSize.h}`}
            aria-hidden="true"
          >
            <defs>
              <filter id="rb-route-glow" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation={4 * k} result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <path d={fullRouteD} fill="none" stroke="rgba(143,240,221,0.2)" strokeWidth={50 * k} strokeLinecap="round" strokeLinejoin="round" />
            <path d={fullRouteD} fill="none" stroke="rgba(244,255,253,0.1)" strokeWidth={30 * k} strokeLinecap="round" strokeLinejoin="round" />
            <path d={fullRouteD} fill="none" stroke="rgba(3,30,55,0.38)" strokeWidth={12 * k} strokeLinecap="round" transform={`translate(0 ${3 * k})`} />
            <path d={fullRouteD} fill="none" stroke="var(--rope)" strokeWidth={8 * k} strokeLinecap="round" />
            <path d={fullRouteD} fill="none" stroke="var(--rope-dark)" strokeWidth={8 * k} strokeDasharray={`${3 * k} ${7 * k}`} />
            {leaderRouteD && (
              <>
                <path d={leaderRouteD} fill="none" stroke="rgba(255,210,92,0.55)" strokeWidth={16 * k} strokeLinecap="round" filter="url(#rb-route-glow)" />
                <path d={leaderRouteD} fill="none" stroke="#ffe08a" strokeWidth={9 * k} strokeLinecap="round" />
                <path
                  className="rb-route-flow"
                  d={leaderRouteD}
                  fill="none"
                  stroke="#c98a12"
                  strokeWidth={9 * k}
                  strokeDasharray={`${3 * k} ${7 * k}`}
                  style={{ ["--rb-flow" as string]: `${-10 * k * 3}px` }}
                />
              </>
            )}
          </svg>

          {/* Channel buoys: one per 500 points */}
          {positions.map((pos, i) => {
            if (ISLAND_INDICES.includes(i)) return null;
            const p = boardPoint(pos, boardSize);
            const lit = leaderPosition >= i - POSITION_EPSILON;
            const occupied = shipLayouts.some((sl) => Math.abs(sl.boardIndex - i) < 0.4);
            return (
              <div
                key={`buoy-${i}`}
                className={`rb-buoy${lit ? " rb-buoy--lit" : ""}${occupied ? " rb-buoy--occupied" : ""}`}
                style={{
                  transform: `translate(${p.x - buoySize / 2}px, ${p.y - buoySize * 1.05}px)`,
                  width: buoySize,
                }}
              >
                <svg className="rb-buoy-body" width={buoySize} height={buoySize * 1.3} viewBox="0 0 40 52" aria-hidden="true">
                  <ellipse cx="20" cy="46" rx="17" ry="4" fill="rgba(244,255,253,0.5)" />
                  {lit && <circle className="rb-buoy-lamp-glow" cx="20" cy="6" r="9" fill="rgba(255,210,92,0.55)" />}
                  <path d="M20 9 L20 17 M14 17 L26 17" stroke="#16323f" strokeWidth="2.2" strokeLinecap="round" />
                  <circle className="rb-buoy-lamp" cx="20" cy="6" r="4" fill={lit ? "#ffd25c" : "#5d7480"} stroke="#16323f" strokeWidth="1.6" />
                  <path d="M7 27 Q7 17 20 17 Q33 17 33 27 L34 41 Q20 48 6 41 Z" fill="var(--coral)" stroke="#5a1410" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M6.6 26 L33.4 26 L33.9 37 Q20 41 6.1 37 Z" fill="#fff8e8" />
                  <path d="M10 20 Q14 18 18 18.4" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  <text x="20" y="35.2" textAnchor="middle" fontSize="13.5" fontWeight="900" fontFamily="Tajawal, sans-serif" fill="#062a3b">
                    {i}
                  </text>
                </svg>
                <div className="rb-buoy-value" style={{ fontSize: Math.round(buoySize * 0.32) }}>
                  {formatPoints(POINTS_PER_SQUARE * i)}
                </div>
              </div>
            );
          })}

          {/* Islands */}
          {ISLANDS_POS.map((pos, islandIdx) => {
            const p = boardPoint(pos, boardSize);
            const size = ISLAND_SIZES[islandIdx] * islandScale;
            const islandSquare = ISLAND_INDICES[islandIdx];
            const reached = islandIdx > 0 && leaderPosition >= islandSquare - POSITION_EPSILON;
            const celebrating = arrival?.islandIdx === islandIdx && !arrival.leaving;
            return (
              <div
                key={`island-${islandIdx}`}
                className={`rb-island${reached ? " rb-island--reached" : ""}${celebrating ? " rb-island--celebrate" : ""}`}
                style={{
                  transform: `translate(${p.x - size / 2}px, ${p.y - size / 2}px)`,
                  width: size,
                }}
              >
                <img
                  src={ISLAND_IMAGES[islandIdx]}
                  alt=""
                  style={{ width: size, height: size, animationDelay: `${islandIdx * -1.7}s` }}
                />
                <div className="rb-plate" style={{ fontSize: Math.round(22 * k) }}>
                  {ISLAND_NAMES[islandIdx]}
                  {islandIdx > 0 && (
                    <small>
                      <CoinIcon size={Math.round(18 * k)} />
                      {formatPoints(POINTS_PER_SQUARE * islandSquare)}
                    </small>
                  )}
                </div>
              </div>
            );
          })}

          {/* Ships */}
          {shipLayouts.map(({ team, x, y, flip, rot, boardIndex }) => {
            const color = getTeamColor(team);
            const moving = movingId === team.id;
            const shipTransitionMs = moving ? transitionDurations[team.id] ?? 140 : 650;
            return (
              <div
                key={team.id}
                className={`rb-ship${moving ? " rb-ship--moving" : ""}`}
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition:
                    shipTransitionMs === 0
                      ? "opacity 180ms ease, filter 180ms ease"
                      : `transform ${shipTransitionMs}ms ${moving ? "linear" : "cubic-bezier(0.16,1,0.3,1)"}, opacity 180ms ease, filter 180ms ease`,
                  // عند فتح الإعدادات تبقى السفن خلف النافذة ولا تبرز من خلال الخلفية.
                  opacity: showSettings ? 0.06 : 1,
                  filter: showSettings ? "blur(2px)" : "none",
                  pointerEvents: showSettings ? "none" : "auto",
                  zIndex: showSettings ? 0 : moving ? 90 : 20 + Math.round(boardIndex) + (team.slot || 0),
                }}
              >
                <div
                  className="rb-ship-heading"
                  style={{
                    position: "absolute",
                    left: -shipAnchorX,
                    top: -shipAnchorY,
                    width: shipW,
                    height: shipH,
                    transformOrigin: `${shipAnchorX}px ${shipAnchorY}px`,
                    transform: `rotate(${rot}deg) scaleX(${flip})`,
                  }}
                >
                  <div className="rb-ship-bob" style={{ animationDelay: `${(team.slot || 0) * -0.7}s` }}>
                    <Dhow color={color} label={team.slot || ""} flip={flip} width={shipW} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Name tags and crowns ride above every hull so no class is ever hidden */}
          {shipLayouts.map(({ team, x, y, effectivePts }) => {
            const color = getTeamColor(team);
            const moving = movingId === team.id;
            const shipTransitionMs = moving ? transitionDurations[team.id] ?? 140 : 650;
            return (
              <div
                key={`tag-${team.id}`}
                className="rb-ship"
                aria-hidden="true"
                style={{
                  transform: `translate(${x}px, ${y}px)`,
                  transition:
                    shipTransitionMs === 0
                      ? "opacity 180ms ease"
                      : `transform ${shipTransitionMs}ms ${moving ? "linear" : "cubic-bezier(0.16,1,0.3,1)"}, opacity 180ms ease`,
                  opacity: showSettings ? 0 : 1,
                  pointerEvents: "none",
                  zIndex: moving ? 96 : 95,
                }}
              >
                {isLeader(team) && (
                  <div className="rb-crown" style={{ bottom: shipW * 0.64 }}>
                    <CrownIcon size={Math.round(shipW * 0.4)} />
                  </div>
                )}
                <div
                  className="rb-ship-tag"
                  style={{ background: color, fontSize: Math.round(shipW * 0.17), top: shipW * 0.09 }}
                >
                  {displayName(team)}
                  <b>
                    <TweenedPoints value={effectivePts} />
                  </b>
                </div>
              </div>
            );
          })}

          {/* Move ships button */}
          {pendingPos && (
            <button type="button" className="rb-move-btn" onClick={handleMoveShips} disabled={isMoving}>
              <AnchorIcon size={26} />
              {isMoving ? "السفن تبحر…" : "تحريك السفن"}
            </button>
          )}

          {arrival && <ArrivalCelebration key={arrival.key} arrival={arrival} />}
        </main>

        {announcement && (
          <StudentAnnouncement
            key={announcement.id}
            studentName={announcement.studentName}
            teamName={announcement.teamName}
            teamColor={announcement.teamColor}
            points={announcementPoints}
            replay={announcementReplay}
          />
        )}

        {showSettings && (
          <SettingsPanel
            teams={teams}
            onClose={() => setShowSettings(false)}
            currentPositions={displayPositions}
            shipMoveStepMs={shipMoveStepMs}
            onChangeShipSpeed={handleChangeShipSpeed}
            onMovePending={(pending) => {
              setPendingPos(pending);
              setShowSettings(false);
            }}
            onAdjustPoints={handleAdjustPoints}
            onResetAll={handleResetAll}
          />
        )}
      </div>
    </>
  );
}
