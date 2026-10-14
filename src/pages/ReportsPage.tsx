import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { appsScriptJsonp } from "../utils/appsScript.js";

// صفحات تقارير أولياء الأمور داخل الموقع نفسه:
// Apps Script يرجع البيانات فقط (JSON)، والموقع يرسم التقرير بسرعة،
// مع حفظ آخر نسخة في المتصفح حتى يظهر التقرير فوراً عند إعادة فتحه.

type ReportDay = {
  date: string;
  displayDate: string;
  dayName: string;
  hudur: string;
  hifzFrom: string;
  hifzTo: string;
  hifzScore: number;
  muraFrom: string;
  muraTo: string;
  muraScore: number;
  haqiba: string;
  istima: string;
  total: number;
  note: string;
  hasRecord: boolean;
};

type Report = {
  studentName: string;
  teacherName: string;
  teamId: string;
  teamName: string;
  weekNumber: number;
  weekTitle: string;
  dateRange: string;
  pointsTotal: number;
  target: number;
  metrics: { attendance: number; hifz: number; review: number; bag: number; listening: number; overall: number };
  grade: string;
  days: ReportDay[];
  assignment: { hifz: string; review: string };
  positives: string[];
  improvements: string[];
  teacherNote: string;
  hasAnyRecord: boolean;
};

type Dashboard = {
  generatedAt: string;
  weeks: { number: number; title: string; target: number }[];
  teams: { id: string; name: string; students: { name: string; weeks: [number, number][] }[] }[];
};

const THEME_KEY = "sailor-race:theme";
const CACHE_PREFIX = "sailor-race:reports:";
const LOGO_SRC = `${import.meta.env.BASE_URL}mawadda-mark.png`;

// ── الثيم ────────────────────────────────────────────────────────────────
function initialTheme(): "dark" | "light" {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // التخزين المحلي اختياري
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // التخزين المحلي اختياري
    }
  };
  return { theme, toggle };
}

// ── جلب البيانات مع نسخة محفوظة تظهر فوراً ثم تتحدث في الخلفية ─────────────
function readCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
  } catch {
    // التخزين المحلي اختياري
  }
}

