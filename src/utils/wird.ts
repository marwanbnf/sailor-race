import { MUSHAF_LINES_X10 } from "../data/mushafLines.js";

// اقتراح ورد الطالب القادم من تسجيلاته السابقة.
//
// الحفظ: من الناس باتجاه البقرة، تراكمي داخل السورة (كل يوم من آية ١ إلى موضع أبعد)
//        بمعدل الطالب المعتاد من الأسطر الجديدة يومياً، وآخر يوم في السورة يكمّلها
//        مهما كان الباقي، ثم تبدأ السورة التي قبلها في المصحف بنفس المعدل.
// المراجعة: من البقرة باتجاه الناس، غير تراكمية، بمعدل الطالب المعتاد من الأوجه،
//        وتكمل من حيث وقفت آخر مرة.
// الغياب أو «لم يسمع» لا يحرّك الورد: يتكرر نفس الورد حتى يسمّعه الطالب.
// المعدل المعتاد = الأكثر تكراراً في آخر الأيام، فزيادة يوم واحد لا تغيّره.

// surahIndex بنفس ترتيب قائمة SURAHS في الموقع: ٠ = الفاتحة … ١١٣ = الناس.
export type WirdPoint = { surahIndex: number; ayah: number | null };

export type WirdDay = {
  date: string;
  hifzTo: WirdPoint | null;
  hifzOk: boolean;
  muraFrom: WirdPoint | null;
  muraTo: WirdPoint | null;
  muraOk: boolean;
};

export type WirdSuggestion = {
  from: WirdPoint;
  to: WirdPoint;
  /** الحفظ: الأسطر الجديدة. المراجعة: عدد الأوجه. */
  amount: number;
  unit: "lines" | "pages";
};

const LINES_PER_PAGE = 15;
const RATE_WINDOW = 6;
const BAQARAH = 1;
const NAS = 113;

function ayahCount(surahIndex: number): number {
  return (MUSHAF_LINES_X10[surahIndex]?.length ?? 1) - 1;
}

// نهاية الآية بعُشر السطر محسوبة من بداية الآية ١ في سورتها.
function endInSurah(surahIndex: number, ayah: number): number {
  if (ayah <= 0) return 0;
  return MUSHAF_LINES_X10[surahIndex][Math.min(ayah, ayahCount(surahIndex))];
}

// موضع بداية/نهاية الآية من أول المصحف بعُشر السطر.
function globalStart(surahIndex: number, ayah: number): number {
  return MUSHAF_LINES_X10[surahIndex][0] + endInSurah(surahIndex, ayah - 1);
}

function globalEnd(surahIndex: number, ayah: number): number {
  return MUSHAF_LINES_X10[surahIndex][0] + endInSurah(surahIndex, ayah);
}

function validPoint(p: WirdPoint | null): p is WirdPoint {
  return !!p && Number.isInteger(p.surahIndex) && p.surahIndex >= 0 && p.surahIndex <= NAS;
}

// اسم السورة بدون آية = السورة كاملة.
const toAyah = (p: WirdPoint) => p.ayah ?? ayahCount(p.surahIndex);
const fromAyah = (p: WirdPoint) => p.ayah ?? 1;
const isSurahEnd = (p: WirdPoint) => toAyah(p) >= ayahCount(p.surahIndex);

// القيمة الأكثر تكراراً؛ عند التعادل الأصغر، حتى لا يزيد الورد بسبب يوم استثنائي.
function typical(values: number[]): number | null {
  const recent = values.slice(-RATE_WINDOW);
  if (!recent.length) return null;
  const counts = new Map<number, number>();
  recent.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let best: number | null = null;
  let bestCount = 0;
  counts.forEach((count, value) => {
    if (count > bestCount || (count === bestCount && best !== null && value < best)) {
      best = value;
      bestCount = count;
    }
  });
  return best;
}

const byDate = (days: WirdDay[]) => [...days].sort((a, b) => a.date.localeCompare(b.date));

// ── الحفظ ────────────────────────────────────────────────────────────────
export function hifzRate(days: WirdDay[]): number | null {
  const done = byDate(days).filter((d) => d.hifzOk && validPoint(d.hifzTo));
  const increments: number[] = [];

  for (let i = 1; i < done.length; i++) {
    const prev = done[i - 1].hifzTo!;
    const cur = done[i].hifzTo!;
    // يوم إكمال السورة قصير بطبيعته، فلا يدخل في حساب المعدل.
    if (isSurahEnd(cur)) continue;
    let added = 0;
    if (cur.surahIndex === prev.surahIndex && toAyah(cur) > toAyah(prev)) {
      added = endInSurah(cur.surahIndex, toAyah(cur)) - endInSurah(prev.surahIndex, toAyah(prev));
    } else if (cur.surahIndex === prev.surahIndex - 1 && isSurahEnd(prev)) {
      added = endInSurah(cur.surahIndex, toAyah(cur));
    }
    if (added > 0) increments.push(Math.max(1, Math.round(added / 10)));
  }

  // تسجيل واحد فقط في بداية سورة: نأخذ ما حفظه في ذلك اليوم معدلاً مبدئياً.
  if (!increments.length && done.length) {
    const first = done[0].hifzTo!;
    if (!isSurahEnd(first)) return Math.max(1, Math.round(endInSurah(first.surahIndex, toAyah(first)) / 10));
  }
  return typical(increments);
}