function useCachedData<T>(cacheKey: string, load: (fresh: boolean) => Promise<T>) {
  // النتيجة مربوطة بمفتاحها؛ عند تغيّر المفتاح نعرض النسخة المحفوظة حتى تصل الجديدة.
  const [result, setResult] = useState<{ key: string; nonce: number; data: T | null; error: string } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    load(nonce > 0)
      .then((value) => {
        if (cancelled) return;
        writeCache(cacheKey, value);
        setResult({ key: cacheKey, nonce, data: value, error: "" });
      })
      .catch((err) => {
        if (cancelled) return;
        setResult({ key: cacheKey, nonce, data: null, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
    // load يتغير مع المفتاح نفسه
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const settled = result && result.key === cacheKey && result.nonce === nonce;
  const data = (settled && result.data) || readCache<T>(cacheKey);
  return { data, loading: !settled, error: settled ? result.error : "", reload };
}

function reportLink(name: string, teamId: string, week: number): string {
  const query = new URLSearchParams({ name, team: teamId, week: String(week) });
  return `${window.location.origin}${window.location.pathname}#/report?${query.toString()}`;
}

function whatsappHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function shareText(name: string, weekTitle: string, link: string): string {
  return `السلام عليكم ورحمة الله\nتقرير الطالب ${name} — ${weekTitle}\nمسابقة ربيع القلوب\n${link}`;
}

function gradeFor(pct: number): string {
  if (pct >= 90) return "متميز";
  if (pct >= 80) return "ممتاز";
  if (pct >= 70) return "جيد جداً";
  if (pct >= 60) return "جيد";
  return "يحتاج متابعة";
}

function pct(points: number, target: number): number {
  return target ? Math.max(0, Math.min(100, Math.round((points / target) * 100))) : 0;
}

function toneFor(value: number): string {
  if (value >= 80) return "var(--ok)";
  if (value >= 60) return "var(--gold)";
  return "var(--danger-text)";
}

function rangeText(from: string, to: string): string {
  if (from === "لا يوجد" || to === "لا يوجد") return "لا يوجد";
  if (from && to) return from === to ? from : `${from} ← ${to}`;
  return from || to || "";
}

// ── أجزاء مشتركة ──────────────────────────────────────────────────────────
function Shell({ children, theme, onToggleTheme, subtitle }: {
  children: React.ReactNode;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  subtitle: string;
}) {
  return (
    <div className="rq">
      <style>{CSS}</style>
      <header className="rq-top">
        <img src={LOGO_SRC} alt="" className="rq-logo" />
        <div className="rq-top-text">
          <div className="rq-brand">ربيع القلوب</div>
          <div className="rq-sub">{subtitle}</div>
        </div>
        <button className="rq-icon-btn no-print" onClick={onToggleTheme} aria-label="تبديل الثيم">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>
      <main className="rq-main">{children}</main>
      <footer className="rq-foot">مجمع المودة القرآني · مسابقة ربيع القلوب</footer>
    </div>
  );
}

function Ring({ value, size = 132 }: { value: number; size?: number }) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rq-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--fg) / 0.1)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={toneFor(value)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="rq-ring-num">{value}%</text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" className="rq-ring-label">الإنجاز</text>
    </svg>
  );
}

function Bar({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="rq-bar">
      <div className="rq-bar-head">
        <span>{icon} {label}</span>
        <b style={{ color: toneFor(value) }}>{value}%</b>
      </div>
      <div className="rq-bar-track">
        <div className="rq-bar-fill" style={{ width: `${value}%`, background: toneFor(value) }} />
      </div>
    </div>
  );
}

function StatusLine({ loading, error, hasData, onRetry }: {
  loading: boolean;
  error: string;
  hasData: boolean;
  onRetry: () => void;
}) {
  if (loading && hasData) return <div className="rq-status no-print">⟳ جاري التحديث…</div>;
  if (error && hasData) {
    return (
      <div className="rq-status no-print">
        تعذر التحديث، المعروض آخر نسخة محفوظة · <button className="rq-link-btn" onClick={onRetry}>إعادة المحاولة</button>
      </div>
    );
  }
  return null;
}

function Skeleton() {
  return (
    <div className="rq-skel-wrap" aria-label="جاري التحميل">
      <div className="rq-skel" style={{ height: 180 }} />
      <div className="rq-skel" style={{ height: 150 }} />
      <div className="rq-skel" style={{ height: 260 }} />
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rq-card rq-center">
      <div style={{ fontSize: 34 }}>⚠️</div>
      <div className="rq-muted" style={{ margin: "8px 0 14px" }}>{message}</div>
      <button className="rq-btn rq-btn-primary" onClick={onRetry}>إعادة المحاولة</button>
    </div>
  );
}

// ── تقرير الطالب ─────────────────────────────────────────────────────────
export function ParentReportPage() {
  const { theme, toggle } = useTheme();
  const [params, setParams] = useSearchParams();
  const name = (params.get("name") || "").trim();
  const teamId = (params.get("team") || "").trim();
  const weekParam = Number(params.get("week") || 0);
  const week = weekParam > 0 ? weekParam : 0;

  const cacheKey = `report|${teamId}|${week}|${name}`;
  const load = (fresh: boolean) =>
    appsScriptJsonp<{ status: string; report?: Report; message?: string }>("reportData", {
      studentName: name,
      teamId,
      ...(week ? { week: String(week) } : {}),
      ...(fresh ? { fresh: "1" } : {}),
    }).then((res) => {
      if (res.status !== "ok" || !res.report) throw new Error(res.message || "تعذر تحميل التقرير");
      return res.report;
    });
  const { data: report, loading, error, reload } = useCachedData<Report>(cacheKey, load);

  useEffect(() => {
    document.title = report ? `تقرير ${report.studentName} — ${report.weekTitle}` : "تقرير ولي الأمر";
  }, [report]);

  const goWeek = (n: number) => {
    const next = new URLSearchParams(params);
    next.set("week", String(n));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!name || !teamId) {
    return (
      <Shell theme={theme} onToggleTheme={toggle} subtitle="تقرير ولي الأمر">
        <div className="rq-card rq-center">الرابط غير مكتمل، اطلب من المعلم إرسال رابط التقرير مرة أخرى.</div>
      </Shell>
    );
  }

  const currentWeek = report?.weekNumber || week || 1;
  const link = reportLink(name, teamId, currentWeek);
  const recordedDays = report ? report.days.filter((d) => d.hasRecord).length : 0;

  return (
    <Shell theme={theme} onToggleTheme={toggle} subtitle="التقرير الأسبوعي لولي الأمر">
      {!report && loading && <Skeleton />}
      {!report && !loading && error && <ErrorBox message={error} onRetry={reload} />}
      {report && (
        <div className="rq-stack rq-fade">
          <StatusLine loading={loading} error={error} hasData onRetry={reload} />

          <section className="rq-card rq-hero">
            <div className="rq-hero-info">
              <div className="rq-chip">{report.teamName}</div>
              <h1 className="rq-name">{report.studentName}</h1>
              <div className="rq-week">{report.weekTitle}</div>
              <div className="rq-muted rq-small">{report.dateRange}</div>
              <div className="rq-points">
                <b>{report.pointsTotal}</b>
                <span> / {report.target} نقطة</span>
              </div>
              <div className="rq-grade" style={{ color: toneFor(report.metrics.overall) }}>
                {report.grade}
              </div>
            </div>
            <Ring value={report.metrics.overall} />
          </section>

          <nav className="rq-weeknav no-print">
            <button className="rq-btn" disabled={currentWeek <= 1} onClick={() => goWeek(currentWeek - 1)}>→ الأسبوع السابق</button>
            <button className="rq-btn" onClick={() => goWeek(currentWeek + 1)}>الأسبوع التالي ←</button>
          </nav>

          {!report.hasAnyRecord ? (
            <section className="rq-card rq-center">
              <div style={{ fontSize: 34 }}>📭</div>
              <div className="rq-muted" style={{ marginTop: 8 }}>لا توجد تسجيلات لهذا الأسبوع بعد.</div>
            </section>
          ) : (
            <>
              <section className="rq-card">
                <h2 className="rq-h2">مؤشرات الأداء</h2>
                <div className="rq-bars">
                  <Bar icon="🕌" label="الحضور" value={report.metrics.attendance} />
                  <Bar icon="📖" label="الحفظ" value={report.metrics.hifz} />
                  <Bar icon="🔁" label="المراجعة" value={report.metrics.review} />
                  <Bar icon="🎒" label="الحقيبة" value={report.metrics.bag} />
                  <Bar icon="🎧" label="الإستماع" value={report.metrics.listening} />
                </div>
              </section>

              <section className="rq-card">
                <h2 className="rq-h2">المقرر هذا الأسبوع</h2>
                <div className="rq-assign">
                  <div><span className="rq-muted">الحفظ</span><b>{report.assignment.hifz}</b></div>
                  <div><span className="rq-muted">المراجعة</span><b>{report.assignment.review}</b></div>
                </div>
              </section>

              <section className="rq-card">
                <h2 className="rq-h2">تفاصيل الأيام <span className="rq-muted rq-small">({recordedDays} من {report.days.length})</span></h2>
                <div className="rq-days">
                  {report.days.map((d) => (
                    <DayCard key={d.date} day={d} />
                  ))}
                </div>
              </section>

              <section className="rq-two">
                <div className="rq-card">
                  <h2 className="rq-h2">✨ نقاط القوة</h2>
                  <ul className="rq-list rq-list-ok">
                    {report.positives.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
                <div className="rq-card">
                  <h2 className="rq-h2">🌱 فرص التحسين</h2>
                  <ul className="rq-list rq-list-up">
                    {report.improvements.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              </section>

              {report.teacherNote && (
                <section className="rq-card rq-note">
                  <h2 className="rq-h2">📝 ملاحظة المعلم{report.teacherName ? ` — ${report.teacherName}` : ""}</h2>
                  <p>{report.teacherNote}</p>
                </section>
              )}
            </>
          )}

          <div className="rq-actions no-print">
            <a className="rq-btn rq-btn-wa" href={whatsappHref(shareText(report.studentName, report.weekTitle, link))} target="_blank" rel="noreferrer">
              مشاركة واتساب
            </a>
            <button className="rq-btn" onClick={() => window.print()}>حفظ PDF / طباعة</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function DayCard({ day }: { day: ReportDay }) {
  const absent = day.hudur === "غائب";
  const hifz = rangeText(day.hifzFrom, day.hifzTo);
  const mura = rangeText(day.muraFrom, day.muraTo);
  return (
    <div className={`rq-day${day.hasRecord ? "" : " rq-day-empty"}`}>
      <div className="rq-day-head">
        <div>
          <b>{day.dayName}</b>
          <span className="rq-muted rq-small"> {day.displayDate}</span>
        </div>
        {day.hasRecord ? (
          <span className={`rq-pill ${absent ? "rq-pill-bad" : "rq-pill-ok"}`}>{day.hudur}</span>
        ) : (
          <span className="rq-pill">لا يوجد تسجيل</span>
        )}
      </div>
      {day.hasRecord && !absent && (
        <div className="rq-day-body">
          <div className="rq-day-row">
            <span className="rq-muted">الحفظ</span>
            <span className="rq-range">{hifz || "—"}</span>
            <b>{day.hifzScore}</b>
          </div>
          <div className="rq-day-row">
            <span className="rq-muted">المراجعة</span>
            <span className="rq-range">{mura || "—"}</span>
            <b>{day.muraScore}</b>
          </div>
          <div className="rq-day-tags">
            <span className={day.haqiba === "نعم" ? "rq-tag-ok" : "rq-tag-no"}>🎒 الحقيبة</span>
            <span className={day.istima === "نعم" ? "rq-tag-ok" : "rq-tag-no"}>🎧 الإستماع</span>
            <span className="rq-day-total">{day.total} نقطة</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── لوحة المعلم: كل الطلاب وروابطهم ─────────────────────────────────────────
export function ReportsDashboardPage() {
  const { theme, toggle } = useTheme();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");

  const load = (fresh: boolean) =>
    appsScriptJsonp<{ status: string; dashboard?: Dashboard; currentWeek?: number; message?: string }>(
      "reportsDashboardData",
      fresh ? { fresh: "1" } : {},
    ).then((res) => {
      if (res.status !== "ok" || !res.dashboard) throw new Error(res.message || "تعذر تحميل اللوحة");
      return { dashboard: res.dashboard, currentWeek: res.currentWeek || 1 };
    });
  const { data, loading, error, reload } = useCachedData<{ dashboard: Dashboard; currentWeek: number }>("dashboard", load);

  useEffect(() => {
    document.title = "تقارير أولياء الأمور";
  }, []);

  const dashboard = data?.dashboard;
  const teamId = params.get("team") || dashboard?.teams[0]?.id || "";
  const week = Number(params.get("week") || data?.currentWeek || 1);
  const team = dashboard?.teams.find((t) => t.id === teamId) || dashboard?.teams[0];
  const weekInfo = dashboard?.weeks.find((w) => w.number === week);
  const target = weekInfo?.target || 0;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === "team" && !next.get("week")) next.set("week", String(week));
    setParams(next, { replace: true });
  };

  const q = search.trim();
  const rows = !team ? [] : team.students
      .filter((s) => !q || s.name.includes(q))
      .map((s) => {
        const [points, days] = s.weeks[week - 1] || [0, 0];
        return { name: s.name, points, days, percent: pct(points, target) };
      });

  const weekTitle = weekInfo ? weekInfo.title.replace(/\s*\(.*\)$/, "") : `الأسبوع ${week}`;

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(tag);
    window.setTimeout(() => setCopied(""), 1800);
  };

  const copyAll = () => {
    if (!team) return;
    const text = rows
      .filter((r) => r.days > 0)
      .map((r) => `${r.name}:\n${reportLink(r.name, team.id, week)}`)
      .join("\n\n");
    copy(`تقارير ${team.name} — ${weekTitle}\n\n${text}`, "__all");
  };

  const withData = rows.filter((r) => r.days > 0).length;

  return (
    <Shell theme={theme} onToggleTheme={toggle} subtitle="لوحة تقارير أولياء الأمور">
      {!dashboard && loading && <Skeleton />}
      {!dashboard && !loading && error && <ErrorBox message={error} onRetry={reload} />}
      {dashboard && team && (
        <div className="rq-stack rq-fade">
          <StatusLine loading={loading} error={error} hasData onRetry={reload} />

          <div className="rq-chips">
            {dashboard.teams.map((t) => (
              <button key={t.id} className={`rq-chip-btn${t.id === team.id ? " active" : ""}`} onClick={() => setParam("team", t.id)}>
                {t.name}
              </button>
            ))}
          </div>

          <div className="rq-filters">
            <select className="rq-input" value={week} onChange={(e) => setParam("week", e.target.value)}>
              {dashboard.weeks.map((w) => (
                <option key={w.number} value={w.number}>
                  {w.title}{w.number === data?.currentWeek ? " • الحالي" : ""}
                </option>
              ))}
            </select>
            <input className="rq-input" placeholder="بحث عن طالب…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="rq-summary">
            <span>{withData} من {rows.length} طالب لديهم تسجيلات</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="rq-btn rq-btn-sm" onClick={reload}>تحديث</button>
              <button className="rq-btn rq-btn-sm rq-btn-primary" onClick={copyAll} disabled={!withData}>
                {copied === "__all" ? "تم النسخ ✓" : "نسخ كل الروابط"}
              </button>
            </div>
          </div>

          <div className="rq-rows">
            {rows.map((r) => {
              const link = reportLink(r.name, team.id, week);
              const reportPath = `/report?${new URLSearchParams({ name: r.name, team: team.id, week: String(week) }).toString()}`;
              return (
                <div key={r.name} className={`rq-row${r.days ? "" : " rq-row-empty"}`}>
                  <Link to={reportPath} className="rq-row-main">
                    <div className="rq-row-name">{r.name}</div>
                    <div className="rq-row-meta">
                      {r.days ? (
                        <>
                          <span>{r.points} من {target}</span>
                          <span style={{ color: toneFor(r.percent) }}>{gradeFor(r.percent)}</span>
                          <span className="rq-muted">{r.days} أيام</span>
                        </>
                      ) : (
                        <span className="rq-muted">لا توجد تسجيلات</span>
                      )}
                    </div>
                    <div className="rq-bar-track rq-row-bar">
                      <div className="rq-bar-fill" style={{ width: `${r.percent}%`, background: toneFor(r.percent) }} />
                    </div>
                  </Link>
                  <div className="rq-row-actions">
                    <a className="rq-icon-btn rq-wa" href={whatsappHref(shareText(r.name, weekTitle, link))} target="_blank" rel="noreferrer" aria-label="واتساب">
                      <WhatsAppIcon />
                    </a>
                    <button className="rq-icon-btn" onClick={() => copy(link, r.name)} aria-label="نسخ الرابط">
                      {copied === r.name ? "✓" : "🔗"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rq-muted rq-small rq-center">آخر تحديث للبيانات: {dashboard.generatedAt}</div>
        </div>
      )}
    </Shell>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
html, body, #root { overflow-y: auto; height: auto; min-height: 100%; }
:root, :root[data-theme="dark"] {
  color-scheme: dark;
  --fg: 255 255 255; --text: #eef3fb; --page-bg: #0b1220; --surface: #121b2d; --surface-2: #18233a;
  --input-bg: #0f1829; --primary: #14b8a6; --gold: #fcd34d; --ok: #4ade80; --danger-text: #fca5a5;
}
:root[data-theme="light"] {
  color-scheme: light;
  --fg: 15 23 42; --text: #0f172a; --page-bg: #f1f4f9; --surface: #ffffff; --surface-2: #f6f8fc;
  --input-bg: #ffffff; --primary: #0d9488; --gold: #b45309; --ok: #15803d; --danger-text: #b91c1c;
}
body { background: var(--page-bg); color: var(--text); }
.rq { min-height: 100vh; font-family: 'Tajawal', sans-serif; direction: rtl; color: var(--text); background: var(--page-bg); }
.rq-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 10px; padding: 10px 16px;
  background: color-mix(in srgb, var(--page-bg) 88%, transparent); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
  border-bottom: 1px solid rgb(var(--fg) / 0.07); }
.rq-logo { width: 40px; height: 40px; object-fit: contain; }
.rq-top-text { flex: 1; min-width: 0; }
.rq-brand { font-weight: 900; font-size: 17px; }
.rq-sub { font-size: 12px; color: rgb(var(--fg) / 0.55); }
.rq-main { max-width: 760px; margin: 0 auto; padding: 16px 16px 28px; }
.rq-foot { text-align: center; padding: 8px 16px 28px; font-size: 12px; color: rgb(var(--fg) / 0.4); }
.rq-stack { display: flex; flex-direction: column; gap: 14px; }
.rq-fade { animation: rqFade 0.35s ease; }
@keyframes rqFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.rq-card { background: var(--surface); border: 1px solid rgb(var(--fg) / 0.08); border-radius: 18px; padding: 16px; }
.rq-center { text-align: center; }
.rq-muted { color: rgb(var(--fg) / 0.55); }
.rq-small { font-size: 12.5px; }
.rq-h2 { font-size: 15px; font-weight: 800; margin-bottom: 12px; }
.rq-hero { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, var(--surface)), var(--surface)); }
.rq-hero-info { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.rq-chip { align-self: flex-start; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 18%, transparent); color: var(--primary); }
.rq-name { font-size: 24px; font-weight: 900; line-height: 1.3; }
.rq-week { font-weight: 700; }
.rq-points { margin-top: 6px; font-size: 14px; color: rgb(var(--fg) / 0.65); }
.rq-points b { font-size: 26px; color: var(--text); font-weight: 900; }
.rq-grade { font-weight: 900; font-size: 16px; }
.rq-ring { flex-shrink: 0; }
.rq-ring-num { font: 900 26px 'Tajawal', sans-serif; fill: var(--text); }
.rq-ring-label { font: 500 12px 'Tajawal', sans-serif; fill: rgb(var(--fg) / 0.55); }
.rq-weeknav { display: flex; gap: 10px; }
.rq-weeknav .rq-btn { flex: 1; }
.rq-bars { display: flex; flex-direction: column; gap: 12px; }
.rq-bar-head { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 6px; }
.rq-bar-track { height: 8px; border-radius: 999px; background: rgb(var(--fg) / 0.08); overflow: hidden; }
.rq-bar-fill { height: 100%; border-radius: 999px; transition: width 0.8s ease; }
.rq-assign { display: grid; gap: 10px; }
.rq-assign > div { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); }
.rq-assign b { font-weight: 700; }
.rq-days { display: grid; gap: 10px; }
.rq-day { border-radius: 14px; background: var(--surface-2); padding: 12px; border: 1px solid rgb(var(--fg) / 0.05); }
.rq-day-empty { opacity: 0.6; }
.rq-day-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rq-day-body { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.rq-day-row { display: grid; grid-template-columns: 64px 1fr auto; gap: 8px; align-items: center; }
.rq-range { min-width: 0; overflow-wrap: anywhere; }
.rq-day-tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12.5px; }
.rq-day-tags span { padding: 3px 9px; border-radius: 999px; }
.rq-tag-ok { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
.rq-tag-no { background: rgb(var(--fg) / 0.06); color: rgb(var(--fg) / 0.45); text-decoration: line-through; }
.rq-day-total { margin-inline-start: auto; font-weight: 800; color: var(--gold); }
.rq-pill { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: rgb(var(--fg) / 0.07); color: rgb(var(--fg) / 0.6); white-space: nowrap; }
.rq-pill-ok { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
.rq-pill-bad { background: color-mix(in srgb, var(--danger-text) 16%, transparent); color: var(--danger-text); }
.rq-two { display: grid; gap: 14px; }
@media (min-width: 640px) { .rq-two { grid-template-columns: 1fr 1fr; } .rq-assign { grid-template-columns: 1fr 1fr; } }
.rq-list { list-style: none; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.rq-list li { padding-inline-start: 18px; position: relative; line-height: 1.6; }
.rq-list li::before { content: ''; position: absolute; inset-inline-start: 0; top: 0.6em; width: 7px; height: 7px; border-radius: 50%; }
.rq-list-ok li::before { background: var(--ok); }
.rq-list-up li::before { background: var(--gold); }
.rq-note p { line-height: 1.8; }
.rq-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rq-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 14px;
  border-radius: 12px; border: 1px solid rgb(var(--fg) / 0.12); background: var(--surface); color: var(--text);
  font: 700 14px 'Tajawal', sans-serif; cursor: pointer; text-decoration: none; transition: filter 0.15s, transform 0.1s; }
.rq-btn:active { transform: scale(0.98); }
.rq-btn:disabled { opacity: 0.4; cursor: default; }
.rq-btn-sm { min-height: 36px; font-size: 13px; }
.rq-btn-primary { background: var(--primary); border-color: var(--primary); color: #fff; }
.rq-btn-wa { background: #25d366; border-color: #25d366; color: #fff; }
.rq-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px;
  border: 1px solid rgb(var(--fg) / 0.12); background: var(--surface); color: var(--text); font-size: 17px; cursor: pointer; text-decoration: none; flex-shrink: 0; }
.rq-wa { color: #25d366; }
.rq-link-btn { background: none; border: none; color: var(--primary); font: inherit; font-weight: 700; cursor: pointer; }
.rq-status { font-size: 12.5px; text-align: center; color: rgb(var(--fg) / 0.55); }
.rq-skel-wrap { display: flex; flex-direction: column; gap: 14px; }
.rq-skel { border-radius: 18px; background: linear-gradient(90deg, rgb(var(--fg) / 0.05), rgb(var(--fg) / 0.1), rgb(var(--fg) / 0.05));
  background-size: 200% 100%; animation: rqShine 1.2s linear infinite; }
@keyframes rqShine { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.rq-chips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.rq-chip-btn { min-width: 0; min-height: 40px; padding: 0 4px; white-space: nowrap; border-radius: 999px; border: 1px solid rgb(var(--fg) / 0.12);
  background: var(--surface); color: var(--text); font: 700 14px 'Tajawal', sans-serif; cursor: pointer; }
.rq-chip-btn.active { background: var(--primary); border-color: var(--primary); color: #fff; }
.rq-filters { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.rq-input { min-width: 0; min-height: 44px; padding: 0 12px; border-radius: 12px; border: 1px solid rgb(var(--fg) / 0.12);
  background: var(--input-bg); color: var(--text); font: 500 14px 'Tajawal', sans-serif; }
.rq-summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 13px; color: rgb(var(--fg) / 0.6); }
.rq-rows { display: flex; flex-direction: column; gap: 8px; }
.rq-row { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: var(--surface); border: 1px solid rgb(var(--fg) / 0.07); }
.rq-row-empty { opacity: 0.6; }
.rq-row-main { flex: 1; min-width: 0; color: inherit; text-decoration: none; display: flex; flex-direction: column; gap: 4px; }
.rq-row-name { font-weight: 800; }
.rq-row-meta { display: flex; gap: 10px; flex-wrap: wrap; font-size: 12.5px; }
.rq-row-bar { height: 5px; margin-top: 2px; }
.rq-row-actions { display: flex; gap: 6px; }
@media print {
  .no-print, .rq-top .rq-icon-btn { display: none !important; }
  .rq-top { position: static; }
  .rq-card, .rq-day { break-inside: avoid; }
}
`;