export function suggestHifz(days: WirdDay[]): WirdSuggestion | null {
  const done = byDate(days).filter((d) => d.hifzOk && validPoint(d.hifzTo));
  const rate = hifzRate(days);
  if (!done.length || !rate) return null;

  const last = done[done.length - 1].hifzTo!;
  let surahIndex = last.surahIndex;
  let baseAyah = toAyah(last);
  if (isSurahEnd(last)) {
    surahIndex -= 1;
    baseAyah = 0;
    if (surahIndex < BAQARAH) return null; // أتمّ الحفظ حتى البقرة
  }

  const base = endInSurah(surahIndex, baseAyah);
  const target = rate * 10;
  const count = ayahCount(surahIndex);
  let bestAyah = baseAyah + 1;
  let bestDiff = Infinity;
  for (let a = baseAyah + 1; a <= count; a++) {
    const diff = Math.abs(endInSurah(surahIndex, a) - base - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestAyah = a;
    }
    if (endInSurah(surahIndex, a) - base > target) break;
  }

  return {
    from: { surahIndex, ayah: 1 },
    to: { surahIndex, ayah: bestAyah },
    amount: Math.max(1, Math.round((endInSurah(surahIndex, bestAyah) - base) / 10)),
    unit: "lines",
  };
}

// ── المراجعة ─────────────────────────────────────────────────────────────
type MuraRange = { from: WirdPoint; to: WirdPoint };

function muraRanges(days: WirdDay[]): MuraRange[] {
  return byDate(days)
    .filter((d) => d.muraOk && validPoint(d.muraFrom) && validPoint(d.muraTo))
    .map((d) => ({ from: d.muraFrom!, to: d.muraTo! }))
    .filter((r) => globalEnd(r.to.surahIndex, toAyah(r.to)) > globalStart(r.from.surahIndex, fromAyah(r.from)));
}

function rangePages(r: MuraRange): number {
  const lines = (globalEnd(r.to.surahIndex, toAyah(r.to)) - globalStart(r.from.surahIndex, fromAyah(r.from))) / 10;
  return lines / LINES_PER_PAGE;
}

export function murajaaRate(days: WirdDay[]): number | null {
  const pages = muraRanges(days).map((r) => Math.max(0.5, Math.round(rangePages(r) * 2) / 2));
  return typical(pages);
}

export function suggestMurajaa(days: WirdDay[]): WirdSuggestion | null {
  const ranges = muraRanges(days);
  const rate = murajaaRate(days);
  if (!ranges.length || !rate) return null;

  const last = ranges[ranges.length - 1];
  // إذا كان المعلم يسجل المراجعة بأسماء السور فقط، نقترح سوراً كاملة.
  const wholeSurahs = last.from.ayah === null && last.to.ayah === null;

  // نبدأ بعد آخر موضع؛ وبعد الناس نرجع لأول سورة راجعها الطالب.
  let startSurah = last.to.surahIndex;
  let startAyah = toAyah(last.to) + 1;
  if (startAyah > ayahCount(startSurah)) {
    startSurah += 1;
    startAyah = 1;
  }
  if (startSurah > NAS) {
    startSurah = Math.min(...ranges.map((r) => r.from.surahIndex));
    startAyah = 1;
  }

  const start = globalStart(startSurah, startAyah);
  const target = rate * LINES_PER_PAGE * 10;
  let best: WirdPoint = { surahIndex: startSurah, ayah: wholeSurahs ? null : startAyah };
  let bestDiff = Infinity;
  let bestEnd = start;

  for (let s = startSurah; s <= NAS; s++) {
    const firstAyah = s === startSurah ? startAyah : 1;
    const candidates = wholeSurahs ? [ayahCount(s)] : Array.from({ length: ayahCount(s) - firstAyah + 1 }, (_, i) => firstAyah + i);
    let passed = false;
    for (const a of candidates) {
      const end = globalEnd(s, a);
      const diff = Math.abs(end - start - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = { surahIndex: s, ayah: wholeSurahs ? null : a };
        bestEnd = end;
      }
      if (end - start > target) {
        passed = true;
        break;
      }
    }
    if (passed) break;
  }

  return {
    from: { surahIndex: startSurah, ayah: wholeSurahs ? null : startAyah },
    to: best,
    amount: Math.max(0.5, Math.round(((bestEnd - start) / 10 / LINES_PER_PAGE) * 2) / 2),
    unit: "pages",
  };
}
