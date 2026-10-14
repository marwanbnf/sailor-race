/**
 * ══════════════════════════════════════════════════════════════
 *  سباق البحارة — Google Apps Script
 *  النظام الجديد:
 *  - أوراق الحلقات = أسماء الطلاب، وجميع الحلقات بنفس البنية
 *  - ورقة البيانات = قاعدة البيانات الأساسية
 *  - التقارير الأسبوعية والختامية تُبنى من ورقة البيانات
 *  - AdminPage يسحب أسماء الطلاب من أوراق الحلقات
 *  - تعديل: صف الإجمالي الأسبوعي يلخص الحضور والحفظ والمراجعة والحقيبة و الإستماع
 *  - تعديل: التقرير الختامي يعرض كل أيام الأسبوع حتى الأيام التي لا يوجد لها سجل
 *  - تسريع: حفظ الأدمن صار سريع، والتقارير تتحدث بالخلفية عند وجود تغييرات
 *  - دمج: تقرير واحد لكل حلقة يحتوي الطالب > الأسابيع > أيام الأسبوع
 *  - تعديل العرض: عند فتح تقرير الحلقة تظهر أسماء الطلاب فقط، والتفاصيل تظهر من علامة +
 *  - تنظيف: أزيلت نسخ الحفظ القديمة V3/V4/V5، مع الإبقاء على V7 الحالي والتقارير والصيانة.
 * ══════════════════════════════════════════════════════════════
 */

// ─── إعدادات الأوراق ──────────────────────────────────────────
// المعرّف الافتراضي لملف Google Sheets الحالي (التقرير 1448 (جديد)).
// يمكن تجاوزه بوضع خاصية سكربت باسم SPREADSHEET_ID (يقبل المعرّف أو الرابط كاملاً).
const SPREADSHEET_ID_FALLBACK = '1FwGX-vbNahkwD8ZaX1y7vIIpFILvhSDNFhN8yJCer9Y';

function resolveSpreadsheetId_() {
  // يقبل القيمة المحفوظة كمعرّف أو كرابط كامل، ويستخرج المعرّف منه تلقائياً.
  let saved = '';
  try { saved = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim(); } catch (e) {}
  if (saved) {
    const m = saved.match(/\/d\/([a-zA-Z0-9_-]+)/); // لو تم لصق الرابط كاملاً
    const id = m ? m[1] : saved;
    // حماية: معرّف Google Sheets دائماً 44 حرفاً. أي قيمة أقصر غالباً لصق ناقص،
    // فنتجاهلها ونستخدم المعرّف المدمج أدناه حتى لا يتعطل النظام بصمت.
    if (id.length === 44) return id;
  }
  if (SPREADSHEET_ID_FALLBACK) return SPREADSHEET_ID_FALLBACK;
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active.getId();
  } catch (e) {}
  return '';
}

function CHECK_SYSTEM_CONNECTION() {
  // شغّل هذه الدالة قبل أي شيء للتأكد أن الاتصال بالشيت سليم.
  const id = resolveSpreadsheetId_();
  const lines = [];
  lines.push('المعرّف المحفوظ: ' + (id ? id : '(فارغ)'));
  if (id) {
    lines.push('عدد الأحرف: ' + id.length + ' (المفروض 44)');
    try {
      const ss = SpreadsheetApp.openById(id);
      lines.push('✅ تم الاتصال بنجاح بالملف: ' + ss.getName());
      lines.push('الأوراق: ' + ss.getSheets().map(function(s) { return s.getName(); }).join(' ، '));
    } catch (err) {
      lines.push('❌ فشل الاتصال: ' + err.message);
    }
  } else {
    lines.push('❌ لا يوجد معرّف محفوظ.');
    lines.push('الحل: ⚙️ إعدادات المشروع → خصائص السكربت → أضف خاصية باسم SPREADSHEET_ID وقيمتها رابط الشيت كاملاً.');
  }
  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}
const SPREADSHEET_ID = resolveSpreadsheetId_();
const APP_TIMEZONE = 'Asia/Riyadh';

const SHEET_LOG     = 'البيانات';
const SHEET_MONTHLY = 'التقرير الشهري';

const TEAM_SHEETS = {
  blue   : 'حلقة أولى',
  red    : 'حلقة ثاني',
  green  : 'حلقة ثالث',
  purple : 'حلقة رابع',
};

const TEAM_NAMES = {
  blue   : 'أزرق',
  red    : 'أحمر',
  green  : 'أخضر',
  purple : 'بنفسجي',
};

// ─── الفصول الديناميكية للمدرسة ────────────────────────────────
// المرحلة الحالية لا تلغي نظام الحلقات القديم؛ تضيف API مستقلاً للفصول.
// أي Sheet يبدأ اسمه بـ "فصل" يُسجل كفصل. بعد تسجيله لأول مرة نحفظ sheetId
// في Script Properties، لذلك يمكن تغيير اسم الشيت لاحقاً ويبقى نفس الفصل
// ونفس classId بدون الاعتماد على الاسم أو ترتيب الأوراق.
const CLASS_SHEET_PREFIX = 'فصل';
const CLASS_SHEET_REGISTRY_KEY = 'DYNAMIC_CLASS_SHEET_IDS_V1';
// سجل ثابت يربط مكان الفصل (1..19) بـ sheetId. بعد تثبيته يمكن تغيير اسم الشيت
// بحرية بدون أن ينتقل الفصل بين نسخ العرض.
const CLASS_SLOT_REGISTRY_KEY = 'DYNAMIC_CLASS_SLOTS_V2';
const SCHOOL_CLASS_COUNT = 19;


// أسماء بديلة للأوراق — مهم جداً لأن حلقة أولى قد تُكتب بأكثر من شكل:
// حلقة أولى / حلقة اولى / الحلقة الأولى / حلقة الاولى ... إلخ.
const TEAM_SHEET_ALIASES = {
  blue: [
    'حلقة أولى', 'حلقة اولى', 'حلقة أولي', 'حلقة اولي',
    'الحلقة الأولى', 'الحلقة الاولى', 'حلقة الأولى', 'حلقة الاولى',
    'حلقه أولى', 'حلقه اولى', 'حلقه أولي', 'حلقه اولي'
  ],
  red: [
    'حلقة ثاني', 'حلقة ثانية', 'الحلقة الثانية', 'حلقة الثاني',
    'حلقه ثاني', 'حلقه ثانية'
  ],
  green: [
    'حلقة ثالث', 'حلقة ثالثة', 'الحلقة الثالثة', 'حلقة الثالث',
    'حلقه ثالث', 'حلقه ثالثة'
  ],
  purple: [
    'حلقة رابع', 'حلقة رابعة', 'الحلقة الرابعة', 'حلقة الرابع',
    'حلقه رابع', 'حلقه رابعة'
  ],
};

// أوراق الحلقات: جميع الحلقات بنفس البنية — اسم الطالب فقط.
// أوراق الحلقات: قائمة الطلاب هي المصدر المعتمد للعضوية.
// لا يوجد عمود "إجراء": حذف الاسم من ورقة الحلقة يعني حذفه نهائياً من بيانات تلك الحلقة وتقريرها.
const ROSTER_HEADERS = ['اسم الطالب'];
const FIRST_CIRCLE_ROSTER_HEADERS = ['اسم الطالب'];
const ROSTER_NAME_COL = 1;
const FIRST_CIRCLE_TRACK_COL = 2;
const FIRST_CIRCLE_TRACK_OPTIONS = ['الحفظ والمراجعة', 'القاعدة النورانية', 'التلاوة'];
const FIRST_CIRCLE_REPORT_THEMES = {
  'nurania': {
    header: '#b7791f',
    week: '#fef3c7',
    day: '#fffbeb'
  },
  'tilawa': {
    header: '#0e7490',
    week: '#cffafe',
    day: '#ecfeff'
  },
  'hifz-review': {
    header: '#166534',
    week: '#dcfce7',
    day: '#f0fdf4'
  }
};
const FIRST_CIRCLE_SECTION_PREFIX = '◆ مسار: ';
const FIRST_CIRCLE_TRACK_REPORT_VERSION = 'V2-2026-07-26';
const FAST_SAVE_RECENT_ROWS_V3 = 2500;

const FAST_SAVE_VERSION_V6 = 'FAST-SAVE-V6-ULTRA-PER-STUDENT-2026-07-28';
const FAST_SAVE_VERSION_V7 = 'FAST-SAVE-V7-INSTANT-WITH-DIRECT-STUDENT-REPORT-2026-07-28';
const V6_ENTRY_INDEX_PREFIX = 'V6_ENTRY_INDEX_';
const V6_REPORT_QUEUE_PREFIX = 'V6_REPORT_QUEUE_';
const V6_REPORT_WORKER_ACTIVE_KEY = 'V6_REPORT_WORKER_ACTIVE';
const V6_REPORT_BATCH = 40;
const V6_REPORT_MAX_ATTEMPTS = 5;

// قاعدة البيانات الأساسية
const COL = {
  DATE       : 1,
  STUDENT    : 2,
  HUDUR      : 3,
  HIFZ_FROM  : 4,
  HIFZ_TO    : 5,
  HIFZ_SCORE : 6,
  MURA_FROM  : 7,
  MURA_TO    : 8,
  MURA_SCORE : 9,
  HAQIBA     : 10,
  ISTIMA     : 11,
  TOTAL      : 12,
  NOTE       : 13,
  TEAM       : 14,
  CLASS_ID   : 15,
};

const HEADERS = [
  'التاريخ', 'الطالب', 'الحضور',
  'الحفظ من', 'الحفظ إلى', 'تقدير الحفظ',
  'المراجعة من', 'المراجعة إلى', 'تقدير المراجعة',
  'إحضار الحقيبة', 'الإستماع',
  'المجموع', 'ملاحظة', 'الفصل / الحلقة', 'معرف الفصل'
];

const WEEKLY_HEADERS = [
  'اليوم', 'التاريخ', 'الحضور',
  'الحفظ من', 'الحفظ إلى', 'تقدير الحفظ',
  'المراجعة من', 'المراجعة إلى', 'تقدير المراجعة',
  'إحضار الحقيبة', '',
  'نقاط اليوم', 'نسبة الأسبوع'
];

const FINAL_HEADERS = [
  'البيان', 'الفترة', 'الحضور', 'الحفظ', 'المراجعة', 'النقاط', 'التقييم / ملاحظة'
];

// التقرير الموحد: شيت واحد لكل حلقة بدلاً من الأسبوعي والختامي المنفصلين
const UNIFIED_PREFIX = 'تقرير ';
const COURSE_WEEKS_COUNT = 13;
// سنة 1448هـ: تبدأ الأحد 11/10/2026 وتنتهي يوم الأربعاء 28/7/1448هـ الموافق 06/01/2027م.
// الأسبوع الدراسي: الأحد إلى الأربعاء (4 أيام)، وكل أسبوع يبدأ الأحد.
// عدد الأسابيع: 13 أسبوعاً كاملاً — الأخير ينتهي بالضبط الأربعاء 06/01/2027.
const COURSE_START_DATE = '2026-10-11';
const COURSE_END_DATE = '2027-01-06';
const CANCELED_SESSION_DATES = [];
const UNIFIED_HEADERS = [
  'اسم الطالب / الأسبوع / اليوم',
  'الحضور',
  'الحفظ من', 'الحفظ إلى', 'نقاط الحفظ',
  'المراجعة من', 'المراجعة إلى', 'نقاط المراجعة',
  'إحضار الحقيبة', 'الإستماع',
  'النقاط', 'الأصل', 'النسبة / ملاحظة'
];

// ملخص الحلقة الأسبوعي داخل كل تقرير حلقة، وتحته إجمالي نقاط كل يوم.
const ENABLE_CIRCLE_WEEKLY_SUMMARY = true;
const CIRCLE_WEEKLY_SUMMARY_PREFIX = 'ملخص الحلقة — الأسبوع ';
const CIRCLE_DAILY_SUMMARY_PREFIX = 'إجمالي الحلقة لليوم — ';

const DAY_NAMES_AR = ['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

// برنامج السنة كاملة: كل أسبوع من الأحد إلى الأربعاء.
const SESSION_DAYS = [0, 1, 2, 3];
const WEEK_DAYS_COUNT = SESSION_DAYS.length;
const WEEKLY_TARGET = WEEK_DAYS_COUNT * 100;
const SESSION_DAYS_LABEL = 'الأحد إلى الأربعاء';

function isWeekTwoExtraSaturday_(dateObj) {
  void dateObj;
  return false;
}

function getUnifiedWeekDates_(courseStart, weekNumber) {
  const normalizedWeek = Number(weekNumber) || 1;
  const start = courseStart || parseDate(COURSE_START_DATE);
  if (!start) return [];

  // السنة الدراسية أسابيع مستقلة: كل أسبوع يبدأ الأحد وينتهي الأربعاء (4 أيام).
  // الأسبوع 1: الأحد 11/10/2026 إلى الأربعاء 14/10/2026.
  // الأسبوع 13 (الأخير): الأحد 03/01/2027 إلى الأربعاء 06/01/2027 (28/7/1448هـ).
  const weekStartOffset = (normalizedWeek - 1) * 7;
  const offsets = [0, 1, 2, 3].map(function (i) { return weekStartOffset + i; });
  return offsets
    .map(function(dayOffset) {
      return addDays(start, dayOffset);
    })
    .filter(function(dateObj) {
      return dateObj && !isCanceledSessionDate(dateObj);
    })
    .sort(function(a, b) { return a.getTime() - b.getTime(); });
}

function getUnifiedWeekTarget_(courseStart, weekNumber) {
  return getUnifiedWeekDates_(courseStart, weekNumber).reduce(function(sum, dateObj) {
    return sum + getDayTargetForDate(dateObj);
  }, 0);
}

const WEEKLY_PREFIX = 'تقرير أسبوعي — ';
const FINAL_PREFIX = 'التقرير الختامي — ';
const SCORE_OPTIONS = ['30', '25', '20', 'لم يسمع'];

// ─── بنود التسجيل الديناميكية ──────────────────────────────────────
// الإدارة تحدد البنود (الاسم + النقاط + النوع) وتتزامن على كل أجهزة المعلمين
// عبر Script Properties، فيظهر النموذج نفسه عند الجميع.
// النوع:
// - points : بند يُضغط فيُضاف نقاطه (مثل الحضور)
// - yesno  : بند نعم/لا (مثل إحضار الحقيبة)
// - range  : بند من سورة إلى سورة (مثل الحفظ والمراجعة)
const REG_ITEMS_KEY = 'REG_ITEMS_V1';
const REG_ITEMS_TYPES = ['points', 'yesno', 'range'];
const DEFAULT_REG_ITEMS = [
  { id: 'hudur',   label: 'الحضور',        type: 'points', points: 10 },
  { id: 'hifz',    label: 'الحفظ',         type: 'range',  points: 30 },
  { id: 'murajaa', label: 'المراجعة',      type: 'range',  points: 30 },
  { id: 'haqiba',  label: 'إحضار الحقيبة', type: 'yesno',  points: 10 },
  { id: 'istima',  label: 'الإستماع',      type: 'yesno',  points: 20 },
];

function normalizeRegItem_(item) {
  return {
    id: String(item && item.id || '').trim(),
    label: String(item && item.label || '').trim(),
    type: REG_ITEMS_TYPES.indexOf(String(item && item.type || '')) !== -1 ? String(item.type) : 'points',
    points: Number(item && item.points) || 0
  };
}

// يرجع البنود الحالية من Script Properties، أو الافتراضية إن لم تُضبط بعد.
function getRegItems_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(REG_ITEMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : (parsed && parsed.items);
      if (Array.isArray(items) && items.length) return items.map(normalizeRegItem_);
    }
  } catch (err) {
    Logger.log('getRegItems_ ERROR: ' + err.message);
  }
  return DEFAULT_REG_ITEMS.map(function(item) {
    return { id: item.id, label: item.label, type: item.type, points: Number(item.points) || 0 };
  });
}

// يحفظ البنود في Script Properties ليتزامن على كل أجهزة المعلمين.
// محمية بنفس كلمة مرور الإدارة (RESET_PASSWORD) حتى لا يغيّرها أي معلم عن غير قصد.
function saveRegItems_(items, password) {
  if (!isResetPasswordValid(password)) throw new Error('كلمة مرور غير صحيحة — البنود لم تُحفظ');
  if (!Array.isArray(items)) throw new Error('البنود يجب أن تكون مصفوفة');
  if (!items.length) throw new Error('أضف بنداً واحداً على الأقل');
  const clean = [];
  const seen = {};
  items.forEach(function(item, index) {
    const normalized = normalizeRegItem_(item);
    if (!normalized.label) throw new Error('بند رقم ' + (index + 1) + ': اكتب اسم البند');
    if (!normalized.id) normalized.id = 'item-' + (index + 1);
    if (seen[normalized.id]) throw new Error('يوجد بندان بنفس المعرف: ' + normalized.label);
    seen[normalized.id] = true;
    clean.push(normalized);
  });
  const updatedAt = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty(
    REG_ITEMS_KEY,
    JSON.stringify({ items: clean, updatedAt: updatedAt })
  );
  return { count: clean.length, updatedAt: updatedAt };
}

// يحسب صف البنود الديناميكية: المجموع في عمود «المجموع»،
// وتفاصيل البنود في عمود «الملاحظة» بصيغة JSON حتى لا تضيع القيم.
function buildDynamicLogRow(dateStr, studentName, data, teamId) {
  const items = Array.isArray(data.regItems) ? data.regItems.map(normalizeRegItem_) : getRegItems_();
  const values = (data && data.itemValues) || {};
  const breakdown = {};
  let total = 0;
  items.forEach(function(item) {
    const id = String(item.id || '');
    if (!id) return;
    const v = values[id];
    const points = Number(item.points) || 0;
    if (item.type === 'points' || item.type === 'yesno') {
      if (v === true || v === 'true' || v === 'نعم') {
        total += points;
        breakdown[id] = 'نعم';
      } else if (v === false || v === 'false' || v === 'لا') {
        breakdown[id] = 'لا';
      } else {
        breakdown[id] = '';
      }
    } else if (item.type === 'range') {
      if (v === 'absent' || v === 'لم يسمع' || v === 'لم يسمّع') {
        breakdown[id] = 'لم يسمع';
      } else if (v && typeof v === 'object') {
        const from = String(v.from || '').trim();
        const to = String(v.to || '').trim();
        if (from && to) {
          // المعلم يختار نقاط البند لكل طالب (30/25/20) — نستخدم اختياره إن وُجد،
          // وإلا نقاط البند الافتراضية من الإعدادات.
          const chosen = Number(v.score);
          total += Number.isFinite(chosen) && chosen > 0 ? chosen : points;
          breakdown[id] = from === to ? from : (from + ' → ' + to);
        } else {
          breakdown[id] = from ? ('من ' + from) : (to ? ('إلى ' + to) : '');
        }
      } else {
        breakdown[id] = '';
      }
    }
  });
  const note = JSON.stringify({ regItemsV1: breakdown });
  const teamName = String(data.teamName || data.team || '').trim() || TEAM_SHEETS[teamId] || '';
  return [dateStr, studentName, 'حاضر', '', '', '', '', '', '', '', '', total, note, teamName, isDynamicClassId_(teamId) ? teamId : ''];
}
const ATTENDANCE_OPTIONS = ['حاضر', 'غائب'];
const YES_NO_OPTIONS = ['نعم', 'لا'];

// 🔐 كلمة مرور الإدارة (التصفير وتعديل البنود) محفوظة في «خصائص السكربت» باسم RESET_PASSWORD،
// وليست مكتوبة هنا لأن الكود محفوظ في مستودع GitHub عام.
// لتغييرها: Project Settings ⚙️ ← Script Properties ← RESET_PASSWORD.
const RESET_PASSWORD = (function () {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('RESET_PASSWORD') || '').trim();
  } catch (e) {
    return '';
  }
})();

// مفاتيح داخل خصائص السكربت لتحديث التقارير بالخلفية بدون إبطاء صفحة الأدمن.
const REPORTS_DIRTY_KEY = 'REPORTS_DIRTY';
const REPORTS_LAST_DATE_KEY = 'REPORTS_LAST_DATE';
const REPORTS_LAST_TEAM_KEY = 'REPORTS_LAST_TEAM';
const REPORTS_DIRTY_TEAMS_KEY = 'REPORTS_DIRTY_TEAMS';

// يمنع إعادة بناء التقرير بالكامل أثناء تعديل المعلم من Google Sheets،
// خصوصاً على الجوال حيث إعادة كتابة الشيت تغلق قائمة الاختيار فوراً.
const REPORT_EDIT_ACTIVE_UNTIL_KEY = 'REPORT_EDIT_ACTIVE_UNTIL';
const REPORT_EDIT_GRACE_MS = 10 * 60 * 1000; // عشر دقائق بعد آخر تعديل يدوي

// حماية دقيقة للطالب/اليوم الذي عدّله المعلم يدوياً.
// تمنع عامل V7 أو طلب المتصفح المتأخر من إعادة قيمة قديمة فوق التعديل اليدوي.
const MANUAL_REPORT_EDIT_PREFIX = 'MANUAL_REPORT_EDIT_PROTECT_';
const MANUAL_REPORT_EDIT_PROTECT_MS = 5 * 60 * 1000; // حماية التعديل اليدوي من أي طلب متأخر لمدة خمس دقائق

// ══════════════════════════════════════════════════════════════
//  CORS / Preflight
// ══════════════════════════════════════════════════════════════
function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function getTodayInAppTimezone() {
  // يرجع تاريخ اليوم حسب توقيت السعودية حتى لو كان توقيت مشروع Apps Script مختلف.
  const stamp = Utilities.formatDate(new Date(), APP_TIMEZONE, 'yyyy/MM/dd HH:mm:ss');
  return new Date(stamp);
}

// ═══ بداية «اليوم الدراسي» الساعة 6:00 صباحاً بتوقيت السعودية ═══
// اليوم الدراسي يتغير يومياً الساعة 6 صباحاً وليس منتصف الليل.
// مثال: الحلقة ليلة الأحد بين المغرب والعشاء، والمعلم سجل الأحد 3:00 فجر الاثنين
// → يُحسب التسجيل حق يوم الأحد. وتريجر الغياب التلقائي يعمل الساعة 6 صباحاً:
// أي طالب لم يُسجل له حتى 6 صباحاً يُكتب له غياب يوم الأمس، وتبدأ بعدها جلسة اليوم الجديد.
const SCHOOL_DAY_START_HOUR = 6;

function getSchoolDayNow_() {
  // يعيد تاريخ «اليوم الدراسي» الحالي بناءً على ساعة بدايته (6:00 صباحاً).
  const now = getTodayInAppTimezone();
  const shifted = new Date(now.getTime() - SCHOOL_DAY_START_HOUR * 60 * 60 * 1000);
  return startOfDay(shifted);
}

function getSchoolDayDateStr_() {
  return formatDate(getSchoolDayNow_());
}

function getEndedSchoolDay_() {
  // آخر يوم دراسي «انتهى» فعلاً = اليوم الدراسي الحالي ناقص يوم.
  // تريجر الغياب يعمل الساعة 6:00–6:15 صباحاً، ووقتها يكون اليوم الدراسي الحالي قد بدأ للتو،
  // فالغياب يُكتب لليوم السابق. ولو شُغّل قبل 6 صباحاً أو في المساء، يُكتب ليوم أقدم انتهى
  // تماماً، فلا يُسجَّل غياب أبداً ليوم ما زالت حلقته جارية.
  return addDays(getSchoolDayNow_(), -1);
}

// يوحّد التاريخ المطلوب مع اليوم الدراسي (بدايته 6:00 صباحاً):
// أي طلب بتاريخ "اليوم التقويمي" ونحن قبل 6 صباحاً → يُحوّل لليوم الدراسي السابق (أمس).
// هذا يجعل التسجيل والعرض والحذف كلهم يتعاملون مع نفس اليوم حول منتصف الليل.
function mapRequestedDateToSchoolDay_(dateStr) {
  const schoolDayStr = getSchoolDayDateStr_();
  const calendarTodayStr = formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const requested = normalizeDate(dateStr || '');
  if (!requested) return schoolDayStr;
  if (requested === calendarTodayStr && schoolDayStr !== calendarTodayStr) return schoolDayStr;
  return requested;
}

function isSessionDayInAppTimezone(dateObj) {
  if (!dateObj || isCanceledSessionDate(dateObj)) return false;

  const start = parseDate(COURSE_START_DATE);
  const end = parseDate(COURSE_END_DATE);
  if (!start || !end) return false;

  const target = startOfDay(dateObj);
  const first = startOfDay(start);
  const last = startOfDay(end);

  return target >= first && target <= last;
}

function isCanceledSessionDate(dateObj) {
  if (!dateObj) return false;
  const dateStr = normalizeDate(formatDate(dateObj));
  return (CANCELED_SESSION_DATES || [])
    .map(d => normalizeDate(d))
    .filter(Boolean)
    .indexOf(dateStr) !== -1;
}

function getDayTargetForDate(dateObj) {
  return isCanceledSessionDate(dateObj) ? 0 : 100;
}

function isResetPasswordValid(value) {
  // بدون كلمة مرور محفوظة نرفض كل الطلبات، حتى لا تُقبل كلمة مرور فارغة.
  if (!RESET_PASSWORD) return false;
  return String(value || '').trim() === RESET_PASSWORD;
}

// ══════════════════════════════════════════════════════════════
//  POST — يستقبل التسجيل من AdminPage ويحفظه في قاعدة البيانات فقط
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (_) {
      data = e.parameter || {};
    }

    // طلب إداري: حفظ بنود التسجيل الجديدة (تتزامن على كل أجهزة المعلمين).
    if (data && data.action === 'saveRegItems') {
      const result = saveRegItems_(data.items || [], data.password || '');
      return jsonResponse({ status: 'ok', items: getRegItems_(), updatedAt: result.updatedAt });
    }

    // doPost يحافظ على السلوك القديم: لو الطالب موجود بنفس اليوم يتم دمج القيم غير المرسلة مع القديمة.
    const result = saveAdminEntry_(data, 'merge');
    return jsonResponse(result);
  } catch (err) {
    Logger.log('doPost ERROR: ' + err.message);
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// يحفظ تسجيل الأدمن ويرجع النقاط القديمة/الجديدة والفرق حتى لا تتكرر نقاط المسابقة.
// mode:
// - create  : للتسجيل الجديد فقط، ولو كان موجوداً يرجع duplicate بدون تعديل.
// - merge   : يدمج القيم الجديدة مع القديمة، مثل السلوك القديم.
// - replace : يستبدل تسجيل الطالب لذلك اليوم بالكامل بالبيانات الجديدة.
function saveAdminEntry_(data, mode) {
  mode = String(mode || 'merge').trim();

  // أي طالب يرسله AdminPage يُسجل حاضرًا تلقائيًا؛ الغياب يضاف فقط من تريجر نهاية اليوم.
  data = data || {};
  data.hudur = true;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  const studentName = String(data.studentName || '').trim();
  if (!studentName) throw new Error('studentName مطلوب');

  const teamId = normalizeTeamId(data.teamId || data.teamName || data.team || '');
  if (!teamId) throw new Error('teamId مطلوب أو غير صحيح');

  const dynamicClass = isDynamicClassId_(teamId) ? getDynamicClassMetaByAny_(teamId, ss) : null;
  if (isDynamicClassId_(teamId) && !dynamicClass) throw new Error('الفصل غير مسجل ضمن الفصول الـ19');
  const teamName = getCompetitionUnitName_(teamId, data.teamName || data.team || '', ss);
  data.teamId = teamId;
  data.teamName = teamName;

  const dateStr = mapRequestedDateToSchoolDay_(data.date);

  // لو أُرسل طالب غير موجود في ورقة الفصل/الحلقة، نضيفه تلقائياً لقائمة الأسماء.
  appendStudentToRosterIfMissing(ss, teamId, studentName);

  const existingRow = findLogRow(logSheet, dateStr, studentName, teamId);
  const oldTotal = existingRow > 0 ? Number(logSheet.getRange(existingRow, COL.TOTAL).getValue()) || 0 : 0;

  if (mode === 'create' && existingRow > 0) {
    return {
      status: 'duplicate',
      existed: true,
      date: dateStr,
      studentName: studentName,
      teamId: teamId,
      teamName: teamName,
      oldTotal: oldTotal,
      newTotal: oldTotal,
      total: oldTotal,
      delta: 0,
      message: 'الطالب مسجل مسبقاً اليوم'
    };
  }

  let rowValues;
  if (existingRow > 0) {
    rowValues = mode === 'replace'
      ? replaceLogRow(logSheet, existingRow, data, teamId)
      : upsertLogRow(logSheet, existingRow, data, teamId);
  } else {
    rowValues = insertLogRow(logSheet, dateStr, studentName, data, teamId);
  }

  // لا حاجة لـ flush أو إعادة قراءة الصف؛ buildLogRow يحسب المجموع مسبقاً.
  const newTotal = Number((rowValues || [])[COL.TOTAL - 1]) || 0;
  const delta = newTotal - oldTotal;

  // تقارير الفصول المدرسية الجديدة مؤجلة حالياً، لذلك لا ننشئ ولا نحدث أي شيت تقرير لها.
  // نظام التقارير القديم يبقى يعمل للحلقات القديمة فقط.
  let reportStatus = isDynamicClassId_(teamId) ? 'not-applicable' : 'queued';
  let reportMessage = isDynamicClassId_(teamId)
    ? 'تم حفظ بيانات الطالب في شيت البيانات'
    : 'تم حفظ البيانات بنجاح، وسيتم تحديث تقرير الحلقة بالخلفية';
  let reportSync = null;
  if (!isDynamicClassId_(teamId)) {
    try {
      markReportsDirty(dateStr, teamId);
    } catch (queueErr) {
      Logger.log('saveAdminEntry_ mark report dirty ERROR: ' + queueErr.message);
      reportStatus = 'not-queued';
      reportMessage = 'تم حفظ البيانات، لكن تعذر وضع تقرير الحلقة في طابور التحديث';
    }
  }

  return {
    status: existingRow > 0 ? (mode === 'replace' ? 'replaced' : 'updated') : 'created',
    existed: existingRow > 0,
    date: dateStr,
    studentName: studentName,
    teamId: teamId,
    teamName: teamName,
    oldTotal: oldTotal,
    newTotal: newTotal,
    total: newTotal,
    delta: delta,
    reportStatus: reportStatus,
    reportSync: reportSync,
    message: reportMessage
  };
}


/**
 * أسرع مسار ممكن لتسجيل الطالب أثناء المسابقة.
 * لا يعيد تنسيق ورقة البيانات، ولا يقرأ أوراق الأسماء، ولا يبني أي تقرير، ولا يعمل flush.
 * الهدف أن يرجع طلب AdminPage خلال ثوانٍ حتى لو كانت تقارير الحلقات كبيرة.
 */

/**
 * V4: الحفظ السريع نفسه، مع وضع تقرير الحلقة في طابور تلقائي.
 * لا يُبنى التقرير داخل طلب التسجيل. العامل الزمني ينتظر هدوء التسجيلات
 * ثم يبني حلقة واحدة في كل تشغيل حتى تبقى صفحة الأدمن سريعة.
 */
function fastEntryCacheKeyV3_(dateStr, studentName, teamId) {
  const cleanName = String(studentName || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return ['FASTV3', mapRequestedDateToSchoolDay_(dateStr), normalizeTeamId(teamId), cleanName].join('|');
}

/**
 * بحث سريع بقراءة دفعة واحدة من آخر الصفوف؛ غالباً كل سجلات البرنامج تقع ضمنها.
 * إذا كانت الورقة أكبر من الحد ولم نجد الطالب، نستخدم TextFinder على عمود الطالب فقط.
 */
function findLogEntryFastV3_(sheet, dateStr, studentName, teamId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { row: 0, total: 0, values: null };

  const targetDate = normalizeDate(dateStr);
  const targetName = String(studentName || '').trim();
  const targetTeam = normalizeTeamId(teamId || '');
  const startRow = Math.max(2, lastRow - FAST_SAVE_RECENT_ROWS_V3 + 1);
  const count = lastRow - startRow + 1;

  if (count > 0) {
    const values = sheet.getRange(startRow, 1, count, HEADERS.length).getDisplayValues();
    for (let i = values.length - 1; i >= 0; i--) {
      const row = values[i];
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      const rowName = String(row[COL.STUDENT - 1] || '').trim();
      const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      if (rowDate === targetDate && rowName === targetName && (!rowTeam || rowTeam === targetTeam)) {
        return {
          row: startRow + i,
          total: Number(row[COL.TOTAL - 1]) || 0,
          values: row
        };
      }
    }
  }

  if (startRow > 2) {
    try {
      const matches = sheet.getRange(2, COL.STUDENT, startRow - 2, 1)
        .createTextFinder(targetName)
        .matchEntireCell(true)
        .matchCase(false)
        .findAll();
      for (let i = matches.length - 1; i >= 0; i--) {
        const rowNumber = matches[i].getRow();
        const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getDisplayValues()[0];
        const rowDate = dateValueToString(row[COL.DATE - 1]);
        const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
        if (rowDate === targetDate && (!rowTeam || rowTeam === targetTeam)) {
          return { row: rowNumber, total: Number(row[COL.TOTAL - 1]) || 0, values: row };
        }
      }
    } catch (err) {
      Logger.log('findLogEntryFastV3_ old rows search skipped: ' + err.message);
    }
  }

  return { row: 0, total: 0, values: null };
}

function replaceLogRow(sheet, rowIdx, data, teamId) {
  const oldValues = sheet.getRange(rowIdx, 1, 1, HEADERS.length).getValues()[0];

  const oldDate = dateValueToString(oldValues[COL.DATE - 1]);
  const oldStudent = String(oldValues[COL.STUDENT - 1] || '').trim();

  const dateStr = normalizeDate(data.date || oldDate || formatDate(new Date()));
  const studentName = String(data.studentName || oldStudent || '').trim();
  const row = buildLogRow(dateStr, studentName, data, teamId);

  // مهم: نكتب التاريخ كنص حتى لا يقلبه Google Sheets حسب لغة الملف.
  sheet.getRange(rowIdx, COL.DATE).setNumberFormat('@');
  sheet.getRange(rowIdx, 1, 1, HEADERS.length).setValues([row]);
  formatLogDataRow(sheet, rowIdx);
  return row;
}

function parsePayloadParam_(rawPayload) {
  if (!rawPayload) return {};
  try {
    return JSON.parse(String(rawPayload));
  } catch (err) {
    throw new Error('payload غير صالح: ' + err.message);
  }
}

function getTodayEntryResult_(studentName, teamId, dateStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  studentName = String(studentName || '').trim();
  if (!studentName) throw new Error('studentName مطلوب');

  teamId = normalizeTeamId(teamId || '');
  if (!teamId) throw new Error('teamId مطلوب أو غير صحيح');

  dateStr = mapRequestedDateToSchoolDay_(dateStr);

  const rowIdx = findLogRow(logSheet, dateStr, studentName, teamId);
  if (rowIdx <= 0) {
    return {
      status: 'ok',
      exists: false,
      date: dateStr,
      studentName: studentName,
      teamId: teamId,
      teamName: getCompetitionUnitName_(teamId, ''),
      total: 0
    };
  }

  const row = logSheet.getRange(rowIdx, 1, 1, HEADERS.length).getValues()[0];
  const total = Number(row[COL.TOTAL - 1]) || 0;
  return {
    status: 'ok',
    exists: true,
    date: dateStr,
    studentName: studentName,
    teamId: teamId,
    teamName: getCompetitionUnitName_(teamId, ''),
    total: total,
    row: rowIdx
  };
}

function getTodayEntriesResult_(teamId, dateStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  teamId = normalizeTeamId(teamId || '');
  if (!teamId) throw new Error('teamId مطلوب أو غير صحيح');

  dateStr = mapRequestedDateToSchoolDay_(dateStr);

  const entries = [];
  const lastRow = logSheet.getLastRow();
  if (lastRow >= 2) {
    const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    data.forEach(function(row) {
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      const student = String(row[COL.STUDENT - 1] || '').trim();
      if (!student) return;
      if (rowDate === dateStr && (!rowTeam || rowTeam === teamId)) {
        entries.push({
          studentName: student,
          points: Number(row[COL.TOTAL - 1]) || 0,
          hudur: row[COL.HUDUR - 1] || '',
          hifzScore: row[COL.HIFZ_SCORE - 1] || '',
          muraScore: row[COL.MURA_SCORE - 1] || '',
          haqiba: row[COL.HAQIBA - 1] || '',
          istima: row[COL.ISTIMA - 1] || '',
          row: entries.length + 1
        });
      }
    });
  }

  return {
    status: 'ok',
    date: dateStr,
    teamId: teamId,
    teamName: getCompetitionUnitName_(teamId, ''),
    count: entries.length,
    entries: entries
  };
}

function getTodayEntriesAllResult_(dateStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  dateStr = mapRequestedDateToSchoolDay_(dateStr);

  const entriesByTeam = {};
  Object.keys(TEAM_SHEETS).forEach(teamId => entriesByTeam[teamId] = []);
  getDynamicClassLookup_(ss).list.forEach(function(meta) {
    entriesByTeam[meta.classId] = [];
  });

  const lastRow = logSheet.getLastRow();
  if (lastRow >= 2) {
    const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
    data.forEach(function(row) {
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      if (rowDate !== dateStr) return;

      const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      const student = String(row[COL.STUDENT - 1] || '').trim();
      if (!teamId || !student || !entriesByTeam[teamId]) return;

      entriesByTeam[teamId].push({
        studentName: student,
        points: Number(row[COL.TOTAL - 1]) || 0,
        total: Number(row[COL.TOTAL - 1]) || 0,
        hudur: row[COL.HUDUR - 1] || '',
        hifzScore: row[COL.HIFZ_SCORE - 1] || '',
        muraScore: row[COL.MURA_SCORE - 1] || '',
        haqiba: row[COL.HAQIBA - 1] || '',
        istima: row[COL.ISTIMA - 1] || '',
      });
    });
  }

  return {
    status: 'ok',
    date: dateStr,
    entriesByTeam: entriesByTeam,
    countsByTeam: Object.keys(entriesByTeam).reduce(function(acc, teamId) {
      acc[teamId] = entriesByTeam[teamId].length;
      return acc;
    }, {})
  };
}

function findLogRow(sheet, dateStr, studentName, teamId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const targetDate = normalizeDate(dateStr);
  const targetStudent = String(studentName || '').trim();
  const targetTeam = normalizeTeamId(teamId || '');
  if (!targetDate || !targetStudent) return 0;

  // أسرع من قراءة كل ورقة البيانات: نبحث أولاً في عمود الطالب فقط،
  // ثم نفحص التاريخ والحلقة للصفوف المطابقة فقط. هذا يمنع انتهاء مهلة AdminPage.
  try {
    const studentRange = sheet.getRange(2, COL.STUDENT, lastRow - 1, 1);
    const matches = studentRange
      .createTextFinder(targetStudent)
      .matchEntireCell(true)
      .matchCase(false)
      .findAll();

    for (let i = matches.length - 1; i >= 0; i--) {
      const rowIndex = matches[i].getRow();
      const rowValues = sheet.getRange(rowIndex, 1, 1, COL.CLASS_ID).getDisplayValues()[0];
      const rowDate = dateValueToString(rowValues[COL.DATE - 1]);
      const rowTeam = normalizeTeamId(rowValues[COL.CLASS_ID - 1] || rowValues[COL.TEAM - 1] || '');

      // توافق مع البيانات القديمة: لو خانة الحلقة فاضية نسمح بالتحديث بنفس التاريخ والطالب.
      if (rowDate === targetDate && (!rowTeam || rowTeam === targetTeam)) {
        return rowIndex;
      }
    }
    return 0;
  } catch (err) {
    Logger.log('findLogRow fast search failed, fallback scan: ' + err.message);
  }

  // احتياط قديم في حال تعذر TextFinder لأي سبب.
  const data = sheet.getRange(2, 1, lastRow - 1, COL.CLASS_ID).getDisplayValues();
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const rowDate = dateValueToString(row[COL.DATE - 1]);
    const rowStudent = String(row[COL.STUDENT - 1] || '').trim();
    const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    if (rowDate === targetDate && rowStudent === targetStudent && (!rowTeam || rowTeam === targetTeam)) {
      return i + 2;
    }
  }
  return 0;
}

function insertLogRow(sheet, dateStr, studentName, data, teamId) {
  // إذا كان المعلم عدّل نفس الطالب/اليوم يدوياً قبل وصول طلب حفظ متأخر من AdminPage،
  // نثبت الحقول المعدلة يدوياً ولا نسمح للقيمة القديمة بإعادتها.
  data = applyManualReportOverrides_(data, dateStr, teamId, studentName);
  const row = buildLogRow(dateStr, studentName, data, teamId);
  const nextRow = Math.max(sheet.getLastRow() + 1, 2);
  // مهم: نكتب التاريخ كنص حتى لا يقلبه Google Sheets حسب لغة الملف.
  sheet.getRange(nextRow, COL.DATE).setNumberFormat('@');
  sheet.getRange(nextRow, 1, 1, HEADERS.length).setValues([row]);
  formatLogDataRow(sheet, nextRow);
  return row;
}

function upsertLogRow(sheet, rowIdx, data, teamId) {
  const oldValues = sheet.getRange(rowIdx, 1, 1, HEADERS.length).getValues()[0];

  const oldDate = dateValueToString(oldValues[COL.DATE - 1]);
  const oldStudent = String(oldValues[COL.STUDENT - 1] || '').trim();

  const dateStr = normalizeDate(data.date || oldDate || formatDate(new Date()));
  const studentName = String(data.studentName || oldStudent || '').trim();

  // مهم:
  // إذا كان للطالب سجل سابق في نفس اليوم، لا نعيد كتابة الصف بالبيانات الجديدة فقط؛
  // بل ندمج القيم الجديدة مع القيم القديمة.
  // مثال: تم تسجيل الحفظ أولاً، ثم لاحقاً تم تسجيل المراجعة فقط.
  // القيم غير المرسلة من AdminPage تكون null، لذلك نحافظ على القديم بدل مسحه.
  const oldData = logRowToPayload(oldValues, dateStr, studentName, teamId);
  let mergedData = mergeLogPayload(oldData, data, dateStr, studentName, teamId);

  // حماية الحقول التي غيّرها المعلم من داخل تقرير الحلقة. هذا مهم خصوصاً للحقيبة
  // والإستماع؛ فقد يصل طلب قديم من المتصفح بعد التعديل ويحمل القيمة السابقة "لا".
  mergedData = applyManualReportOverrides_(mergedData, dateStr, teamId, studentName);

  const row = buildLogRow(dateStr, studentName, mergedData, teamId);

  // مهم: نكتب التاريخ كنص حتى لا يقلبه Google Sheets حسب لغة الملف.
  sheet.getRange(rowIdx, COL.DATE).setNumberFormat('@');
  sheet.getRange(rowIdx, 1, 1, HEADERS.length).setValues([row]);
  formatLogDataRow(sheet, rowIdx);
  return row;
}

function logRowToPayload(rowValues, dateStr, studentName, teamId) {
  const result = {
    studentName: studentName,
    teamId: teamId,
    teamName: rowValues[COL.TEAM - 1] || TEAM_SHEETS[teamId] || '',
    classId: rowValues[COL.CLASS_ID - 1] || (isDynamicClassId_(teamId) ? teamId : ''),
    date: dateStr,

    hudur: rowValues[COL.HUDUR - 1],
    hifzFrom: rowValues[COL.HIFZ_FROM - 1],
    hifzTo: rowValues[COL.HIFZ_TO - 1],
    hifzScore: rowValues[COL.HIFZ_SCORE - 1],

    muraFrom: rowValues[COL.MURA_FROM - 1],
    muraTo: rowValues[COL.MURA_TO - 1],
    muraScore: rowValues[COL.MURA_SCORE - 1],

    haqiba: rowValues[COL.HAQIBA - 1],
    istima: rowValues[COL.ISTIMA - 1],
    notes: rowValues[COL.NOTE - 1],
  };

  // البنود الديناميكية: تفاصيل القيم محفوظة في عمود «الملاحظة» بصيغة JSON.
  // نعيدها مع البيانات حتى لا تفقد القيم القديمة عند دمج تسجيلين لنفس الطالب.
  const noteText = String(rowValues[COL.NOTE - 1] || '').trim();
  if (noteText.charAt(0) === '{') {
    try {
      const parsed = JSON.parse(noteText);
      if (parsed && parsed.regItemsV1 && typeof parsed.regItemsV1 === 'object') {
        result.itemValues = parsed.regItemsV1;
      }
    } catch (_) {}
  }
  return result;
}

function isProvidedLogValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function keepOldUnlessProvided(oldValue, newValue) {
  return isProvidedLogValue(newValue) ? newValue : oldValue;
}

function mergeLogPayload(oldData, newData, dateStr, studentName, teamId) {
  const merged = {
    studentName: studentName,
    teamId: teamId,
    teamName: TEAM_SHEETS[teamId] || String(newData.teamName || oldData.teamName || '').trim(),
    date: dateStr,

    hudur: keepOldUnlessProvided(
      oldData.hudur,
      newData.hudur
    ),

    hifzFrom: keepOldUnlessProvided(
      oldData.hifzFrom,
      firstDefined(newData.hifzFrom, newData.hifz && newData.hifz.from, newData.hifzSurah ? String(newData.hifzSurah) : null)
    ),
    hifzTo: keepOldUnlessProvided(
      oldData.hifzTo,
      firstDefined(newData.hifzTo, newData.hifz && newData.hifz.to)
    ),
    hifzScore: keepOldUnlessProvided(
      oldData.hifzScore,
      firstDefined(newData.hifzScore, newData.hafiz, newData.hifz && newData.hifz.score)
    ),

    muraFrom: keepOldUnlessProvided(
      oldData.muraFrom,
      firstDefined(newData.muraFrom, newData.murajaa && newData.murajaa.from, newData.muraSurah ? String(newData.muraSurah) : null)
    ),
    muraTo: keepOldUnlessProvided(
      oldData.muraTo,
      firstDefined(newData.muraTo, newData.murajaa && newData.murajaa.to)
    ),
    muraScore: keepOldUnlessProvided(
      oldData.muraScore,
      firstDefined(newData.muraScore, newData.muraja, newData.murajaa && newData.murajaa.score)
    ),

    haqiba: keepOldUnlessProvided(oldData.haqiba, newData.haqiba),
    istima: keepOldUnlessProvided(oldData.istima, newData.istima),
    notes: keepOldUnlessProvided(oldData.notes, firstDefined(newData.notes, newData.note)),
  };

  // البنود الديناميكية: ندمج قيم البنود الجديدة مع القديمة (القديمة تُقرأ من ملاحظة الصف)،
  // بحيث لا تفقد قيمة بند قديم لم يُرسل من الواجهة في التسجيل الثاني لنفس الطالب.
  if (newData.itemValues && typeof newData.itemValues === 'object') {
    const oldValues = (oldData.itemValues && typeof oldData.itemValues === 'object') ? oldData.itemValues : {};
    const mergedValues = {};
    Object.keys(oldValues).forEach(function(k) { mergedValues[k] = oldValues[k]; });
    Object.keys(newData.itemValues).forEach(function(k) { mergedValues[k] = newData.itemValues[k]; });
    merged.itemValues = mergedValues;
  } else if (oldData.itemValues && typeof oldData.itemValues === 'object') {
    merged.itemValues = oldData.itemValues;
  }
  if (newData.regItems) merged.regItems = newData.regItems;

  // لا نستخدم totalPoints القادم من AdminPage عند التحديث؛ لأنه يمثل نقاط التسجيل الحالي فقط.
  // نترك buildLogRow يعيد حساب المجموع من القيم المدموجة.
  return merged;
}

function buildLogRow(dateStr, studentName, data, teamId) {
  // البنود الديناميكية: الإدارة تحدد البنود ونقاطها، والقيم تأتي من الواجهة مع تعريفها.
  if (data && data.regItems && data.itemValues) {
    return buildDynamicLogRow(dateStr, studentName, data, teamId);
  }
  const hifzScore = normalizeScore(firstDefined(data.hifzScore, data.hafiz, data.hifz && data.hifz.score));
  const muraScore = normalizeScore(firstDefined(data.muraScore, data.muraja, data.murajaa && data.murajaa.score));

  const hifzFrom = firstText(data.hifzFrom, data.hifz && data.hifz.from, data.hifzSurah ? String(data.hifzSurah) : '');
  const hifzTo   = firstText(data.hifzTo, data.hifz && data.hifz.to);
  const muraFrom = firstText(data.muraFrom, data.murajaa && data.murajaa.from, data.muraSurah ? String(data.muraSurah) : '');
  const muraTo   = firstText(data.muraTo, data.murajaa && data.murajaa.to);

  const hudur  = normalizeAttendance(data.hudur);
  const haqiba = normalizeYesNo(data.haqiba);
  const istima = normalizeYesNo(data.istima);
  const total  = totalFromPayload(data, hifzScore, muraScore, hudur, haqiba, istima);
  const note   = String(firstDefined(data.notes, data.note, '') || '');
  const teamName = TEAM_SHEETS[teamId] || String(data.teamName || '').trim();
  const classIdentity = isDynamicClassId_(teamId) ? teamId : '';

  return [dateStr, studentName, hudur, hifzFrom, hifzTo, hifzScore, muraFrom, muraTo, muraScore, haqiba, istima, total, note, teamName, classIdentity];
}

function totalFromPayload(data, hifzScore, muraScore, hudur, haqiba, istima) {
  if (data.totalPoints != null && data.totalPoints !== '') {
    const n = Number(data.totalPoints);
    return Number.isFinite(n) ? n : 0;
  }
  let total = 0;
  total += scoreToNumber(hifzScore);
  total += scoreToNumber(muraScore);
  total += istima === 'نعم' ? 20 : 0;
  total += haqiba === 'نعم' ? 10 : 0;
  total += hudur  === 'حاضر' ? 10 : 0;
  return total;
}

function scoreToNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeScore(value) {
  if (value == null || value === '') return '';
  const s = String(value).trim();
  if (!s) return '';
  if (s === 'absent' || s === 'لم يسمع' || s === 'لم يسمّع') return 'لم يسمع';
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function normalizeAttendance(value) {
  if (value == null || value === '') return '';
  if (value === true)  return 'حاضر';
  if (value === false) return 'غائب';
  const s = String(value).trim();
  if (s === 'حاضر' || s === 'غائب') return s;
  const n = Number(s);
  if (Number.isFinite(n)) return n > 0 ? 'حاضر' : 'غائب';
  return s;
}

function normalizeYesNo(value) {
  if (value == null || value === '') return '';
  if (value === true)  return 'نعم';
  if (value === false) return 'لا';
  const s = String(value).trim();
  if (s === 'true')  return 'نعم';
  if (s === 'false') return 'لا';
  if (s === 'نعم' || s === 'لا') return s;
  const n = Number(s);
  if (Number.isFinite(n)) return n > 0 ? 'نعم' : 'لا';
  return s;
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i];
  }
  return null;
}

function firstText() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] !== undefined && arguments[i] !== null && String(arguments[i]).trim() !== '') {
      return String(arguments[i]).trim();
    }
  }
  return '';
}


function normalizeArabicSheetName(value) {
  return String(value || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

function normalizeHeaderText_(value) {
  return String(value || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '')
    .toLowerCase();
}

function normalizeArabicName(value) {
  return normalizeHeaderText_(value);
}


function findSheetByAliases(ss, canonicalName) {
  const wanted = normalizeArabicSheetName(canonicalName);
  const aliasNames = [];

  for (const teamId in TEAM_SHEETS) {
    const canonical = TEAM_SHEETS[teamId];
    const aliases = TEAM_SHEET_ALIASES[teamId] || [];
    if (canonical === canonicalName || normalizeArabicSheetName(canonical) === wanted || aliases.indexOf(canonicalName) !== -1) {
      aliasNames.push(canonical);
      aliases.forEach(a => aliasNames.push(a));
    }
  }

  aliasNames.push(canonicalName);
  const normalizedAliases = aliasNames.map(normalizeArabicSheetName);
  const sheets = ss.getSheets();
  const candidates = [];

  for (let i = 0; i < sheets.length; i++) {
    const sheetName = sheets[i].getName();
    const normalizedSheetName = normalizeArabicSheetName(sheetName);
    if (normalizedAliases.indexOf(normalizedSheetName) !== -1 || normalizedSheetName === wanted) {
      candidates.push(sheets[i]);
    }
  }

  if (!candidates.length) return null;

  // لو صار عندك نسختين بسبب الهمزة: "حلقة أولى" فاضية و"حلقة اولى" فيها أسماء،
  // نختار الورقة التي فيها أسماء بدل الورقة الفاضية.
  let bestSheet = candidates[0];
  let bestCount = -1;
  for (let i = 0; i < candidates.length; i++) {
    const count = readNamesFromRosterSheetRobust_(candidates[i]).length;
    if (count > bestCount) {
      bestCount = count;
      bestSheet = candidates[i];
    }
  }

  return bestSheet;
}

// ══════════════════════════════════════════════════════════════
//  أوراق الحلقات = أسماء الطلاب + مسار طلاب حلقة أولى
// ══════════════════════════════════════════════════════════════
function setupRosterSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    const sheetName = TEAM_SHEETS[teamId];
    const existingSheet = findSheetByAliases(ss, sheetName) || ss.getSheetByName(sheetName);

    if (!existingSheet) {
      getOrCreateRosterSheet(ss, sheetName);
      return;
    }

    const names = readNamesFromRosterSheetRobust_(existingSheet);
    if (names.length) rewriteRosterSheet(existingSheet, names);
    else formatRosterHeader(existingSheet);
  });
}

// شغّل هذه الدالة مرة واحدة بعد تركيب هذا الإصدار.
// تضيف عمود المسار إلى حلقة أولى وتحافظ على الأسماء وعمود الحذف الحالي.
function setupFirstCircleTrackColumn() {
  return REMOVE_FIRST_CIRCLE_TRACK_AND_APPLY_SCHOOL_SCHEDULE();
}

// شغّلها يدويًا مرة واحدة بعد تركيب هذا الإصدار إذا كانت المسارات مختارة مسبقًا.
// تقرأ المسارات الحالية، تعيد بناء تقرير حلقة أولى، وتطبق ألوان المسارات.
function refreshFirstCircleTracksAndReport() {
  generateUnifiedReportForTeamOnly('blue', '');
  SpreadsheetApp.flush();
  return {
    status: 'ok',
    message: 'حلقة أولى أصبحت بنفس تنسيق بقية الحلقات بدون مسارات.'
  };
}

function getAllTeamStudents(ss) {
  const out = {};
  Object.keys(TEAM_SHEETS).forEach(teamId => {
    const sheetName = TEAM_SHEETS[teamId];
    const sheet = findSheetByAliases(ss, sheetName) || ss.getSheetByName(sheetName);

    // قراءة آمنة بدون إنشاء أو إعادة تنسيق في كل مرة حتى لا تختفي أسماء الطلاب.
    if (sheet) {
      let names = readNamesFromRosterSheetRobust_(sheet);
      if (!names.length) names = readNamesFromBestMatchingRosterSheet_(ss, teamId);
      out[teamId] = names;
    } else {
      out[teamId] = [];
    }
  });
  return out;
}

function normalizeFirstCircleTrack_(value) {
  const key = normalizeHeaderText_(value);
  if (!key) return { track: '', trackLabel: '' };

  if (key === 'nurania' || key.indexOf(normalizeHeaderText_('نورانية')) !== -1) {
    return { track: 'nurania', trackLabel: 'القاعدة النورانية' };
  }
  if (key === 'tilawa' || key.indexOf(normalizeHeaderText_('تلاوة')) !== -1) {
    return { track: 'tilawa', trackLabel: 'التلاوة' };
  }
  if (
    key === 'hifzreview' ||
    key.indexOf(normalizeHeaderText_('حفظ')) !== -1 ||
    key.indexOf(normalizeHeaderText_('مراجعة')) !== -1
  ) {
    return { track: 'hifz-review', trackLabel: 'الحفظ والمراجعة' };
  }

  return { track: '', trackLabel: '' };
}

function readFirstCircleProfilesFromRosterSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = Math.max(1, Math.min(sheet.getLastColumn(), 12));
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const rowsToScan = Math.min(values.length, 10);
  let headerRow = 0;
  let nameCol = 0;
  let trackCol = -1;
  let nameHeaderFound = false;

  for (let r = 0; r < rowsToScan; r++) {
    for (let c = 0; c < lastCol; c++) {
      const header = normalizeHeaderText_(values[r][c]);
      if (
        !nameHeaderFound &&
        (
          header === normalizeHeaderText_('اسم الطالب') ||
          header === normalizeHeaderText_('الطالب') ||
          header === normalizeHeaderText_('الاسم') ||
          header === 'studentname'
        )
      ) {
        headerRow = r;
        nameCol = c;
        nameHeaderFound = true;
      }

      if (
        header === normalizeHeaderText_('المسار') ||
        header === normalizeHeaderText_('مسار الطالب') ||
        header === 'track'
      ) {
        trackCol = c;
      }
    }
  }

  // دعم النسخة التجريبية القديمة: كان عنوان B مكتوباً "إجراء"، لكن القيم نفسها مسارات.
  if (trackCol < 0 && lastCol >= 2) {
    const hasTrackValuesInSecondColumn = values.slice(headerRow + 1).some(function(row) {
      return !!normalizeFirstCircleTrack_(row[1]).track;
    });
    if (hasTrackValuesInSecondColumn) trackCol = 1;
  }

  const byName = {};
  const order = [];
  const startRow = nameHeaderFound ? headerRow + 1 : 1;

  for (let r = startRow; r < values.length; r++) {
    const name = String(values[r][nameCol] || '').trim();
    if (!isStudentNameCellSafe_(name)) continue;

    const trackMeta = trackCol >= 0
      ? normalizeFirstCircleTrack_(values[r][trackCol])
      : { track: '', trackLabel: '' };

    if (!byName[name]) {
      byName[name] = {
        name: name,
        track: trackMeta.track,
        trackLabel: trackMeta.trackLabel
      };
      order.push(name);
    } else if (!byName[name].track && trackMeta.track) {
      byName[name].track = trackMeta.track;
      byName[name].trackLabel = trackMeta.trackLabel;
    }
  }

  return order.map(function(name) { return byName[name]; });
}

// ══════════════════════════════════════════════════════════════
//  الفصول الديناميكية — Google Sheets هو مصدر أسماء الفصول والطلاب
// ══════════════════════════════════════════════════════════════
function isDynamicClassSheetName_(sheetName) {
  const name = String(sheetName || '').trim();
  return name === CLASS_SHEET_PREFIX || name.indexOf(CLASS_SHEET_PREFIX + ' ') === 0;
}

function loadDynamicClassSheetIds_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(CLASS_SHEET_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(function(value) { return Number(value); })
      .filter(function(value) { return Number.isFinite(value) && value > 0; });
  } catch (err) {
    Logger.log('loadDynamicClassSheetIds_ ERROR: ' + err.message);
    return [];
  }
}

function saveDynamicClassSheetIds_(sheetIds) {
  try {
    const clean = Array.from(new Set((sheetIds || [])
      .map(function(value) { return Number(value); })
      .filter(function(value) { return Number.isFinite(value) && value > 0; })));
    PropertiesService.getScriptProperties().setProperty(
      CLASS_SHEET_REGISTRY_KEY,
      JSON.stringify(clean)
    );
  } catch (err) {
    Logger.log('saveDynamicClassSheetIds_ ERROR: ' + err.message);
  }
}

function formatDynamicClassRosterSheet_(sheet) {
  if (!sheet) return;

  // نفس تنسيق أوراق الحلقات القديمة (مثل "حلقة ثالث") حرفياً:
  // اتجاه عربي، رأس كحلي بخط أبيض، تثبيت الصف الأول، عرض عمود الاسم وارتفاع الرأس.
  sheet.setRightToLeft(true);
  formatRosterHeader(sheet);
}

function loadDynamicClassSlots_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(CLASS_SLOT_REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(function(item) {
        return {
          slot: Number(item && item.slot),
          sheetId: Number(item && item.sheetId)
        };
      })
      .filter(function(item) {
        return Number.isFinite(item.slot) && item.slot > 0 &&
               Number.isFinite(item.sheetId) && item.sheetId > 0;
      })
      .sort(function(a, b) { return a.slot - b.slot; });
  } catch (err) {
    Logger.log('loadDynamicClassSlots_ ERROR: ' + err.message);
    return [];
  }
}

function saveDynamicClassSlots_(items) {
  const clean = (items || [])
    .map(function(item) {
      return {
        slot: Number(item && item.slot),
        sheetId: Number(item && item.sheetId)
      };
    })
    .filter(function(item) {
      return Number.isFinite(item.slot) && item.slot > 0 &&
             Number.isFinite(item.sheetId) && item.sheetId > 0;
    })
    .sort(function(a, b) { return a.slot - b.slot; });

  PropertiesService.getScriptProperties().setProperty(
    CLASS_SLOT_REGISTRY_KEY,
    JSON.stringify(clean)
  );
  // نحافظ أيضاً على السجل القديم للتوافق مع النسخ السابقة من getClasses.
  saveDynamicClassSheetIds_(clean.map(function(item) { return item.sheetId; }));
  return clean;
}

function getDisplayVersionForClassSlot_(slot) {
  const n = Number(slot) || 0;
  if (n >= 1 && n <= 8) return 1;
  if (n >= 9 && n <= 14) return 2;
  if (n >= 15 && n <= 19) return 3;
  return 0;
}

function parseInitialClassSlotFromName_(sheetName) {
  const name = String(sheetName || '').trim();
  const match = name.match(/^فصل\s*([0-9٠-٩]+)$/);
  if (!match) return 0;
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const normalized = match[1].replace(/[٠-٩]/g, function(ch) {
    return String(arabicDigits.indexOf(ch));
  });
  const slot = Number(normalized);
  return Number.isFinite(slot) ? slot : 0;
}

/**
 * شغّل هذه الدالة مرة واحدة بعد إنشاء شيتات فصل 1 إلى فصل 19.
 * تثبّت كل مكان فصل على sheetId الخاص به. بعد ذلك تغيير اسم الشيت لا يغيّر
 * مكان الفصل ولا نسخة العرض الخاصة به.
 */
function REGISTER_19_CLASS_SLOTS() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const assignments = [];
  const missing = [];
  const usedIds = {};

  for (let slot = 1; slot <= SCHOOL_CLASS_COUNT; slot++) {
    const expectedName = CLASS_SHEET_PREFIX + ' ' + slot;
    const sheet = ss.getSheetByName(expectedName);
    if (!sheet) {
      missing.push(expectedName);
      continue;
    }

    const sheetId = Number(sheet.getSheetId());
    if (!sheetId || usedIds[String(sheetId)]) {
      throw new Error('تعذر تثبيت ' + expectedName + ': sheetId غير صالح أو مكرر');
    }
    usedIds[String(sheetId)] = true;

    formatDynamicClassRosterSheet_(sheet);
    assignments.push({ slot: slot, sheetId: sheetId });
  }

  if (missing.length) {
    throw new Error('لم يتم التثبيت. الشيتات التالية غير موجودة: ' + missing.join('، '));
  }

  saveDynamicClassSlots_(assignments);

  return {
    status: 'ok',
    count: assignments.length,
    assignments: assignments.map(function(item) {
      const sheet = ss.getSheets().filter(function(s) {
        return Number(s.getSheetId()) === item.sheetId;
      })[0];
      return {
        slot: item.slot,
        version: getDisplayVersionForClassSlot_(item.slot),
        sheetId: item.sheetId,
        classId: 'class-' + item.sheetId,
        currentName: sheet ? sheet.getName() : ''
      };
    }),
    message: 'تم تثبيت الفصول 1 إلى 19 على sheetId. يمكن الآن تغيير أسماء الشيتات بدون تغيير توزيع النسخ.'
  };
}

function getDynamicClasses_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);

  let slotRegistry = loadDynamicClassSlots_();

  // قبل تشغيل REGISTER_19_CLASS_SLOTS، نحاول قراءة الفصول الرقمية الموجودة
  // بترتيب رقم الفصل. لا نحفظ هذا كتثبيت نهائي إلا إذا كانت 1..19 كاملة.
  if (!slotRegistry.length) {
    const provisional = [];
    ss.getSheets().forEach(function(sheet) {
      const slot = parseInitialClassSlotFromName_(sheet.getName());
      if (slot >= 1 && slot <= SCHOOL_CLASS_COUNT) {
        provisional.push({ slot: slot, sheetId: Number(sheet.getSheetId()) });
      }
    });
    provisional.sort(function(a, b) { return a.slot - b.slot; });

    const uniqueSlots = {};
    slotRegistry = provisional.filter(function(item) {
      if (uniqueSlots[String(item.slot)]) return false;
      uniqueSlots[String(item.slot)] = true;
      return true;
    });
  }

  const sheetById = {};
  ss.getSheets().forEach(function(sheet) {
    sheetById[String(Number(sheet.getSheetId()))] = sheet;
  });

  const classes = [];
  slotRegistry
    .slice()
    .sort(function(a, b) { return a.slot - b.slot; })
    .forEach(function(item) {
      const sheet = sheetById[String(item.sheetId)];
      if (!sheet) return; // إذا حُذف شيت الفصل يختفي من الواجهة حتى يتم إصلاحه.

      const sheetName = String(sheet.getName() || '').trim();
      const classId = 'class-' + item.sheetId;
      const version = getDisplayVersionForClassSlot_(item.slot);

      // لا نعيد تنسيق ورقة الفصل في كل طلب getClasses.
      // كان التنسيق الكامل (19 ورقة × عدة استدعاءات) هو سبب بطء تحميل الفصول
      // وانتهاء مهلة AdminPage. ننسق مرة واحدة فقط إذا كانت الورقة بدون رأس.
      try {
        const headerCell = String(sheet.getRange(1, 1).getDisplayValue() || '').trim();
        if (headerCell !== ROSTER_HEADERS[0]) formatDynamicClassRosterSheet_(sheet);
      } catch (_) {}

      const students = readNamesFromRosterSheetRobust_(sheet);

      classes.push({
        id: classId,
        classId: classId,
        name: sheetName,
        className: sheetName,
        sheetId: item.sheetId,
        slot: item.slot,
        version: version,
        displayVersion: version,
        students: students
      });
    });

  // احتياط للملفات القديمة: لا توجد أوراق «فصل»، فنعرض الحلقات الأربع
  // باسمائها الحقيقية (حلقة أولى..رابع) لتظهر في موقع التسجيل وموقع العرض.
  if (classes.length === 0) {
    buildLegacyTeamClasses_(ss).forEach(function(meta) {
      classes.push({
        id: meta.classId,
        classId: meta.classId,
        name: meta.className,
        className: meta.className,
        sheetId: meta.sheetId,
        slot: meta.slot,
        version: meta.version,
        displayVersion: meta.version,
        students: readNamesFromRosterSheetRobust_(meta.sheet)
      });
    });
  }

  return classes;
}

// ══════════════════════════════════════════════════════════════
//  الحلقات القديمة كوحدات تسجيل (ترتيب الملف الأصلي)
//  الملف الأصلي كان 4 حلقات (حلقة أولى..رابع) بدون أوراق «فصل».
//  عند غياب أوراق الفصول نعرض الحلقات نفسها كفصول حتى يعمل موقع
//  التسجيل وموقع العرض كما كانا، مع ربط داخلي بمعرّف الحلقة القديم
//  (blue/red/green/purple) حتى تبقى تقارير الحلقات ومسار الحفظ كما هي.
// ══════════════════════════════════════════════════════════════
const LEGACY_TEAM_ORDER = ['blue', 'red', 'green', 'purple'];

function buildLegacyTeamClasses_(ss) {
  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);

  const out = [];
  LEGACY_TEAM_ORDER.forEach(function(teamId, index) {
    const canonical = TEAM_SHEETS[teamId];
    const sheet = findSheetByAliases(ss, canonical) || ss.getSheetByName(canonical);
    if (!sheet) return;

    const sheetId = Number(sheet.getSheetId());
    const slot = index + 1;

    out.push({
      classId: 'class-' + sheetId,
      sheetId: sheetId,
      slot: slot,
      version: getDisplayVersionForClassSlot_(slot),
      className: String(sheet.getName() || '').trim(),
      // المعرّف القديم يُستخدم داخلياً فقط (تقارير وكيل الحفظ) ولا يظهر في الواجهة.
      legacyTeamId: teamId,
      sheet: sheet
    });
  });

  return out;
}

var DYNAMIC_CLASS_LOOKUP_CACHE_ = null;

function isDynamicClassId_(value) {
  return /^class-\d+$/.test(String(value || '').trim());
}

function getDynamicClassLookup_(ss) {
  if (DYNAMIC_CLASS_LOOKUP_CACHE_) return DYNAMIC_CLASS_LOOKUP_CACHE_;

  ss = ss || SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetById = {};
  ss.getSheets().forEach(function(sheet) {
    sheetById[String(Number(sheet.getSheetId()))] = sheet;
  });

  const byId = {};
  const byName = {};
  const list = [];
  loadDynamicClassSlots_().forEach(function(item) {
    const sheet = sheetById[String(item.sheetId)];
    if (!sheet) return;

    const classId = 'class-' + item.sheetId;
    const className = String(sheet.getName() || '').trim();
    const meta = {
      classId: classId,
      sheetId: item.sheetId,
      slot: item.slot,
      version: getDisplayVersionForClassSlot_(item.slot),
      className: className,
      sheet: sheet
    };

    byId[classId] = meta;
    byName[normalizeArabicSheetName(className)] = meta;
    list.push(meta);
  });

  // الملفات القديمة (4 حلقات) ليس فيها أوراق «فصل»؛ نضيف الحلقات كوحدات تسجيل
  // حتى يعمل الحفظ والتقارير بنفس طريقة النظام القديم تماماً.
  if (list.length === 0) {
    buildLegacyTeamClasses_(ss).forEach(function(meta) {
      byId[meta.classId] = meta;
      byName[normalizeArabicSheetName(meta.className)] = meta;
      list.push(meta);
    });
  }

  list.sort(function(a, b) { return a.slot - b.slot; });
  DYNAMIC_CLASS_LOOKUP_CACHE_ = { byId: byId, byName: byName, list: list };
  return DYNAMIC_CLASS_LOOKUP_CACHE_;
}

function getDynamicClassMetaByAny_(value, ss) {
  const text = String(value || '').trim();
  if (!text) return null;
  const lookup = getDynamicClassLookup_(ss);
  if (lookup.byId[text]) return lookup.byId[text];
  return lookup.byName[normalizeArabicSheetName(text)] || null;
}

function getDynamicClassSheetById_(ss, classId) {
  const meta = getDynamicClassMetaByAny_(classId, ss);
  return meta ? meta.sheet : null;
}

function getCompetitionUnitName_(teamId, fallbackName, ss) {
  if (TEAM_SHEETS[teamId]) return TEAM_SHEETS[teamId];
  const meta = getDynamicClassMetaByAny_(teamId, ss);
  if (meta) return meta.className;
  return String(fallbackName || teamId || '').trim();
}

function BACKFILL_DYNAMIC_CLASS_IDS() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', updatedRows: 0 };

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  let updatedRows = 0;
  values.forEach(function(row, index) {
    if (String(row[COL.CLASS_ID - 1] || '').trim()) return;
    const meta = getDynamicClassMetaByAny_(row[COL.TEAM - 1] || '', ss);
    if (!meta) return;
    sheet.getRange(index + 2, COL.CLASS_ID).setValue(meta.classId);
    updatedRows++;
  });

  return { status: 'ok', updatedRows: updatedRows };
}

// نسخة سريعة للواجهة: تقرأ أسماء الطلاب فقط بدون إنشاء/تنسيق الأوراق.
// هذا يمنع انتهاء مهلة getStudents في المتصفح.
function getAllTeamStudentsFast_(ss) {
  const out = {};
  Object.keys(TEAM_SHEETS).forEach(teamId => {
    try {
      const sheetName = TEAM_SHEETS[teamId];

      // نختار الورقة التي فيها أسماء فعلية، وليس أول ورقة بنفس الاسم فقط.
      // هذا مهم إذا وُجدت ورقة فارغة باسم قريب، أو بسبب اختلاف الهمزة: أولى/اولى.
      const sheet = findSheetByAliases(ss, sheetName) || ss.getSheetByName(sheetName);
      if (!sheet) {
        out[teamId] = [];
        return;
      }

      let names = readNamesFromRosterSheetRobust_(sheet);

      // احتياط: لو الورقة المقروءة طلعت فاضية، جرّب كل الأوراق المشابهة للحلقة واختر الأكثر أسماء.
      if (!names.length) {
        names = readNamesFromBestMatchingRosterSheet_(ss, teamId);
      }

      out[teamId] = names;
    } catch (err) {
      Logger.log('getAllTeamStudentsFast_ ERROR team=' + teamId + ': ' + err.message);
      out[teamId] = [];
    }
  });
  return out;
}

function getAllTeamStudentProfilesFast_(ss, namesByTeam) {
  void ss;
  const out = {};

  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    const names = (namesByTeam && namesByTeam[teamId]) || [];
    out[teamId] = names.map(function(name) {
      return { name: name, track: null, trackLabel: '' };
    });
  });

  return out;
}

function getFirstCircleTrackByStudent_(ss) {
  void ss;
  return {};
}

function getFirstCircleReportTheme_(track) {
  void track;
  return null;
}


// قراءة أسماء الطلاب من شيت "البيانات" حسب الحلقة.
// هذه الدالة كانت مستدعاة في getAllTeamStudents / getAllTeamStudentsFast_
// لكنها كانت مفقودة من النسخة السابقة، مما سبب ReferenceError أثناء Rebuild.
function readStudentNamesFromLogByTeam_(ss, teamId) {
  const targetTeam = normalizeTeamId(teamId || '');
  if (!targetTeam) return [];

  const logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet || logSheet.getLastRow() < 2) return [];

  const lastRow = logSheet.getLastRow();
  const values = logSheet
    .getRange(2, 1, lastRow - 1, HEADERS.length)
    .getDisplayValues();

  const names = [];

  values.forEach(function(row) {
    const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    const studentName = String(row[COL.STUDENT - 1] || '').trim();

    if (rowTeam !== targetTeam) return;
    if (!isStudentNameCellSafe_(studentName)) return;

    names.push(studentName);
  });

  return uniqueNames(names);
}

function readNamesFromBestMatchingRosterSheet_(ss, teamId) {
  const canonical = TEAM_SHEETS[teamId] || '';
  const aliases = [canonical, TEAM_NAMES[teamId]].concat(TEAM_SHEET_ALIASES[teamId] || []);
  const normalizedAliases = aliases.map(normalizeArabicSheetName);
  let best = [];

  ss.getSheets().forEach(sheet => {
    const n = normalizeArabicSheetName(sheet.getName());
    if (normalizedAliases.indexOf(n) === -1) return;
    const names = readNamesFromRosterSheetRobust_(sheet);
    if (names.length > best.length) best = names;
  });

  return best;
}

function readNamesFromRosterSheetRobust_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const lastCol = Math.max(1, Math.min(sheet.getLastColumn(), 12));
  const values = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

  let nameCol = 0;
  let headerRow = 0;
  let bestScore = -1;

  // ابحث في أول 10 صفوف عن عنوان اسم الطالب، لأن بعض الشيتات فيها صفوف مخفية أو فراغات فوق.
  const rowsToScan = Math.min(values.length, 10);
  for (let r = 0; r < rowsToScan; r++) {
    for (let c = 0; c < lastCol; c++) {
      const h = normalizeHeaderText_(values[r][c]);
      let score = -1;
      if (h === normalizeHeaderText_('اسم الطالب')) score = 100;
      else if (h === normalizeHeaderText_('الطالب')) score = 95;
      else if (h === normalizeHeaderText_('الاسم')) score = 90;
      else if (h === 'studentname' || h === 'student' || h === 'name') score = 75;
      if (score > bestScore) {
        bestScore = score;
        headerRow = r;
        nameCol = c;
      }
    }
  }

  // إذا لم نجد العنوان، اختر العمود الذي يحتوي أكبر عدد أسماء صالحة من أول 6 أعمدة.
  if (bestScore < 0) {
    let bestCount = -1;
    const colsToTry = Math.min(lastCol, 6);
    for (let c = 0; c < colsToTry; c++) {
      let count = 0;
      for (let r = 0; r < values.length; r++) {
        if (isStudentNameCellSafe_(values[r][c])) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        nameCol = c;
        headerRow = 0;
      }
    }
  }

  const names = [];
  const startRow = bestScore >= 0 ? headerRow + 1 : 1;
  for (let r = startRow; r < values.length; r++) {
    const name = String(values[r][nameCol] || '').trim();
    if (isStudentNameCellSafe_(name)) names.push(name);
  }

  return uniqueNames(names);
}

function isStudentNameCellSafe_(value) {
  const s = String(value || '').trim();
  if (!s || s.length < 2) return false;
  const h = normalizeHeaderText_(s);
  const blocked = [
    'اسمالطالب', 'الطالب', 'الاسم', 'اجراء', 'حذفنهائي', 'حذف', 'التاريخ', 'اليوم',
    'الحلقه', 'الحلقة', 'الحضور', 'الحفظ', 'المراجعه', 'المراجعة', 'المجموع',
    'ملاحظه', 'ملاحظة', 'النقاط', 'نقاطاليوم', 'الاصل', 'النسبه', 'النسبة',
    'الاسبوع', 'الأسبوع', 'تقرير', 'نعم', 'لا', 'لميسمع', 'حاضر', 'غائب'
  ];
  if (blocked.indexOf(h) !== -1) return false;
  if (/^[0-9\s.,:%+\-\/]+$/.test(s)) return false;
  if (/^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(s)) return false;
  return /[\u0600-\u06FFa-zA-Z]/.test(s);
}

function isFirstCircleRosterSheet_(sheet) {
  void sheet;
  return false;
}

function rosterHeadersForSheet_(sheet) {
  return isFirstCircleRosterSheet_(sheet) ? FIRST_CIRCLE_ROSTER_HEADERS : ROSTER_HEADERS;
}

function ensureFirstCircleTrackColumn_(sheet) {
  void sheet;
  // لم يعد يوجد مسار خاص بحلقة أولى؛ جميع أوراق الحلقات بنفس البنية.
}

function getOrCreateRosterSheet(ss, name) {
  // لا نعتمد على الاسم الحرفي فقط، خصوصاً في حلقة أولى بسبب الهمزة.
  // إذا كانت الورقة موجودة باسم قريب مثل "حلقة اولى" نقرأ منها بدل إنشاء ورقة جديدة فاضية باسم "حلقة أولى".
  let sheet = ss.getSheetByName(name) || findSheetByAliases(ss, name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.setRightToLeft(true);

  const header = String(sheet.getRange(1, 1).getDisplayValue() || '').trim();
  const oldSecondHeader = String(sheet.getRange(1, 2).getDisplayValue() || '').trim();

  // لو الورقة قديمة بنظام التسجيل اليومي، نحولها مرة واحدة إلى قائمة أسماء فقط.
  if (header !== ROSTER_HEADERS[0] && oldSecondHeader === 'الطالب') {
    const names = collectStudentNamesFromAnyTeamSheetLayout(sheet);
    rewriteRosterSheet(sheet, names);
  } else {
    formatRosterHeader(sheet);
  }

  return sheet;
}

function collectStudentNamesFromAnyTeamSheetLayout(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const headerA = String(sheet.getRange(1, 1).getDisplayValue() || '').trim();
  const headerB = String(sheet.getRange(1, 2).getDisplayValue() || '').trim();

  let column = 1;
  if (headerA === ROSTER_HEADERS[0]) column = 1;
  else if (headerB === 'الطالب') column = 2;
  else column = 1;

  const values = sheet.getRange(2, column, lastRow - 1, 1).getDisplayValues().flat();
  return uniqueNames(values);
}

function rewriteRosterSheet(sheet, names) {
  const firstCircle = isFirstCircleRosterSheet_(sheet);
  const clean = [];
  const seen = {};

  (names || []).forEach(function(value) {
    const objectValue = value && typeof value === 'object' ? value : null;
    const name = String(objectValue ? (objectValue.name || objectValue.studentName || '') : value || '').trim();
    if (!name || seen[name]) return;

    const trackMeta = firstCircle
      ? normalizeFirstCircleTrack_(objectValue ? (objectValue.track || objectValue.trackLabel || '') : '')
      : { track: '', trackLabel: '' };

    seen[name] = true;
    clean.push({
      name: name,
      track: trackMeta.track,
      trackLabel: trackMeta.trackLabel
    });
  });

  formatRosterHeader(sheet);
  const headers = rosterHeadersForSheet_(sheet);

  // مسح القائمة الحالية بالكامل مسموح في النظام الجديد.
  if (sheet.getMaxRows() >= 2) {
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length)
      .clearContent()
      .clearNote();
  }

  if (!clean.length) return;

  const rows = firstCircle
    ? clean.map(function(profile) { return [profile.name, profile.trackLabel]; })
    : clean.map(function(profile) { return [profile.name]; });

  sheet.getRange(2, 1, rows.length, headers.length)
    .setValues(rows)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

  if (firstCircle) {
    sheet.getRange(2, FIRST_CIRCLE_TRACK_COL, rows.length, 1).setHorizontalAlignment('center');
  }
}


function formatRosterHeader(sheet) {
  ensureFirstCircleTrackColumn_(sheet);
  const headers = rosterHeadersForSheet_(sheet);
  const firstCircle = isFirstCircleRosterSheet_(sheet);
  ensureColumns(sheet, headers.length);

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(1);
  sheet.setColumnWidth(ROSTER_NAME_COL, 240);
  if (firstCircle) sheet.setColumnWidth(FIRST_CIRCLE_TRACK_COL, 190);
  sheet.setRowHeight(1, 32);

  const maxRows = Math.max(sheet.getMaxRows() - 1, 1);

  if (firstCircle) {
    const trackRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(FIRST_CIRCLE_TRACK_OPTIONS, true)
      .setAllowInvalid(false)
      .setHelpText('اختر مسار الطالب: الحفظ والمراجعة، القاعدة النورانية، أو التلاوة.')
      .build();

    sheet.getRange(2, FIRST_CIRCLE_TRACK_COL, maxRows, 1)
      .setDataValidation(trackRule)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  }
}


function readRosterNames(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
  return uniqueNames(values);
}

// ══════════════════════════════════════════════════════════════
//  إدارة طلاب الحلقة من موقع التسجيل (إضافة/حذف مع تحديث التقرير)
// ══════════════════════════════════════════════════════════════

function resolveRosterSheetForTeam_(ss, teamId) {
  // يعيد ورقة الأسماء الصحيحة لحلقة أو فصل، مع معرّف الحلقة الفعلي للمسار القديم.
  const normalized = normalizeTeamId(teamId);
  if (!normalized) throw new Error('teamId مطلوب أو غير صحيح');

  if (isDynamicClassId_(normalized)) {
    const meta = getDynamicClassMetaByAny_(normalized, ss);
    if (!meta) throw new Error('الفصل/الحلقة غير معروفة: ' + normalized);
    if (meta.legacyTeamId) {
      const legacySheet = findSheetByAliases(ss, TEAM_SHEETS[meta.legacyTeamId]) || ss.getSheetByName(TEAM_SHEETS[meta.legacyTeamId]);
      if (!legacySheet) throw new Error('لم يتم العثور على شيت: ' + TEAM_SHEETS[meta.legacyTeamId]);
      return { sheet: legacySheet, effectiveTeamId: meta.legacyTeamId };
    }
    if (!meta.sheet) throw new Error('لم يتم العثور على شيت الفصل: ' + normalized);
    return { sheet: meta.sheet, effectiveTeamId: normalized };
  }

  const sheet = findSheetByAliases(ss, TEAM_SHEETS[normalized]) || ss.getSheetByName(TEAM_SHEETS[normalized]);
  if (!sheet) throw new Error('لم يتم العثور على شيت الحلقة: ' + TEAM_SHEETS[normalized]);
  return { sheet: sheet, effectiveTeamId: normalized };
}

function findRosterNameRows_(sheet, studentName) {
  const wanted = String(studentName || '').trim();
  if (!wanted) return [];
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    const found = sheet.getRange(2, ROSTER_NAME_COL, lastRow - 1, 1)
      .createTextFinder(wanted)
      .matchEntireCell(true)
      .matchCase(false)
      .findAll();
    return (found || []).map(function(r) { return r.getRow(); });
  } catch (err) {
    Logger.log('findRosterNameRows_ fallback: ' + err.message);
    const rows = [];
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow >= 2) {
        const values = sheet.getRange(2, ROSTER_NAME_COL, lastRow - 1, 1).getValues();
        values.forEach(function(v, i) {
          if (String(v[0] || '').trim() === wanted) rows.push(i + 2);
        });
      }
    } catch (_) {}
    return rows;
  }
}

function addStudentToRoster_(teamId, studentName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  studentName = String(studentName || '').trim().replace(/\s+/g, ' ');
  if (!studentName) throw new Error('اسم الطالب مطلوب');
  if (studentName.length > 60) throw new Error('الاسم طويل جداً (الحد 60 حرفاً)');
  if (isInvalidUnifiedStudentName_(studentName)) throw new Error('الاسم غير صالح');

  const resolved = resolveRosterSheetForTeam_(ss, teamId);
  const sheet = resolved.sheet;

  if (rosterHasNameFast_(sheet, studentName)) {
    return { status: 'exists', studentName: studentName, message: 'الطالب موجود مسبقاً في الحلقة' };
  }

  const row = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(row, 1).setValue(studentName);
  sheet.getRange(row, 1, 1, rosterHeadersForSheet_(sheet).length)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
  if (resolved.effectiveTeamId === 'blue') {
    sheet.getRange(row, FIRST_CIRCLE_TRACK_COL).setHorizontalAlignment('center');
  }

  // نحدّث تقرير الحلقة فوراً حتى يظهر الطالب بصف اليوم من أول لحظة.
  let reportUpdated = false;
  try {
    generateUnifiedReportForTeamOnly(resolved.effectiveTeamId, formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));
    reportUpdated = true;
  } catch (err) {
    Logger.log('addStudentToRoster_ report refresh ERROR: ' + err.message);
  }

  return {
    status: 'ok',
    studentName: studentName,
    reportUpdated: reportUpdated,
    message: reportUpdated ? 'تمت إضافة الطالب وتحديث تقرير الحلقة' : 'تمت إضافة الطالب'
  };
}

// إضافة مجموعة طلاب مرة واحدة (من «إدارة الحلقة» في موقع التسجيل).
// نكتب كل الأسماء في شيت الحلقة ثم نبني تقرير الحلقة مرة واحدة فقط.
function addStudentsToRoster_(teamId, namesRaw) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  let names = [];
  if (Array.isArray(namesRaw)) {
    names = namesRaw;
  } else {
    const raw = String(namesRaw || '').trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        names = Array.isArray(parsed) ? parsed : raw.split(/[\n\r,،]+/);
      } catch (_) {
        names = raw.split(/[\n\r,،]+/);
      }
    }
  }

  names = names.map(function(n) {
    return String(n || '').trim().replace(/\s+/g, ' ');
  }).filter(function(n) { return !!n; });

  if (!names.length) throw new Error('لم تُرسل أي أسماء');

  const resolved = resolveRosterSheetForTeam_(ss, teamId);
  const sheet = resolved.sheet;

  const added = [];
  const skipped = [];
  const invalid = [];
  const seen = {};

  names.forEach(function(name) {
    if (seen[name]) return;
    seen[name] = true;

    if (name.length > 60 || isInvalidUnifiedStudentName_(name)) {
      invalid.push(name);
      return;
    }
    if (rosterHasNameFast_(sheet, name)) {
      skipped.push(name);
      return;
    }

    const row = Math.max(sheet.getLastRow() + 1, 2);
    sheet.getRange(row, 1).setValue(name);
    sheet.getRange(row, 1, 1, rosterHeadersForSheet_(sheet).length)
      .setHorizontalAlignment('right')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
    if (resolved.effectiveTeamId === 'blue') {
      sheet.getRange(row, FIRST_CIRCLE_TRACK_COL).setHorizontalAlignment('center');
    }
    added.push(name);
  });

  // بناء تقرير الحلقة مرة واحدة بعد إضافة كل الأسماء.
  let reportUpdated = false;
  if (added.length) {
    try {
      generateUnifiedReportForTeamOnly(resolved.effectiveTeamId, formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));
      reportUpdated = true;
    } catch (err) {
      Logger.log('addStudentsToRoster_ report refresh ERROR: ' + err.message);
    }
  }

  const parts = [];
  parts.push('تمت إضافة ' + added.length + ' طالباً');
  if (skipped.length) parts.push('(' + skipped.length + ' موجود مسبقاً: ' + skipped.join('، ') + ')');
  if (invalid.length) parts.push('(' + invalid.length + ' اسم غير صالح تم تجاهله)');

  return {
    status: 'ok',
    added: added,
    skipped: skipped,
    invalid: invalid,
    addedCount: added.length,
    reportUpdated: reportUpdated,
    message: parts.join(' ')
  };
}

function removeStudentFromRoster_(teamId, studentName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  studentName = String(studentName || '').trim();
  if (!studentName) throw new Error('اسم الطالب مطلوب');

  const resolved = resolveRosterSheetForTeam_(ss, teamId);
  const rows = findRosterNameRows_(resolved.sheet, studentName);
  if (!rows.length) {
    return { status: 'not-found', studentName: studentName, message: 'الطالب غير موجود في هذه الحلقة' };
  }

  // حذف من الأسفل للأعلى حتى لا تتأثر أرقام الصفوف.
  rows.sort(function(a, b) { return b - a; }).forEach(function(rowIdx) {
    resolved.sheet.deleteRow(rowIdx);
  });

  // إعادة بناء تقرير الحلقة ليختفي الطالب منه (نفس نتيجة الحذف اليدوي من الشيت).
  let reportUpdated = false;
  try {
    generateUnifiedReportForTeamOnly(resolved.effectiveTeamId, formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));
    reportUpdated = true;
  } catch (err) {
    Logger.log('removeStudentFromRoster_ report refresh ERROR: ' + err.message);
  }

  return {
    status: 'ok',
    studentName: studentName,
    removed: rows.length,
    reportUpdated: reportUpdated,
    message: 'تم حذف الطالب من الحلقة والتقرير'
  };
}

// ══════════════════════════════════════════════════════════════
//  سجل التسجيلات: جلب/حذف تسجيل يوم محدد لحلقة محددة
// ══════════════════════════════════════════════════════════════

function getEntriesForResult_(teamId, dateStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  const normalized = normalizeTeamId(teamId);
  if (!normalized) throw new Error('teamId مطلوب أو غير صحيح');

  dateStr = mapRequestedDateToSchoolDay_(dateStr);
  if (!dateStr) throw new Error('التاريخ غير صحيح');

  const entries = [];
  const lastRow = logSheet.getLastRow();
  if (lastRow >= 2) {
    const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    data.forEach(function(row, idx) {
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      if (rowDate !== dateStr) return;
      const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      if (rowTeam !== normalized) return;
      const student = String(row[COL.STUDENT - 1] || '').trim();
      if (!student) return;
      entries.push({
        studentName: student,
        hudur: row[COL.HUDUR - 1] || '',
        hifzFrom: row[COL.HIFZ_FROM - 1] || '',
        hifzTo: row[COL.HIFZ_TO - 1] || '',
        hifzScore: row[COL.HIFZ_SCORE - 1] || '',
        muraFrom: row[COL.MURA_FROM - 1] || '',
        muraTo: row[COL.MURA_TO - 1] || '',
        muraScore: row[COL.MURA_SCORE - 1] || '',
        haqiba: row[COL.HAQIBA - 1] || '',
        istima: row[COL.ISTIMA - 1] || '',
        total: Number(row[COL.TOTAL - 1]) || 0,
        row: idx + 2
      });
    });
  }

  return {
    status: 'ok',
    date: dateStr,
    teamId: normalized,
    teamName: getCompetitionUnitName_(normalized, ''),
    count: entries.length,
    entries: entries
  };
}

function deleteEntry_(teamId, dateStr, studentName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  const normalized = normalizeTeamId(teamId);
  if (!normalized) throw new Error('teamId مطلوب أو غير صحيح');

  dateStr = mapRequestedDateToSchoolDay_(dateStr);
  if (!dateStr) throw new Error('التاريخ غير صحيح');

  studentName = String(studentName || '').trim();
  if (!studentName) throw new Error('studentName مطلوب');

  const lastRow = logSheet.getLastRow();
  let deleted = 0;
  if (lastRow >= 2) {
    const values = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    // نحذف من الأسفل للأعلى حتى لا تتأثر الفهارس أثناء الحذف.
    for (let i = values.length - 1; i >= 0; i--) {
      const row = values[i];
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      if (rowDate !== dateStr) continue;
      const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      if (rowTeam !== normalized) continue;
      if (String(row[COL.STUDENT - 1] || '').trim() !== studentName) continue;
      logSheet.deleteRow(i + 2);
      deleted++;
    }
  }

  if (deleted > 0) {
    // نحدّث تقرير الحلقة لنفس التاريخ حتى يختفي تسجيل الطالب من يومه.
    try {
      generateUnifiedReportForTeamOnly(normalized, dateStr);
    } catch (err) {
      Logger.log('deleteEntry_ report refresh ERROR: ' + err.message);
    }
  }

  return {
    status: 'ok',
    deleted: deleted,
    date: dateStr,
    studentName: studentName,
    teamId: normalized,
    message: deleted > 0 ? 'تم حذف التسجيل وتحديث تقرير الحلقة' : 'لم يتم العثور على تسجيل بهذه البيانات'
  };
}

function appendStudentToRosterIfMissing(ss, teamId, studentName) {
  studentName = String(studentName || '').trim();
  // حماية نهائية: عناوين التقرير ليست أسماء طلاب، ولا يجوز إضافتها إلى شيت الفصل/الحلقة.
  if (!studentName || isInvalidUnifiedStudentName_(studentName)) return;

  let sheet = null;
  if (isDynamicClassId_(teamId)) {
    sheet = getDynamicClassSheetById_(ss, teamId);
    if (!sheet) throw new Error('تعذر العثور على شيت الفصل: ' + teamId);
    // لا نعيد تنسيق ورقة الفصل في كل حفظ؛ التنسيق يتم مرة واحدة عند الإنشاء.
  } else {
    sheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);
  }

  // فحص وجود سريع بدون قراءة كل الأسماء في كل تسجيل.
  if (rosterHasNameFast_(sheet, studentName)) return;
  const row = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(row, 1).setValue(studentName);
  sheet.getRange(row, 1, 1, rosterHeadersForSheet_(sheet).length)
    .setHorizontalAlignment('right')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);
  if (teamId === 'blue') {
    sheet.getRange(row, FIRST_CIRCLE_TRACK_COL).setHorizontalAlignment('center');
  }
}

function rosterHasNameFast_(sheet, studentName) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;
    const found = sheet
      .getRange(2, ROSTER_NAME_COL, lastRow - 1, 1)
      .createTextFinder(studentName)
      .matchEntireCell(true)
      .matchCase(false)
      .findAll();
    return found && found.length > 0;
  } catch (err) {
    Logger.log('rosterHasNameFast_ fallback: ' + err.message);
    return readRosterNames(sheet).indexOf(studentName) !== -1;
  }
}

function uniqueNames(values) {
  const seen = {};
  const out = [];
  values.forEach(v => {
    const name = String(v || '').trim();
    if (!name) return;
    if (seen[name]) return;
    seen[name] = true;
    out.push(name);
  });
  return out;
}

// ══════════════════════════════════════════════════════════════
//  التقرير الأسبوعي
// ══════════════════════════════════════════════════════════════
function generateWeeklyReport(baseDateValue) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);

  const today = startOfDay(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const requestedBaseDate = parseDate(dateValueToString(baseDateValue));
  const reportBaseDate = requestedBaseDate || getWeeklyReportBaseDate(logSheet, today);
  const sunday = getWeekStart(reportBaseDate);

  Logger.log('generateWeeklyReport | baseDateValue=' + baseDateValue + ' | reportBaseDate=' + formatDate(reportBaseDate) + ' | sunday=' + formatDate(sunday));

  Object.keys(TEAM_SHEETS).forEach(teamId => {
    const teamSheetName = TEAM_SHEETS[teamId];
    const weeklySheetName = WEEKLY_PREFIX + teamSheetName;
    const weeklySheet = buildWeeklySheetHeader(ss, weeklySheetName, teamSheetName, sunday);

    try { weeklySheet.showRows(1, weeklySheet.getMaxRows()); } catch (e) {}
    clearRowGroups(weeklySheet);
    clearWeeklyBody(weeklySheet);

    const studentNames = getWeeklyStudentsForTeam(teamId, rosterMap, logMaps, sunday);
    const rows = [];
    const groupRanges = [];
    let sheetRow = 3;

    studentNames.forEach(studentName => {
      const headerRow = sheetRow;
      const header = Array(WEEKLY_HEADERS.length).fill('');
      header[0] = studentName;
      rows.push(header);
      sheetRow++;

      const firstDayRow = sheetRow;
      for (let i = 0; i < SESSION_DAYS.length; i++) {
        const day = addDays(sunday, SESSION_DAYS[i]);
        const dateStr = formatDate(day);
        const saved = logMaps.byKey[dateStr + '|' + teamId + '|' + studentName];

        if (saved) {
          rows.push([
            DAY_NAMES_AR[day.getDay()],
            dateStr,
            saved[COL.HUDUR - 1] || '',
            saved[COL.HIFZ_FROM - 1] || '',
            saved[COL.HIFZ_TO - 1] || '',
            saved[COL.HIFZ_SCORE - 1] || '',
            saved[COL.MURA_FROM - 1] || '',
            saved[COL.MURA_TO - 1] || '',
            saved[COL.MURA_SCORE - 1] || '',
            saved[COL.HAQIBA - 1] || '',
            saved[COL.ISTIMA - 1] || '',
            saved[COL.TOTAL - 1] || 0,
            ''
          ]);
        } else {
          rows.push([DAY_NAMES_AR[day.getDay()], dateStr, '', '', '', '', '', '', '', '', '', '', '']);
        }
        sheetRow++;
      }

      const lastDayRow = sheetRow - 1;
      const totalRow = sheetRow;
      const total = Array(WEEKLY_HEADERS.length).fill('');
      total[0] = 'الإجمالي الأسبوعي — ' + studentName;
      rows.push(total);
      groupRanges.push({ header: headerRow, first: firstDayRow, lastDay: lastDayRow, total: totalRow });
      sheetRow++;
    });

    if (rows.length) {
      weeklySheet.getRange(3, 2, rows.length, 1).setNumberFormat('@');
      weeklySheet.getRange(3, 1, rows.length, WEEKLY_HEADERS.length).setValues(rows);
      formatWeeklyBody(weeklySheet, rows.length, groupRanges);
      applyWeeklyFormulas(weeklySheet, groupRanges);
      applyWeeklyValidations(weeklySheet, groupRanges);
      applyWeeklyRowGroups(weeklySheet, groupRanges);
    }

    weeklySheet.autoResizeRows(1, Math.max(weeklySheet.getLastRow(), 1));
  });
}

function readLogRowsByTeamStudentDate(sheet, rosterMap) {
  // نخزن مفتاحاً مطابقاً للاسم كما هو، ومفتاحاً ثانياً باسم موحّد.
  // هذا يمنع ظهور التقرير صفراً عندما يختلف اسم الطالب بين ورقة الحلقة وورقة البيانات
  // بمسافة مخفية أو تشكيل أو اختلاف بسيط في الألف/الياء.
  const out = { byKey: {}, byNormalizedKey: {}, namesByTeam: {} };
  Object.keys(TEAM_SHEETS).forEach(teamId => out.namesByTeam[teamId] = {});

  if (!sheet || sheet.getLastRow() <= 1) return out;

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  data.forEach(row => {
    const dateStr = normalizeDate(dateValueToString(row[COL.DATE - 1]));
    const student = String(row[COL.STUDENT - 1] || '').trim();
    let teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');

    if (!dateStr || !student) return;
    if (!teamId) teamId = inferTeamIdForStudent(student, rosterMap);
    if (!teamId) return;

    out.byKey[dateStr + '|' + teamId + '|' + student] = row;
    out.byNormalizedKey[dateStr + '|' + teamId + '|' + normalizeStudentReportKey_(student)] = row;
    out.namesByTeam[teamId][student] = true;
  });

  return out;
}

function getWeeklyReportBaseDate(logSheet, today) {
  // عند التشغيل اليدوي، نبني التقرير على آخر تاريخ مُسجل في شيت البيانات.
  // هذا يمنع ظهور التقرير الأسبوعي على أسبوع مختلف عن آخر تسجيل.
  today = startOfDay(today || (getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));

  try {
    if (logSheet && logSheet.getLastRow() > 1) {
      const data = logSheet.getRange(2, COL.DATE, logSheet.getLastRow() - 1, 1).getValues().flat();
      for (let i = data.length - 1; i >= 0; i--) {
        const d = parseDate(dateValueToString(data[i]));
        if (!d) continue;
        if (!SESSION_DAYS.includes(d.getDay()) || isCanceledSessionDate(d)) continue;
        return d;
      }
    }
  } catch (e) {
    Logger.log('getWeeklyReportBaseDate skipped: ' + e.message);
  }

  return today;
}


function getWeeklyStudentsForTeam(teamId, rosterMap, logMaps, sunday) {
  const names = [];
  const seen = {};

  function addName(name) {
    name = String(name || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    names.push(name);
  }

  (rosterMap[teamId] || []).forEach(addName);

  // نضيف فقط الطلاب الذين لهم بيانات فعلية في هذا الأسبوع داخل هذه الحلقة.
  for (let i = 0; i < SESSION_DAYS.length; i++) {
    const dateStr = formatDate(addDays(sunday, SESSION_DAYS[i]));
    const prefix = dateStr + '|' + teamId + '|';
    Object.keys(logMaps.byKey).forEach(key => {
      if (key.indexOf(prefix) === 0) addName(key.slice(prefix.length));
    });
  }

  return names;
}

function buildWeeklySheetHeader(ss, name, teamName, sunday) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.setRightToLeft(true);
  ensureColumns(sheet, WEEKLY_HEADERS.length);

  const title = '📊 التقرير الأسبوعي — ' + teamName + ' — أسبوع يبدأ ' + formatDate(sunday) + ' — الهدف الأسبوعي ' + WEEKLY_TARGET + ' نقطة — الأيام المحسوبة: ' + SESSION_DAYS_LABEL;
  sheet.getRange(1, 1, 1, WEEKLY_HEADERS.length).breakApart();
  sheet.getRange(1, 1, 1, WEEKLY_HEADERS.length)
    .merge()
    .setValue(title)
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#0f2027')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  const weeklyHeaders = WEEKLY_HEADERS.slice();
  weeklyHeaders[10] = getBehaviorLabelForWeek_(getCourseWeekNumberForDate_(sunday));
  sheet.getRange(2, 1, 1, WEEKLY_HEADERS.length)
    .setValues([weeklyHeaders])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(2);
  applyWeeklyWidths(sheet);
  return sheet;
}

function clearWeeklyBody(sheet) {
  const lastRow = sheet.getMaxRows();
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, Math.max(sheet.getMaxColumns(), WEEKLY_HEADERS.length))
      .clearContent()
      .clearFormat()
      .clearDataValidations()
      .breakApart();
  }
}

function formatWeeklyBody(sheet, rowCount, groupRanges) {
  if (rowCount <= 0) return;
  const body = sheet.getRange(3, 1, rowCount, WEEKLY_HEADERS.length);
  body.setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#d9e2f3', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);

  groupRanges.forEach(g => {
    sheet.getRange(g.header, 1, 1, 11).merge()
      .setBackground('#1e3a5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('right')
      .setVerticalAlignment('middle');
    sheet.getRange(g.header, 12, 1, 2)
      .setBackground('#1e3a5f')
      .setFontColor('#fde047')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    const dayCount = Math.max(0, g.lastDay - g.first + 1);
    if (dayCount > 0) {
      sheet.getRange(g.first, 1, dayCount, WEEKLY_HEADERS.length).setBackground('#f8fbff');
    }

    sheet.getRange(g.total, 1, 1, 11).merge()
      .setBackground('#e8f5e9')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.getRange(g.total, 12, 1, 2)
      .setBackground('#e8f5e9')
      .setFontWeight('bold');
  });

  sheet.getRange(3, 12, rowCount, 1).setNumberFormat('0');
  sheet.getRange(3, 13, rowCount, 1).setNumberFormat('0%');
  sheet.setRowHeights(3, rowCount, 34);
}

function applyWeeklyFormulas(sheet, groupRanges) {
  groupRanges.forEach(g => {
    for (let r = g.first; r <= g.lastDay; r++) {
      sheet.getRange(r, 12).setFormula(
        '=IF($C' + r + '="غائب",0,IFERROR(VALUE($F' + r + '),0)+IFERROR(VALUE($I' + r + '),0)+IF($K' + r + '="نعم",20,0)+IF($J' + r + '="نعم",10,0)+IF($C' + r + '="حاضر",10,0))'
      );
      sheet.getRange(r, 13).setValue('');
    }

    // ملخص الأسبوع داخل صف "الإجمالي الأسبوعي":
    // الحضور = عدد أيام الحضور
    // الحفظ من = أول بداية حفظ في الأسبوع
    // الحفظ إلى = آخر نهاية حفظ في الأسبوع
    // المراجعة من/إلى بنفس الطريقة
    // الحقيبة/الإستماع أو الإستماع = عدد مرات "نعم"
    sheet.getRange(g.total, 3).setFormula('=COUNTIF($C' + g.first + ':$C' + g.lastDay + ',"حاضر")');

    sheet.getRange(g.total, 4).setFormula('=IFERROR(INDEX(FILTER($D' + g.first + ':$D' + g.lastDay + ',$D' + g.first + ':$D' + g.lastDay + '<>""),1),"")');
    sheet.getRange(g.total, 5).setFormula('=IFERROR(LOOKUP(2,1/($E' + g.first + ':$E' + g.lastDay + '<>""),$E' + g.first + ':$E' + g.lastDay + '),"")');
    sheet.getRange(g.total, 6).setFormula('=SUMPRODUCT(IFERROR(VALUE($F' + g.first + ':$F' + g.lastDay + '),0))');

    sheet.getRange(g.total, 7).setFormula('=IFERROR(INDEX(FILTER($G' + g.first + ':$G' + g.lastDay + ',$G' + g.first + ':$G' + g.lastDay + '<>""),1),"")');
    sheet.getRange(g.total, 8).setFormula('=IFERROR(LOOKUP(2,1/($H' + g.first + ':$H' + g.lastDay + '<>""),$H' + g.first + ':$H' + g.lastDay + '),"")');
    sheet.getRange(g.total, 9).setFormula('=SUMPRODUCT(IFERROR(VALUE($I' + g.first + ':$I' + g.lastDay + '),0))');

    sheet.getRange(g.total, 10).setFormula('=COUNTIF($J' + g.first + ':$J' + g.lastDay + ',"نعم")');
    sheet.getRange(g.total, 11).setFormula('=COUNTIF($K' + g.first + ':$K' + g.lastDay + ',"نعم")');

    sheet.getRange(g.header, 12).setFormula('=SUM($L' + g.first + ':$L' + g.lastDay + ')');
    sheet.getRange(g.header, 13).setFormula('=$L' + g.header + '/' + WEEKLY_TARGET);

    sheet.getRange(g.total,  12).setFormula('=SUM($L' + g.first + ':$L' + g.lastDay + ')');
    sheet.getRange(g.total,  13).setFormula('=$L' + g.total  + '/' + WEEKLY_TARGET);
  });
}

function applyWeeklyValidations(sheet, groupRanges) {
  // false = لا تظهر مثلثات القوائم المنسدلة داخل الخلايا
  const attendanceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ATTENDANCE_OPTIONS, false)
    .setAllowInvalid(true)
    .build();
  const scoreRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SCORE_OPTIONS, false)
    .setAllowInvalid(true)
    .build();
  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(YES_NO_OPTIONS, false)
    .setAllowInvalid(true)
    .build();

  groupRanges.forEach(g => {
    const count = g.lastDay - g.first + 1;
    if (count <= 0) return;
    sheet.getRange(g.first, 3,  count, 1).setDataValidation(attendanceRule);
    sheet.getRange(g.first, 6,  count, 1).setDataValidation(scoreRule);
    sheet.getRange(g.first, 9,  count, 1).setDataValidation(scoreRule);
    sheet.getRange(g.first, 10, count, 1).setDataValidation(yesNoRule);
    sheet.getRange(g.first, 11, count, 1).setDataValidation(yesNoRule);
  });
}


function applyWeeklyRowGroups(sheet, groupRanges) {
  // يجعل التقرير يظهر كسطر واحد لكل طالب.
  // علامة + تفتح تفاصيل أيام الأسبوع، وعلامة - تغلقها.
  try {
    sheet.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
  } catch (e) {}

  groupRanges.forEach(g => {
    const startRow = g.first;                 // أول يوم في التقرير
    const rowCount = g.total - g.first + 1;   // أيام الأسبوع + سطر الإجمالي
    if (rowCount <= 0) return;

    try {
      // نعمل مجموعة للصفوف التفصيلية فقط، ونترك صف اسم الطالب ظاهر.
      sheet.getRange(startRow, 1, rowCount, 1).shiftRowGroupDepth(1);

      const group = sheet.getRowGroup(startRow, 1);
      if (group) {
        group.collapse(); // يخفي التفاصيل ويظهر + بجانب اسم الطالب
      } else {
        // احتياط في حال لم يرجع Google Sheets كائن المجموعة مباشرة.
        sheet.hideRows(startRow, rowCount);
      }
    } catch (e) {
      Logger.log('applyWeeklyRowGroups skipped at row ' + startRow + ': ' + e.message);
      try { sheet.hideRows(startRow, rowCount); } catch (_) {}
    }
  });
}

function applyWeeklyWidths(sheet) {
  const widths = [170, 95, 90, 150, 150, 85, 150, 150, 95, 95, 85, 90, 100];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

function clearRowGroups(sheet) {
  const lastRow = sheet.getMaxRows();
  try { sheet.getRange(1, 1, lastRow, 1).shiftRowGroupDepth(-8); } catch (e) {}
}

// ══════════════════════════════════════════════════════════════
//  الغياب التلقائي — يعتمد على أسماء الطلاب من أوراق الحلقات
// ══════════════════════════════════════════════════════════════
function markAbsences() {
  // الغياب التلقائي يعمل الساعة 6:00 صباحاً:
  // اليوم الدراسي المنتهي هو «أمس» التقويمي (اليوم الدراسي = الساعة الحالية − 6 ساعات).
  // مثال: تريجر الساعة 6 صباحاً يوم الاثنين → يكتب غياب يوم الأحد لكل من لم يُسجل له،
  // وأي تسجيل بعد 6 صباحاً يبدأ يُحسب ليوم الاثنين.
  const today = getEndedSchoolDay_();

  // الأيام المعتمدة: الأحد إلى الأربعاء فقط.
  if (!isSessionDayInAppTimezone(today)) {
    Logger.log('markAbsences skipped: school day ' + formatDate(today) + ' is not a session day in ' + APP_TIMEZONE + ' | day=' + today.getDay());
    return;
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const dateStr = formatDate(today);
  const rosterMap = getAllTeamStudents(ss);

  let inserted = 0;
  let skipped = 0;

  Object.keys(TEAM_SHEETS).forEach(teamId => {
    (rosterMap[teamId] || []).forEach(name => {
      const studentName = String(name || '').trim();
      if (!studentName) return;

      const emptyData = {
        studentName,
        teamId,
        date: dateStr,
        hudur: false,
        hifzScore: '',
        muraScore: '',
        haqiba: false,
        istima: false,
        totalPoints: 0,
        notes: '🔴 غياب تلقائي'
      };

      if (findLogRow(logSheet, dateStr, studentName, teamId) === 0) {
        insertLogRow(logSheet, dateStr, studentName, emptyData, teamId);
        inserted++;
      } else {
        skipped++;
      }
    });
  });

  Logger.log('markAbsences done for ' + dateStr + ' | inserted=' + inserted + ' | skipped=' + skipped);

  markReportsDirty(dateStr);
}


// ══════════════════════════════════════════════════════════════
//  تعديل التقرير الأسبوعي من داخل Google Sheets
// ══════════════════════════════════════════════════════════════
function onEdit(e) {
  // تعديل قوائم الطلاب يعتمد على تريجر مثبت مستقل باسم handleRosterEdit
  // لأنه ينفذ حذف البيانات وإعادة بناء التقرير بصلاحيات كاملة.
  // لا نستدعي handleRosterEdit هنا حتى لا ينفذ التعديل مرتين.

  // تعديل تقرير الحلقة الموحد يعمل من تريجر تثبيت مستقل باسم handleUnifiedReportEdit.
  // إبقاء دعم التقرير الأسبوعي القديم للتوافق فقط.
  handleWeeklyEdit(e);
}


function handleWeeklyEdit(e) {
  try {
    if (!e || !e.range || !e.source) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    if (!sheetName.startsWith(WEEKLY_PREFIX)) return;

    const row = e.range.getRow();
    const col = e.range.getColumn();
    if (row < 3 || col < 3 || col > 11) return;

    const dayName = String(sheet.getRange(row, 1).getDisplayValue() || '').trim();
    const dateStr = normalizeDate(sheet.getRange(row, 2).getDisplayValue());
    if (!DAY_NAMES_AR.includes(dayName) || !dateStr) return;

    const teamName = sheetName.replace(WEEKLY_PREFIX, '');
    const teamId = teamIdFromSheetName(teamName);
    if (!teamId) return;

    const studentName = getStudentNameFromWeeklyRow(sheet, row);
    if (!studentName) return;

    sheet.getRange(row, 12).setFormula(
      '=IF($C' + row + '="غائب",0,IFERROR(VALUE($F' + row + '),0)+IFERROR(VALUE($I' + row + '),0)+IF($K' + row + '="نعم",20,0)+IF($J' + row + '="نعم",10,0)+IF($C' + row + '="حاضر",10,0))'
    );

    const rowValues = sheet.getRange(row, 1, 1, WEEKLY_HEADERS.length).getValues()[0];
    const data = weeklyRowToPayload(studentName, teamId, dateStr, rowValues);

    const ss = e.source;
    const logSheet = getOrCreateLogSheet(ss);
    appendStudentToRosterIfMissing(ss, teamId, studentName);

    const logRow = findLogRow(logSheet, dateStr, studentName, teamId);
    if (logRow > 0) upsertLogRow(logSheet, logRow, data, teamId);
    else insertLogRow(logSheet, dateStr, studentName, data, teamId);

    generateFinalReports();
  } catch (err) {
    Logger.log('handleWeeklyEdit ERROR: ' + err.message);
  }
}

function getStudentNameFromWeeklyRow(sheet, row) {
  for (let r = row; r >= 3; r--) {
    const text = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!text) continue;
    if (DAY_NAMES_AR.includes(text)) continue;
    if (text.indexOf('الإجمالي الأسبوعي') === 0) continue;
    if (text.indexOf('👤') === 0) return text.replace('👤', '').split('—')[0].trim();
    return text.split('—')[0].trim();
  }
  return '';
}

function weeklyRowToPayload(studentName, teamId, dateStr, rowValues) {
  const hudur     = normalizeAttendance(rowValues[2]);
  const hifzScore = normalizeScore(rowValues[5]);
  const muraScore = normalizeScore(rowValues[8]);
  const haqiba    = normalizeYesNo(rowValues[9]);
  const istima    = normalizeYesNo(rowValues[10]);

  return {
    studentName, teamId, date: dateStr, hudur,
    hifzFrom: firstText(rowValues[3]), hifzTo: firstText(rowValues[4]), hifzScore,
    muraFrom: firstText(rowValues[6]), muraTo: firstText(rowValues[7]), muraScore,
    haqiba, istima,
    totalPoints: totalFromPayload({}, hifzScore, muraScore, hudur, haqiba, istima),
    notes: 'تم التعديل من التقرير الأسبوعي'
  };
}


// ══════════════════════════════════════════════════════════════
//  تعديل أسماء الطلاب من شيت أسماء الحلقة
//  جميع الحلقات بنفس البنية: عمود A = اسم الطالب فقط.
//  - تغيير الاسم = إعادة تسمية مع حفظ السجلات.
//  - حذف الاسم = حذف نهائي من البيانات والتقرير مباشرة.
//  - إضافة اسم = طالب جديد.
// ══════════════════════════════════════════════════════════════
function handleRosterEdit(e) {
  const lock = LockService.getDocumentLock();

  try {
    if (!e || !e.range || !e.source) return;

    const sheet = e.range.getSheet();
    const teamId = rosterTeamIdFromSheetName_(sheet.getName());
    if (!teamId) return;

    const row = e.range.getRow();
    const col = e.range.getColumn();
    const numRows = e.range.getNumRows();
    const numCols = e.range.getNumColumns();

    // جميع أوراق الحلقات الآن موحّدة: التعديل الوحيد الذي يهمنا هو عمود اسم الطالب A.
    if (row < 2 || col !== ROSTER_NAME_COL || numCols !== 1) return;

    try { lock.waitLock(8000); } catch (_) {}

    const ss = e.source;
    const newDisplayValue = String(e.range.getDisplayValue() || '').trim();
    const oldValue = String(e.oldValue || '').trim();

    // لصق/حذف عدة أسماء دفعة واحدة:
    // القائمة الحالية هي الحقيقة النهائية، وأي طالب لم يعد موجوداً يُحذف من البيانات والتقرير.
    if (numRows > 1) {
      purgeLogStudentsMissingFromRoster_(ss, teamId);
      compactRosterSheetAllowEmpty_(sheet);
      generateUnifiedReportForTeamOnly(teamId, '');
      SpreadsheetApp.flush();
      return;
    }

    // تعديل الاسم داخل نفس الخلية = نقل سجلات الطالب للاسم الجديد.
    if (oldValue && newDisplayValue && oldValue !== newDisplayValue) {
      renameStudentEverywhere_(ss, teamId, oldValue, newDisplayValue);
      compactRosterSheetAllowEmpty_(sheet);
      generateUnifiedReportForTeamOnly(teamId, '');
      SpreadsheetApp.flush();
      try { ss.toast('تم تعديل الاسم مع حفظ البيانات: ' + oldValue + ' ← ' + newDisplayValue, 'تم', 5); } catch (_) {}
      return;
    }

    // حذف الاسم مباشرة = حذف نهائي من البيانات وإزالة الطالب من التقرير فوراً.
    if (oldValue && !newDisplayValue) {
      const deletedRows = deleteStudentEverywhere_(ss, teamId, oldValue);
      e.range.clearNote();
      compactRosterSheetAllowEmpty_(sheet);
      generateUnifiedReportForTeamOnly(teamId, '');
      SpreadsheetApp.flush();

      try {
        ss.toast(
          'تم حذف الطالب نهائياً: ' + oldValue + ' — سجلات البيانات المحذوفة: ' + deletedRows,
          'تم الحذف',
          6
        );
      } catch (_) {}
      return;
    }

    // إضافة اسم جديد.
    if (!oldValue && newDisplayValue) {
      e.range.clearNote();
      compactRosterSheetAllowEmpty_(sheet);
      generateUnifiedReportForTeamOnly(teamId, '');
      SpreadsheetApp.flush();
      return;
    }
  } catch (err) {
    Logger.log('handleRosterEdit ERROR: ' + err.message);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}


function rosterTeamIdFromSheetName_(sheetName) {
  const name = String(sheetName || '').trim();
  if (!name) return '';
  if (name === SHEET_LOG || name === SHEET_MONTHLY) return '';
  if (name.indexOf(UNIFIED_PREFIX) === 0) return '';
  if (name.indexOf(WEEKLY_PREFIX) === 0 || name.indexOf(FINAL_PREFIX) === 0) return '';

  return teamIdFromSheetName(name);
}

function compactRosterSheetAllowEmpty_(sheet) {
  formatRosterHeader(sheet);

  const firstCircle = isFirstCircleRosterSheet_(sheet);
  const headers = rosterHeadersForSheet_(sheet);
  const profiles = firstCircle
    ? readFirstCircleProfilesFromRosterSheet_(sheet)
    : readNamesFromRosterSheetRobust_(sheet).map(function(name) {
        return { name: name, track: '', trackLabel: '' };
      });

  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length)
    .clearContent()
    .clearNote();

  if (profiles.length) {
    const rows = firstCircle
      ? profiles.map(function(profile) { return [profile.name, profile.trackLabel]; })
      : profiles.map(function(profile) { return [profile.name]; });

    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    sheet.getRange(2, 1, rows.length, headers.length)
      .setHorizontalAlignment('right')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID);

    if (firstCircle) {
      sheet.getRange(2, FIRST_CIRCLE_TRACK_COL, rows.length, 1).setHorizontalAlignment('center');
    }
  }

  formatRosterHeader(sheet);
}

function purgeLogStudentsMissingFromRoster_(ss, teamId) {
  const rosterSheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);
  const activeNames = readNamesFromRosterSheetRobust_(rosterSheet);
  const activeKeys = {};
  activeNames.forEach(function(name) {
    activeKeys[normalizeStudentReportKey_(name)] = true;
  });

  const logSheet = getOrCreateLogSheet(ss);
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 0;

  const values = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  const rowsToDelete = [];

  values.forEach(function(row, index) {
    const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    if (rowTeam !== teamId) return;

    const studentName = String(row[COL.STUDENT - 1] || '').trim();
    if (!studentName) return;

    if (!activeKeys[normalizeStudentReportKey_(studentName)]) {
      rowsToDelete.push(index + 2);
    }
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    logSheet.deleteRow(rowNumber);
  });

  return rowsToDelete.length;
}


function renameStudentEverywhere_(ss, teamId, oldName, newName) {
  oldName = String(oldName || '').trim();
  newName = String(newName || '').trim();
  if (!oldName || !newName || oldName === newName) return 0;

  const logSheet = getOrCreateLogSheet(ss);
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  let changed = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const student = String(row[COL.STUDENT - 1] || '').trim();
    const rowTeam = normalizeTeamId(row[COL.TEAM - 1] || teamId);

    // توافق مع السجلات القديمة التي قد لا تحتوي على اسم الحلقة.
    if (student === oldName && (!rowTeam || rowTeam === teamId)) {
      const sheetRow = i + 2;
      logSheet.getRange(sheetRow, COL.STUDENT).setValue(newName);
      logSheet.getRange(sheetRow, COL.TEAM).setValue(TEAM_SHEETS[teamId] || row[COL.TEAM - 1] || '');
      changed++;
    }
  }

  // لو كان الاسم الجديد موجوداً سابقاً، ندمج أي سجلات مكررة لنفس التاريخ بدلاً من ضياع البيانات.
  mergeDuplicateLogRowsForStudent_(logSheet, teamId, newName);
  return changed;
}

function deleteStudentEverywhere_(ss, teamId, studentName) {
  studentName = String(studentName || '').trim();
  if (!studentName) return 0;

  const logSheet = getOrCreateLogSheet(ss);
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  let deleted = 0;

  // نحذف من الأسفل حتى لا تتغير أرقام الصفوف أثناء الحذف.
  for (let i = data.length - 1; i >= 0; i--) {
    const row = data[i];
    const student = String(row[COL.STUDENT - 1] || '').trim();
    const rowTeam = normalizeTeamId(row[COL.TEAM - 1] || teamId);

    if (student === studentName && (!rowTeam || rowTeam === teamId)) {
      logSheet.deleteRow(i + 2);
      deleted++;
    }
  }

  return deleted;
}

function mergeDuplicateLogRowsForStudent_(logSheet, teamId, studentName) {
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const groups = {};

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const dateStr = dateValueToString(row[COL.DATE - 1]);
    const student = String(row[COL.STUDENT - 1] || '').trim();
    const rowTeam = normalizeTeamId(row[COL.TEAM - 1] || teamId);

    if (!dateStr || student !== studentName || (rowTeam && rowTeam !== teamId)) continue;

    const key = dateStr + '|' + teamId + '|' + studentName;
    if (!groups[key]) groups[key] = [];
    groups[key].push({ rowNumber: i + 2, values: row, dateStr });
  }

  const rowsToDelete = [];
  let mergedCount = 0;

  Object.keys(groups).forEach(key => {
    const items = groups[key];
    if (items.length <= 1) return;

    items.sort((a, b) => a.rowNumber - b.rowNumber);
    const dateStr = items[0].dateStr;
    let mergedPayload = logRowToPayload(items[0].values, dateStr, studentName, teamId);

    for (let i = 1; i < items.length; i++) {
      const nextPayload = logRowToPayload(items[i].values, dateStr, studentName, teamId);
      mergedPayload = mergeStudentRenamePayload_(mergedPayload, nextPayload, dateStr, studentName, teamId);
      rowsToDelete.push(items[i].rowNumber);
    }

    const mergedRow = buildLogRow(dateStr, studentName, mergedPayload, teamId);
    const targetRow = items[0].rowNumber;
    logSheet.getRange(targetRow, COL.DATE).setNumberFormat('@');
    logSheet.getRange(targetRow, 1, 1, HEADERS.length).setValues([mergedRow]);
    formatLogDataRow(logSheet, targetRow);
    mergedCount += items.length - 1;
  });

  rowsToDelete.sort((a, b) => b - a).forEach(rowNumber => logSheet.deleteRow(rowNumber));
  return mergedCount;
}

function mergeStudentRenamePayload_(oldData, newData, dateStr, studentName, teamId) {
  const oldAuto = isAutoAbsencePayload_(oldData);
  const newAuto = isAutoAbsencePayload_(newData);

  if (oldAuto && !newAuto) return withRenamedStudent_(newData, dateStr, studentName, teamId);
  if (!oldAuto && newAuto) return withRenamedStudent_(oldData, dateStr, studentName, teamId);

  const hudur = mergeAttendance_(oldData.hudur, newData.hudur);
  const hifzScore = mergeScoreValue_(oldData.hifzScore, newData.hifzScore);
  const muraScore = mergeScoreValue_(oldData.muraScore, newData.muraScore);
  const haqiba = mergeYesNo_(oldData.haqiba, newData.haqiba);
  const istima = mergeYesNo_(oldData.istima, newData.istima);

  const merged = {
    studentName: studentName,
    teamId: teamId,
    teamName: getCompetitionUnitName_(teamId, ''),
    date: dateStr,
    hudur: hudur,
    hifzFrom: firstText(oldData.hifzFrom, newData.hifzFrom),
    hifzTo: lastText_(oldData.hifzTo, newData.hifzTo),
    hifzScore: hifzScore,
    muraFrom: firstText(oldData.muraFrom, newData.muraFrom),
    muraTo: lastText_(oldData.muraTo, newData.muraTo),
    muraScore: muraScore,
    haqiba: haqiba,
    istima: istima,
    notes: firstText(cleanAutoNote_(oldData.notes), cleanAutoNote_(newData.notes), 'تم دمج البيانات بعد تعديل اسم الطالب')
  };

  merged.totalPoints = totalFromPayload({}, hifzScore, muraScore, hudur, haqiba, istima);
  return merged;
}

function withRenamedStudent_(data, dateStr, studentName, teamId) {
  const out = Object.assign({}, data || {});
  out.studentName = studentName;
  out.teamId = teamId;
  out.teamName = TEAM_SHEETS[teamId] || out.teamName || '';
  out.date = dateStr || out.date || '';
  return out;
}

function isAutoAbsencePayload_(data) {
  const note = String((data && data.notes) || '').trim();
  const hudur = normalizeAttendance(data && data.hudur);
  const hifzScore = normalizeScore(data && data.hifzScore);
  const muraScore = normalizeScore(data && data.muraScore);
  const haqiba = normalizeYesNo(data && data.haqiba);
  const istima = normalizeYesNo(data && data.istima);

  return (
    hudur === 'غائب' &&
    !String((data && data.hifzFrom) || '').trim() &&
    !String((data && data.hifzTo) || '').trim() &&
    !String((data && data.muraFrom) || '').trim() &&
    !String((data && data.muraTo) || '').trim() &&
    (!hifzScore || hifzScore === 'لم يسمع') &&
    (!muraScore || muraScore === 'لم يسمع') &&
    (!haqiba || haqiba === 'لا') &&
    (!istima || istima === 'لا') &&
    note.indexOf('غياب تلقائي') !== -1
  );
}

function mergeAttendance_(a, b) {
  a = normalizeAttendance(a);
  b = normalizeAttendance(b);
  if (a === 'حاضر' || b === 'حاضر') return 'حاضر';
  if (a === 'غائب' || b === 'غائب') return 'غائب';
  return firstText(a, b);
}

function mergeYesNo_(a, b) {
  a = normalizeYesNo(a);
  b = normalizeYesNo(b);
  if (a === 'نعم' || b === 'نعم') return 'نعم';
  if (a === 'لا' || b === 'لا') return 'لا';
  return firstText(a, b);
}

function mergeScoreValue_(a, b) {
  a = normalizeScore(a);
  b = normalizeScore(b);
  const an = Number(a);
  const bn = Number(b);
  const aNum = Number.isFinite(an);
  const bNum = Number.isFinite(bn);

  if (aNum && bNum) return Math.max(an, bn);
  if (aNum) return an;
  if (bNum) return bn;
  return firstText(a, b);
}

function lastText_(a, b) {
  const bb = String(b || '').trim();
  if (bb) return bb;
  return String(a || '').trim();
}

function cleanAutoNote_(note) {
  const text = String(note || '').trim();
  if (!text || text.indexOf('غياب تلقائي') !== -1 || text.indexOf('لم يتم تسجيل بيانات') !== -1) return '';
  return text;
}


// ══════════════════════════════════════════════════════════════
//  تعديل تقرير الحلقة الموحد من داخل Google Sheets
//  الفكرة: التقرير للعرض، وورقة "البيانات" هي قاعدة البيانات.
//  لذلك أي تعديل في صف يوم داخل "تقرير حلقة ..." يرجع يتخزن في "البيانات"
//  ثم يعاد بناء تقرير الحلقة حتى تنحسب المجاميع والنسب.
// ══════════════════════════════════════════════════════════════
function handleUnifiedReportEdit(e) {
  const lock = LockService.getDocumentLock();

  try {
    if (!e || !e.range || !e.source) return;

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    // التقارير الموحدة أسماؤها مثل: "تقرير حلقة أولى"
    // ونستثني التقارير القديمة لأنها تبدأ بكلمة تقرير أيضاً.
    if (!sheetName.startsWith(UNIFIED_PREFIX)) return;
    if (sheetName.indexOf(WEEKLY_PREFIX) === 0 || sheetName.indexOf(FINAL_PREFIX) === 0) return;

    const teamSheetName = sheetName.replace(UNIFIED_PREFIX, '').trim();
    const teamId = teamIdFromSheetName(teamSheetName);
    if (!teamId) return;

    const editedRow = e.range.getRow();
    const editedCol = e.range.getColumn();
    const numRows = e.range.getNumRows();
    const numCols = e.range.getNumColumns();

    // الأعمدة المسموح تعديلها في صف اليوم:
    // B الحضور، C:D الحفظ، E نقاط الحفظ، F:G المراجعة، H نقاط المراجعة،
    // I الحقيبة، J الإستماع K النقاط، M الملاحظة.
    if (!rangeIntersectsUnifiedEditableColumns_(editedCol, numCols)) return;

    // نلتقط القيم التي عدّلها المستخدم من حدث onEdit نفسه.
    // في القوائم المنسدلة قد تكون قراءة الصف كاملة مباشرة بعد الاختيار ما زالت تُرجع
    // القيمة القديمة للحظات؛ لذلك e.value هو المصدر الأوثق للخلية الواحدة.
    const editedValues = getUnifiedEditedValuesFromEvent_(e);
    const updates = [];

    for (let r = editedRow; r < editedRow + numRows; r++) {
      if (r < 3) continue;

      const dayInfo = parseUnifiedDayLabel_(sheet.getRange(r, 1).getDisplayValue());
      if (!dayInfo || !dayInfo.dateStr) continue; // نتجاهل صف الطالب وصف الأسبوع

      const studentName = getStudentNameFromUnifiedRow_(sheet, r);
      if (!studentName || isInvalidUnifiedStudentName_(studentName)) continue;

      const rowValues = sheet.getRange(r, 1, 1, UNIFIED_HEADERS.length).getValues()[0];
      overlayUnifiedEditedValues_(
        rowValues,
        r - editedRow,
        editedCol,
        numCols,
        editedValues
      );
      const data = unifiedDayRowToPayload_(studentName, teamId, dayInfo.dateStr, rowValues, editedCol, numCols);

      updates.push({
        row: r,
        dateStr: dayInfo.dateStr,
        studentName,
        data
      });
    }

    if (!updates.length) return;

    // نمدد فترة الحماية مع كل تعديل؛ هذا يمنع إعادة بناء الشيت أثناء الاختيار.
    markReportEditingActive_();

    // نحمي الطالب/اليوم نفسه قبل انتظار القفل. أي عامل تقرير متأخر سيؤجل هذا السجل
    // بدلاً من إعادة القيمة القديمة (مثل 0) فوق اختيار المعلم (مثل 30).
    updates.forEach(function(item) {
      const overrides = buildManualReportOverridesFromPayload_(item.data, editedCol, numCols);
      markManualReportEntryProtected_(item.dateStr, teamId, item.studentName, overrides);
    });

    // عامل V7 والتعديل اليدوي يستخدمان DocumentLock نفسه. لا نكمل بلا قفل؛
    // لأن الاستمرار بعد انتهاء مهلة قصيرة كان يسمح لعامل قديم بإرجاع "نعم" إلى "لا".
    lock.waitLock(30000);

    const ss = e.source;
    const logSheet = getOrCreateLogSheet(ss);
    const weekRangesToRecalc = {};

    updates.forEach(item => {
      // لا نعيد كتابة الأعمدة B:J كلها؛ الخلية التي عدّلها المستخدم محفوظة أصلاً.
      // إعادة كتابة الصف كاملاً كانت سبب رجوع 30 إلى 0 أو نعم إلى لا عندما كانت
      // قراءة الصف قد التقطت القيمة القديمة قبل اكتمال تحديث القائمة المنسدلة.
      const currentAttendance = normalizeAttendance(
        sheet.getRange(item.row, 2).getValue()
      );
      if (item.data.hudur !== currentAttendance) {
        // يحدث فقط عند تحويل الغائب تلقائياً إلى حاضر بسبب وجود نشاط.
        sheet.getRange(item.row, 2).setValue(item.data.hudur);
      }

      // العمود K محسوب من القيم الجديدة، وM للملاحظة فقط.
      sheet.getRange(item.row, 11).setValue(item.data.totalPoints);
      sheet.getRange(item.row, 13).setValue(item.data.notes || '');

      appendStudentToRosterIfMissing(ss, teamId, item.studentName);

      let logRow = findLogRow(logSheet, item.dateStr, item.studentName, teamId);
      if (logRow > 0) {
        upsertLogRow(logSheet, logRow, item.data, teamId);
      } else {
        insertLogRow(logSheet, item.dateStr, item.studentName, item.data, teamId);
        // التعديل اليدوي نادر، لذلك قراءة رقم الصف مرة واحدة هنا مقبولة وتمنع فهرساً قديماً.
        logRow = findLogRow(logSheet, item.dateStr, item.studentName, teamId);
      }

      // هذا التعديل أصبح هو المصدر الأحدث. نحذف أي طلب قديم لنفس الطالب/اليوم
      // كي لا يأتي عامل V7 بعد ثوانٍ ويكتب القيمة السابقة فوقه.
      try {
        const props = PropertiesService.getScriptProperties();
        props.deleteProperty(v6ReportQueueKey_(item.dateStr, teamId, item.studentName));
        setV6IndexedEntry_(props, v6EntryIndexKey_(item.dateStr, teamId, item.studentName), {
          date: item.dateStr,
          teamId: teamId,
          studentName: item.studentName,
          row: logRow,
          total: item.data.totalPoints,
          reserved: false
        });
      } catch (_) {}

      // نعيد حساب ملخص أسبوع هذا الطالب فقط، ولا نلمس بقية التقرير.
      const weekRange = findUnifiedWeekRangeForDayRow_(sheet, item.row);
      if (weekRange) weekRangesToRecalc[weekRange.weekRow] = weekRange;
    });

    // نثبت قيمة القائمة المنسدلة والنقاط في الشيت قبل قراءة أيام الأسبوع للحساب.
    SpreadsheetApp.flush();

    Object.keys(weekRangesToRecalc).forEach(key => {
      const weekRange = weekRangesToRecalc[key];
      if (recalcUnifiedWeekRowFromDayRows_(sheet, weekRange) && ENABLE_CIRCLE_WEEKLY_SUMMARY) {
        const weekIndex = getUnifiedWeekIndexFromLabel_(sheet.getRange(weekRange.weekRow, 1).getDisplayValue());
        recalcCircleWeeklySummaryRows_(sheet, weekIndex);
      }
    });

    SpreadsheetApp.flush();

  } catch (err) {
    Logger.log('handleUnifiedReportEdit ERROR: ' + err.message);
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function rangeIntersectsUnifiedEditableColumns_(startCol, numCols) {
  const endCol = startCol + numCols - 1;
  for (let c = startCol; c <= endCol; c++) {
    if ((c >= 2 && c <= 11) || c === 13) return true;
  }
  return false;
}

function rangeIncludesColumn_(startCol, numCols, wantedCol) {
  return wantedCol >= startCol && wantedCol <= startCol + numCols - 1;
}

function getUnifiedEditedValuesFromEvent_(e) {
  const values = e && e.range ? e.range.getValues() : [[]];
  if (!e || !e.range) return values;

  // لخلية واحدة، e.value يحمل القيمة الجديدة المؤكدة من Google Sheets.
  // عند المسح لا توجد e.value، لذلك نأخذ القيمة الحالية من الخلية (غالباً فارغة).
  if (e.range.getNumRows() === 1 && e.range.getNumColumns() === 1) {
    const hasEventValue = Object.prototype.hasOwnProperty.call(e, 'value');
    values[0][0] = hasEventValue ? e.value : e.range.getValue();
  }
  return values;
}

function overlayUnifiedEditedValues_(rowValues, rowOffset, editedCol, numCols, editedValues) {
  if (!Array.isArray(rowValues)) return rowValues;
  const sourceRow = editedValues && editedValues[rowOffset];
  if (!sourceRow) return rowValues;

  for (let c = 0; c < numCols; c++) {
    const sheetCol = editedCol + c;
    if (sheetCol < 1 || sheetCol > UNIFIED_HEADERS.length) continue;
    rowValues[sheetCol - 1] = sourceRow[c];
  }
  return rowValues;
}

function parseUnifiedDayLabel_(value) {
  const text = String(value || '').trim();
  if (!text) return null;

  // مثال: الأحد — 7/5/2026
  const m = text.match(/^(الأحد|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)\s*[—–-]\s*(.+)$/);
  if (!m) return null;

  const dateStr = normalizeDate(m[2]);
  if (!dateStr || !parseDate(dateStr)) return null;

  return { day: m[1], dateStr };
}

function getStudentNameFromUnifiedRow_(sheet, row) {
  // صف اليوم تحته أسبوع، وفوق الأسبوع يوجد صف عناوين ثم صف الطالب.
  // نطلع للأعلى ونتجاهل صفوف الأيام والأسابيع والعناوين والملخصات حتى نصل لاسم طالب حقيقي.
  for (let r = row - 1; r >= 3; r--) {
    const text = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!text) continue;
    if (parseUnifiedDayLabel_(text)) continue;
    if (getUnifiedWeekIndexFromLabel_(text) > 0) continue;
    if (isCircleWeeklySummaryLabel_(text) || isCircleDailySummaryLabel_(text)) continue;
    if (isFirstCircleTrackSectionLabel_(text)) continue;
    if (isUnifiedTrackHeaderLabel_(text)) continue;
    if (isInvalidUnifiedStudentName_(text)) continue;

    const candidate = text.replace('👤', '').split('—')[0].trim();
    if (!candidate || isInvalidUnifiedStudentName_(candidate)) continue;
    return candidate;
  }
  return '';
}

function unifiedDayRowToPayload_(studentName, teamId, dateStr, rowValues, editedCol, numCols) {
  let hudur     = normalizeAttendance(rowValues[1]);
  const hifzFrom  = firstText(rowValues[2]);
  const hifzTo    = firstText(rowValues[3]);
  const hifzScore = normalizeScore(rowValues[4]);
  const muraFrom  = firstText(rowValues[5]);
  const muraTo    = firstText(rowValues[6]);
  const muraScore = normalizeScore(rowValues[7]);
  const haqiba    = normalizeYesNo(rowValues[8]);
  const istima    = normalizeYesNo(rowValues[9]);

  const hasActivity = hasUnifiedActivityData_(hifzFrom, hifzTo, hifzScore, muraFrom, muraTo, muraScore, haqiba, istima);
  const attendanceWasEdited = rangeIncludesColumn_(editedCol, numCols, 2);

  // إذا كان الطالب نزل غائب تلقائي، ثم المعلم عدّل الحفظ/المراجعة/الحقيبة/الإستماع أو الإستماع
  // نخليه حاضر تلقائياً حتى تنحسب النقاط بدون ما يضطر يغير الحضور يدوياً.
  if (!attendanceWasEdited && hasActivity && (!hudur || hudur === 'غائب')) {
    hudur = 'حاضر';
  }

  let totalPoints = totalFromUnifiedValues_(hifzScore, muraScore, hudur, haqiba, istima);

  // لو المعلم عدّل عمود "النقاط" نفسه فقط، نحترم الرقم المدخل.
  // أما إذا عدّل الحضور أو الحفظ أو المراجعة أو الحقيبة أو الإستماع، نعيد حساب النقاط تلقائياً.
  // هذا يمنع بقاء رقم قديم مثل 30 بعد تحويل الطالب إلى حاضر فقط.
  const onlyPointsWasEdited = editedCol === 11 && numCols === 1;
  if (onlyPointsWasEdited) {
    const manualTotal = Number(rowValues[10]);
    if (Number.isFinite(manualTotal)) totalPoints = manualTotal;
  }

  let notes = String(rowValues[12] || '').trim();
  if (hasActivity && (!notes || notes.indexOf('غياب تلقائي') !== -1 || notes.indexOf('لم يتم تسجيل بيانات') !== -1)) {
    notes = 'تم التعديل من تقرير الحلقة';
  } else if (!notes) {
    notes = 'تم التعديل من تقرير الحلقة';
  }

  return {
    studentName,
    teamId,
    teamName: getCompetitionUnitName_(teamId, ''),
    date: dateStr,
    hudur,
    hifzFrom,
    hifzTo,
    hifzScore,
    muraFrom,
    muraTo,
    muraScore,
    haqiba,
    istima,
    totalPoints,
    notes
  };
}

function hasUnifiedActivityData_(hifzFrom, hifzTo, hifzScore, muraFrom, muraTo, muraScore, haqiba, istima) {
  return !!(
    String(hifzFrom || '').trim() ||
    String(hifzTo || '').trim() ||
    String(hifzScore || '').trim() ||
    String(muraFrom || '').trim() ||
    String(muraTo || '').trim() ||
    String(muraScore || '').trim() ||
    normalizeYesNo(haqiba) === 'نعم' ||
    normalizeYesNo(istima) === 'نعم'
  );
}

function totalFromUnifiedValues_(hifzScore, muraScore, hudur, haqiba, istima) {
  // الغائب لا يأخذ نقاط، إلا إذا عدّل المعلم أي نشاط؛ وقتها نحوله "حاضر" تلقائياً أعلاه.
  if (hudur === 'غائب') return 0;

  let total = 0;
  total += scoreToNumber(hifzScore);
  total += scoreToNumber(muraScore);
  total += istima === 'نعم' ? 20 : 0;
  total += haqiba === 'نعم' ? 10 : 0;
  total += hudur === 'حاضر' ? 10 : 0;
  return total;
}

function applyUnifiedValidations(sheet, groupRanges) {
  const attendanceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(ATTENDANCE_OPTIONS, false)
    .setAllowInvalid(true)
    .build();

  const scoreRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(SCORE_OPTIONS, false)
    .setAllowInvalid(true)
    .build();

  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(YES_NO_OPTIONS, false)
    .setAllowInvalid(true)
    .build();

  groupRanges.forEach(g => {
    g.weeks.forEach(w => {
      const count = w.lastDay - w.firstDay + 1;
      if (count <= 0) return;

      sheet.getRange(w.firstDay, 2, count, 1).setDataValidation(attendanceRule);
      sheet.getRange(w.firstDay, 5, count, 1).setDataValidation(scoreRule);
      sheet.getRange(w.firstDay, 8, count, 1).setDataValidation(scoreRule);
      sheet.getRange(w.firstDay, 9, count, 1).setDataValidation(yesNoRule);
      sheet.getRange(w.firstDay, 10, count, 1).setDataValidation(yesNoRule);
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  التقرير الختامي — شيت مستقل لكل حلقة
// ══════════════════════════════════════════════════════════════
function deleteMonthlyReportSheet(ss) {
  const sheet = ss.getSheetByName(SHEET_MONTHLY);
  if (sheet) ss.deleteSheet(sheet);
}

// الإبقاء على اسم الدالة القديم للتوافق فقط: لا نبني تقرير شهري، بل نحذفه ونبني الختامي.
function generateMonthlyReport() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  deleteMonthlyReportSheet(ss);
  generateUnifiedReports();
}

function generateFinalReports() {
  // للتوافق مع الأزرار القديمة: نبني التقرير الموحد بدل التقرير الختامي المنفصل.
  generateUnifiedReports();
}

function readFinalReportData(logSheet, rosterMap) {
  const out = { namesByTeam: {}, weeksByKey: {} };
  Object.keys(TEAM_SHEETS).forEach(teamId => out.namesByTeam[teamId] = {});

  if (!logSheet || logSheet.getLastRow() <= 1) return out;

  const rows = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, HEADERS.length).getValues();

  rows.forEach(row => {
    const dateStr = dateValueToString(row[COL.DATE - 1]);
    const date = parseDate(dateStr);
    const student = String(row[COL.STUDENT - 1] || '').trim();
    let teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');

    if (!date || !student) return;
    if (!SESSION_DAYS.includes(date.getDay()) || isCanceledSessionDate(date)) return;
    if (!teamId) teamId = inferTeamIdForStudent(student, rosterMap);
    if (!teamId) return;

    out.namesByTeam[teamId][student] = true;

    const weekStart = getWeekStart(date);
    const weekEnd = addDays(weekStart, SESSION_DAYS[SESSION_DAYS.length - 1]);
    const weekKey = teamId + '|' + student + '|' + formatDate(weekStart);

    if (!out.weeksByKey[weekKey]) {
      out.weeksByKey[weekKey] = {
        teamId,
        student,
        start: weekStart,
        end: weekEnd,
        total: 0,
        present: 0,
        absent: 0,
        details: []
      };
    }

    const hudur = String(row[COL.HUDUR - 1] || '').trim();
    const points = Number(row[COL.TOTAL - 1]) || 0;
    const hifz = rangeScoreText(row[COL.HIFZ_FROM - 1], row[COL.HIFZ_TO - 1], row[COL.HIFZ_SCORE - 1]);
    const mura = rangeScoreText(row[COL.MURA_FROM - 1], row[COL.MURA_TO - 1], row[COL.MURA_SCORE - 1]);
    const note = String(row[COL.NOTE - 1] || '').trim();

    const week = out.weeksByKey[weekKey];
    week.total += points;
    if (hudur === 'غائب') week.absent++;
    else if (hudur === 'حاضر') week.present++;
    week.details.push({
      date,
      dateStr,
      day: DAY_NAMES_AR[date.getDay()],
      hudur,
      hifz,
      mura,
      points,
      note
    });
  });

  return out;
}

function rangeScoreText(fromValue, toValue, scoreValue) {
  const from = String(fromValue || '').trim();
  const to = String(toValue || '').trim();
  const score = String(scoreValue || '').trim();

  let text = '';
  if (from && to) text = from + ' → ' + to;
  else if (from) text = from;
  else if (to) text = to;

  if (score) text += text ? ' | التقدير: ' + score : 'التقدير: ' + score;
  return text;
}

function buildFinalReportForTeam(ss, teamId, rosterNames, finalData) {
  const teamName = TEAM_SHEETS[teamId];
  const sheetName = FINAL_PREFIX + teamName;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  sheet.setRightToLeft(true);
  ensureColumns(sheet, FINAL_HEADERS.length);

  try { sheet.showRows(1, sheet.getMaxRows()); } catch (e) {}
  clearRowGroups(sheet);
  clearFinalReportBody(sheet);

  sheet.getRange(1, 1, 1, FINAL_HEADERS.length).breakApart();
  sheet.getRange(1, 1, 1, FINAL_HEADERS.length)
    .merge()
    .setValue('📘 التقرير الختامي — ' + teamName + ' — كل طالب ثم تقييم الأسابيع ثم تفاصيل التسميع')
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#0f2027')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.getRange(2, 1, 1, FINAL_HEADERS.length)
    .setValues([FINAL_HEADERS])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(2);
  applyFinalWidths(sheet);

  const names = [];
  const seen = {};
  function addName(name) {
    name = String(name || '').trim();
    if (!name || seen[name]) return;
    seen[name] = true;
    names.push(name);
  }

  rosterNames.forEach(addName);
  Object.keys(finalData.namesByTeam[teamId] || {}).forEach(addName);

  const rows = [];
  const groupRanges = [];
  let sheetRow = 3;

  names.forEach(studentName => {
    const weeks = Object.keys(finalData.weeksByKey)
      .map(key => finalData.weeksByKey[key])
      .filter(w => w.teamId === teamId && w.student === studentName)
      .sort((a, b) => a.start - b.start);

    const studentTotal = weeks.reduce((sum, w) => sum + (Number(w.total) || 0), 0);
    const target = weeks.length ? weeks.length * WEEKLY_TARGET : WEEKLY_TARGET;
    const studentPercent = target ? studentTotal / target : 0;

    const studentRow = sheetRow;
    rows.push([studentName, 'كل الأسابيع', '', '', '', studentTotal, studentPercent]);
    sheetRow++;

    const studentGroup = { student: studentRow, first: sheetRow, last: sheetRow - 1, weeks: [] };

    weeks.forEach((week, idx) => {
      const weekRow = sheetRow;
      const weekPercent = WEEKLY_TARGET ? week.total / WEEKLY_TARGET : 0;
      rows.push([
        'الأسبوع ' + (idx + 1),
        formatDate(week.start) + ' - ' + formatDate(week.end),
        'حضور: ' + week.present + ' / غياب: ' + week.absent,
        '',
        '',
        week.total,
        weekPercent
      ]);
      sheetRow++;

      const firstDetail = sheetRow;

      // نعرض كل أيام الأسبوع المحسوبة، حتى لو ما لها سجل في ورقة البيانات.
      // الأيام بدون تسجيل تظهر كصف مستقل حتى يكون التقرير الختامي كامل.
      const detailsByDate = {};
      (week.details || []).forEach(detail => {
        if (detail && detail.dateStr) detailsByDate[detail.dateStr] = detail;
      });

      for (let d = 0; d < SESSION_DAYS.length; d++) {
        const dayDate = addDays(week.start, SESSION_DAYS[d]);
        if (isCanceledSessionDate(dayDate)) continue;
        const dateStr = formatDate(dayDate);
        const detail = detailsByDate[dateStr] || {
          day: DAY_NAMES_AR[dayDate.getDay()],
          dateStr,
          hudur: '',
          hifz: '',
          mura: '',
          points: 0,
          note: 'لم يتم تسجيل بيانات'
        };

        rows.push([
          detail.day,
          detail.dateStr,
          detail.hudur,
          detail.hifz,
          detail.mura,
          detail.points,
          detail.note
        ]);
        sheetRow++;
      }

      const lastDetail = sheetRow - 1;
      studentGroup.weeks.push({ weekRow, firstDetail, lastDetail });
      studentGroup.last = Math.max(studentGroup.last, lastDetail);
    });

    groupRanges.push(studentGroup);
  });

  if (rows.length) {
    sheet.getRange(3, 1, rows.length, FINAL_HEADERS.length).setValues(rows);
    formatFinalReportBody(sheet, rows.length, groupRanges);
    applyFinalReportGroups(sheet, groupRanges);
  }

  sheet.autoResizeRows(1, Math.max(sheet.getLastRow(), 1));
  trimUnifiedReportSheet_(sheet, 2 + allRows.length);
}

function clearFinalReportBody(sheet) {
  const lastRow = sheet.getMaxRows();
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, Math.max(sheet.getMaxColumns(), FINAL_HEADERS.length))
      .clearContent()
      .clearFormat()
      .clearDataValidations()
      .breakApart();
  }
}

function formatFinalReportBody(sheet, rowCount, groupRanges) {
  if (rowCount <= 0) return;
  sheet.getRange(3, 1, rowCount, FINAL_HEADERS.length)
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#d9e2f3', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);

  groupRanges.forEach(g => {
    sheet.getRange(g.student, 1, 1, 5).merge()
      .setBackground('#1e3a5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('right');
    sheet.getRange(g.student, 6, 1, 2)
      .setBackground('#1e3a5f')
      .setFontColor('#fde047')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    sheet.getRange(g.student, 7).setNumberFormat('0%');

    g.weeks.forEach(w => {
      sheet.getRange(w.weekRow, 1, 1, 5).setBackground('#e8f5e9').setFontWeight('bold');
      sheet.getRange(w.weekRow, 6, 1, 2).setBackground('#e8f5e9').setFontWeight('bold');
      sheet.getRange(w.weekRow, 7).setNumberFormat('0%');

      const count = w.lastDetail - w.firstDetail + 1;
      if (count > 0) {
        sheet.getRange(w.firstDetail, 1, count, FINAL_HEADERS.length).setBackground('#f8fbff');
      }
    });
  });

  sheet.getRange(3, 6, rowCount, 1).setNumberFormat('0');
  sheet.setRowHeights(3, rowCount, 34);
}

function applyFinalReportGroups(sheet, groupRanges) {
  try {
    sheet.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
  } catch (e) {}

  groupRanges.forEach(g => {
    if (g.last >= g.first) {
      try {
        sheet.getRange(g.first, 1, g.last - g.first + 1, 1).shiftRowGroupDepth(1);
      } catch (e) {
        Logger.log('Final student group skipped: ' + e.message);
      }
    }
  });

  groupRanges.forEach(g => {
    g.weeks.forEach(w => {
      const count = w.lastDetail - w.firstDetail + 1;
      if (count > 0) {
        try {
          sheet.getRange(w.firstDetail, 1, count, 1).shiftRowGroupDepth(1);
        } catch (e) {
          Logger.log('Final week detail group skipped: ' + e.message);
        }
      }
    });
  });

  groupRanges.forEach(g => {
    g.weeks.forEach(w => {
      try {
        const detailGroup = sheet.getRowGroup(w.firstDetail, 2);
        if (detailGroup) detailGroup.collapse();
      } catch (e) {}
    });
    try {
      const studentGroup = sheet.getRowGroup(g.first, 1);
      if (studentGroup) studentGroup.collapse();
    } catch (e) {}
  });
}

function applyFinalWidths(sheet) {
  const widths = [160, 130, 110, 260, 260, 90, 160];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}


// ══════════════════════════════════════════════════════════════
//  التقرير الموحد — شيت واحد لكل حلقة: الطالب > الأسابيع > الأيام
// ══════════════════════════════════════════════════════════════
function generateUnifiedReportForTeamOnly(teamId, baseDateValue) {
  // يبني تقرير حلقة واحدة فقط.
  // لا يحذف التقارير القديمة هنا حتى لا يبطّئ حفظ بيانات الأدمن.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  deleteMonthlyReportSheet(ss);

  const normalizedTeamId = normalizeTeamId(teamId);
  if (!normalizedTeamId) throw new Error('teamId غير صحيح عند بناء التقرير الموحد');

  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);
  const courseStart = getCourseStartDate(logSheet, baseDateValue);

  buildUnifiedReportForTeam(ss, normalizedTeamId, rosterMap[normalizedTeamId] || [], logMaps, courseStart);
}

function generateUnifiedReports(baseDateValue) {
  // نسخة آمنة من انتهاء الوقت:
  // لا تبني كل تقارير الحلقات دفعة واحدة لأن Apps Script يوقف التنفيذ بعد ~6 دقائق.
  // هذه الدالة تضع كل الحلقات في قائمة التحديث ثم تبني حلقة واحدة فقط في كل تشغيل.
  // لتحديث الباقي شغل runOneQueuedReportNow أكثر من مرة، أو اترك التريجر يحدثها بالخلفية.
  markReportsDirty(dateValueToString(baseDateValue || ''), '');
  createFastReportsTrigger();
  return refreshReportsIfDirty();
}

function generateAllUnifiedReportsUnsafe(baseDateValue) {
  // احتياطي فقط: يبني كل التقارير دفعة واحدة وقد ينتهي بالـ timeout إذا البيانات كثيرة.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  deleteMonthlyReportSheet(ss);
  deleteSeparateReportSheets(ss);

  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);
  const courseStart = getCourseStartDate(logSheet, baseDateValue);

  Object.keys(TEAM_SHEETS).forEach(teamId => {
    buildUnifiedReportForTeam(ss, teamId, rosterMap[teamId] || [], logMaps, courseStart);
  });
}

function isDateWithinCourseWindow(courseStart, dateObj) {
  if (!courseStart || !dateObj) return false;

  const start = startOfDay(courseStart);
  const configuredEnd = parseDate(COURSE_END_DATE);
  const end = configuredEnd
    ? startOfDay(configuredEnd)
    : addDays(start, 18);

  end.setHours(23, 59, 59, 999);
  return dateObj >= start && dateObj <= end;
}

function getCourseStartDate(logSheet, baseDateValue) {
  void logSheet;
  void baseDateValue;

  const configured = parseDate(COURSE_START_DATE);
  if (configured) return startOfDay(configured);

  return startOfDay(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
}

function deleteSeparateReportSheets(ss) {
  // يحذف التقارير القديمة المنفصلة فقط، ويبقي شيت البيانات وأوراق الحلقات والتقرير الموحد.
  const namesToDelete = [];
  ss.getSheets().forEach(sheet => {
    const name = sheet.getName();
    if (name === SHEET_MONTHLY || name.indexOf(WEEKLY_PREFIX) === 0 || name.indexOf(FINAL_PREFIX) === 0) {
      namesToDelete.push(name);
    }
  });

  namesToDelete.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && ss.getSheets().length > 1) ss.deleteSheet(sheet);
  });
}

function safeBreakApartMergedCells(sheet) {
  // مهم: لو التقرير القديم فيه خلايا مدمجة، لازم نفك الدمج من كامل الشيت
  // وليس من نطاق صغير، وإلا يظهر خطأ:
  // You must select all cells in a merged range to merge or unmerge them.
  try {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart();
  } catch (err) {
    Logger.log('safeBreakApartMergedCells skipped: ' + err.message);
  }
}

function getFirstCircleTrackSectionMeta_(track) {
  void track;
  return { track: '', label: '', icon: '', theme: null };
}

// رأس صف الأسبوع بدون كلمة «الإستماع» (العمود يبقى ويعمل بشكل طبيعي، فقط بدون التسمية).
function getBehaviorLabelForWeek_(weekNumber) {
  return '';
}

function getCourseWeekNumberForDate_(dateObj) {
  if (!dateObj) return 1;

  const start = parseDate(COURSE_START_DATE);
  if (!start) return 1;

  const target = normalizeDate(formatDate(dateObj));
  for (let week = 1; week <= COURSE_WEEKS_COUNT; week++) {
    const dates = getUnifiedWeekDates_(start, week);
    for (let i = 0; i < dates.length; i++) {
      if (normalizeDate(formatDate(dates[i])) === target) return week;
    }
  }

  if (dateObj < start) return 1;
  return COURSE_WEEKS_COUNT;
}

function getBehaviorCombinedHeader_() {
  return 'الإستماع';
}

function getUnifiedTopHeadersForTeam_(teamId) {
  void teamId;
  return UNIFIED_HEADERS.slice();
}

function getUnifiedHeadersForTrack_(track) {
  void track;
  return UNIFIED_HEADERS.slice();
}

function isFirstCircleTrackSectionLabel_(value) {
  return String(value || '').trim().indexOf(FIRST_CIRCLE_SECTION_PREFIX) === 0;
}

function isUnifiedTrackHeaderLabel_(value) {
  const key = normalizeHeaderText_(value);
  const labels = [
    'اليوم / التاريخ',
    'اليوم والتاريخ',
    'اسم الطالب / الأسبوع / اليوم',
    'اسم الطالب / الاسبوع / اليوم',
    'اسم الطالب/الأسبوع/اليوم',
    UNIFIED_HEADERS && UNIFIED_HEADERS.length ? UNIFIED_HEADERS[0] : ''
  ];
  return labels.some(function(label) {
    return label && key === normalizeHeaderText_(label);
  });
}

function isInvalidUnifiedStudentName_(value) {
  const text = String(value || '').trim();
  if (!text) return true;

  if (isUnifiedTrackHeaderLabel_(text)) return true;
  if (isFirstCircleTrackSectionLabel_(text)) return true;
  if (isCircleWeeklySummaryLabel_(text) || isCircleDailySummaryLabel_(text)) return true;
  if (parseUnifiedDayLabel_(text)) return true;
  if (getUnifiedWeekIndexFromLabel_(text) > 0) return true;

  const key = normalizeHeaderText_(text);
  const reserved = [
    'اسم الطالب',
    'اسم الطالب الأسبوع اليوم',
    'اسم الطالب / الأسبوع / اليوم',
    'اليوم / التاريخ',
    'اليوم والتاريخ',
    'الحضور',
    'الحفظ من',
    'المراجعة من',
    'النقاط',
    'الأصل',
    'النسبة / ملاحظة'
  ].map(normalizeHeaderText_);

  return reserved.indexOf(key) !== -1;
}

function buildFirstCircleTrackBuckets_(names, firstCircleTrackByStudent) {
  void firstCircleTrackByStudent;
  return [{
    meta: { track: '', label: '', icon: '', theme: null },
    students: (names || []).map(function(name) {
      return { name: name, track: '', trackLabel: '' };
    })
  }];
}

function buildUnifiedReportForTeam(ss, teamId, rosterNames, logMaps, courseStart) {
  const teamName = TEAM_SHEETS[teamId];
  const sheetName = UNIFIED_PREFIX + teamName;
  const firstCircleTrackByStudent = {};
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  sheet.setRightToLeft(true);
  ensureColumns(sheet, UNIFIED_HEADERS.length);

  try { sheet.showRows(1, sheet.getMaxRows()); } catch (e) {}
  safeBreakApartMergedCells(sheet);
  clearRowGroups(sheet);
  clearUnifiedReportBody(sheet);

  const titleText = '📘 ' + sheetName + ' — تظهر أسماء الطلاب فقط، وافتح + لعرض الأسابيع ثم الأيام';

  sheet.getRange(1, 1, 1, UNIFIED_HEADERS.length)
    .merge()
    .setValue(titleText)
    .setFontWeight('bold')
    .setFontSize(13)
    .setBackground('#0f2027')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.getRange(2, 1, 1, UNIFIED_HEADERS.length)
    .setValues([getUnifiedTopHeadersForTeam_(teamId)])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  sheet.setFrozenRows(2);
  applyUnifiedWidths(sheet, teamId);

  const names = [];
  const seen = {};
  function addName(name) {
    name = String(name || '').trim();
    const key = normalizeHeaderText_(name);
    if (!name || !key || seen[key]) return;
    seen[key] = true;
    names.push(name);
  }

  // قائمة الحلقة هي المصدر الوحيد لأسماء الطلاب الظاهرة في التقرير.
  // وجود سجل قديم في "البيانات" وحده لا يعيد الطالب إذا حُذف من شيت الحلقة.
  rosterNames.forEach(addName);

  const rows = [];
  const circleWeeklyTotals = {};
  for (let w = 1; w <= COURSE_WEEKS_COUNT; w++) {
    circleWeeklyTotals[w] = {
      total: 0, target: 0, students: 0,
      present: 0, hifzScore: 0, muraScore: 0,
      haqibaCount: 0, istimaCount: 0,
      days: {}
    };
  }

  const firstStudentRow = 3;
  const groupRanges = [];
  const trackSections = [];
  let sheetRow = firstStudentRow;

  const buckets = [{
    meta: { track: '', label: '', icon: '', theme: null },
    students: names.map(function(name) { return { name: name, track: '', trackLabel: '' }; })
  }];

  buckets.forEach(function(bucket) {
    if (false) {
      const sectionRow = sheetRow;
      const count = bucket.students.length;
      rows.push([
        FIRST_CIRCLE_SECTION_PREFIX + bucket.meta.icon + ' ' + bucket.meta.label + ' — ' + count + ' طالب',
        '', '', '', '', '', '', '', '', '', '', '', ''
      ]);
      trackSections.push({
        row: sectionRow,
        track: bucket.meta.track,
        theme: bucket.meta.theme,
        label: bucket.meta.label
      });
      sheetRow++;
    }

    bucket.students.forEach(function(studentProfile) {
      const studentName = studentProfile.name;
      const studentTrack = '';
      const studentTrackMeta = { track: '', label: '', theme: null };
      const studentDisplayName = studentName;
      const studentRow = sheetRow;
      const studentWeeks = [];

      for (let w = 0; w < COURSE_WEEKS_COUNT; w++) {
        const weekNumber = w + 1;
        const weekDates = getUnifiedWeekDates_(courseStart, weekNumber);
        const normalWeekStart = addDays(courseStart, w * 7);
        const weekStart = weekDates.length ? weekDates[0] : normalWeekStart;
        const weekEnd = weekDates.length ? weekDates[weekDates.length - 1] : addDays(normalWeekStart, 3);
        const dayDetails = [];

        for (let i = 0; i < weekDates.length; i++) {
          const dayDate = weekDates[i];
          const dateStr = formatDate(dayDate);
          const exactKey = dateStr + '|' + teamId + '|' + studentName;
          const normalizedKey = dateStr + '|' + teamId + '|' + normalizeStudentReportKey_(studentName);
          const saved = logMaps.byKey[exactKey]
            || (logMaps.byNormalizedKey ? logMaps.byNormalizedKey[normalizedKey] : null)
            || null;
          dayDetails.push(makeUnifiedDayDetail(dayDate, dateStr, saved));
        }

        const summary = summarizeUnifiedWeek(dayDetails);
        summary.index = weekNumber;
        summary.start = weekStart;
        summary.end = weekEnd;
        summary.details = dayDetails;
        studentWeeks.push(summary);
      }

      const specialTrack = false;
      const studentSummary = summarizeUnifiedStudentWeeks_(studentWeeks, specialTrack);
      rows.push([
        studentDisplayName,
        studentSummary.present + ' يوم',
        studentSummary.hifzFrom,
        studentSummary.hifzTo,
        studentSummary.hifzScore,
        studentSummary.muraFrom,
        studentSummary.muraTo,
        studentSummary.muraScore,
        studentSummary.haqibaCount,
        studentSummary.behaviorText,
        studentSummary.total,
        studentSummary.target,
        studentSummary.ratio
      ]);
      sheetRow++;

      const trackHeaderRow = sheetRow;
      rows.push(UNIFIED_HEADERS.slice());
      sheetRow++;

      const studentGroup = {
        student: studentRow,
        trackHeader: trackHeaderRow,
        first: trackHeaderRow,
        last: trackHeaderRow,
        track: studentTrack,
        weeks: []
      };

      studentWeeks.forEach(function(week) {
        if (!circleWeeklyTotals[week.index]) {
          circleWeeklyTotals[week.index] = {
            total: 0, target: 0, students: 0,
            present: 0, hifzScore: 0, muraScore: 0,
            haqibaCount: 0, istimaCount: 0,
            days: {}
          };
        }
        circleWeeklyTotals[week.index].total += Number(week.total) || 0;
        circleWeeklyTotals[week.index].target += Number(week.target) || 0;
        circleWeeklyTotals[week.index].students += 1;
        circleWeeklyTotals[week.index].present += Number(week.present) || 0;
        circleWeeklyTotals[week.index].hifzScore += Number(week.hifzScore) || 0;
        circleWeeklyTotals[week.index].muraScore += Number(week.muraScore) || 0;
        circleWeeklyTotals[week.index].haqibaCount += Number(week.haqibaCount) || 0;
        circleWeeklyTotals[week.index].istimaCount += Number(week.istimaCount) || 0;

        // نجمع نقاط الحلقة لكل يوم داخل الأسبوع عبر جميع الطلاب.
        (week.details || []).forEach(function(detail) {
          const dateKey = normalizeDate(detail.dateStr || '') || String(detail.dateStr || '').trim();
          if (!dateKey) return;
          if (!circleWeeklyTotals[week.index].days) circleWeeklyTotals[week.index].days = {};
          if (!circleWeeklyTotals[week.index].days[dateKey]) {
            circleWeeklyTotals[week.index].days[dateKey] = {
              day: detail.day || '',
              dateStr: detail.dateStr || dateKey,
              total: 0,
              target: 0
            };
          }
          circleWeeklyTotals[week.index].days[dateKey].total += Number(detail.points) || 0;
          circleWeeklyTotals[week.index].days[dateKey].target += Number(detail.target) || 0;
        });

        const weekRow = sheetRow;
        const weekBehaviorLabel = getBehaviorLabelForWeek_(week.index);
        rows.push([
          'الأسبوع ' + week.index + (weekBehaviorLabel ? ' — ' + weekBehaviorLabel : ''),
          week.present + ' يوم حضور / ' + week.absent + ' غياب',
          week.hifzFrom,
          week.hifzTo,
          week.hifzScore,
          specialTrack ? '' : week.muraFrom,
          specialTrack ? '' : week.muraTo,
          specialTrack ? '' : week.muraScore,
          week.haqibaCount,
          week.istimaCount,
          week.total,
          week.target,
          week.target ? week.total / week.target : 0
        ]);
        sheetRow++;

        const firstDay = sheetRow;
        week.details.forEach(function(detail) {
          rows.push([
            detail.day + ' — ' + detail.dateStr,
            detail.hudur,
            detail.hifzFrom,
            detail.hifzTo,
            detail.hifzScore,
            specialTrack ? '' : detail.muraFrom,
            specialTrack ? '' : detail.muraTo,
            specialTrack ? '' : detail.muraScore,
            detail.haqiba,
            detail.istima,
            detail.points,
            detail.target,
            detail.note
          ]);
          sheetRow++;
        });
        const lastDay = sheetRow - 1;
        studentGroup.weeks.push({ weekRow: weekRow, firstDay: firstDay, lastDay: lastDay });
        studentGroup.last = Math.max(studentGroup.last, lastDay);
      });

      groupRanges.push(studentGroup);
    });
  });

  const summaryRows = ENABLE_CIRCLE_WEEKLY_SUMMARY
    ? buildCircleWeeklySummaryRows_(circleWeeklyTotals)
    : [];
  const summaryStartRow = 3 + rows.length;
  const allRows = rows.concat(summaryRows);

  if (allRows.length) {
    sheet.getRange(3, 1, allRows.length, UNIFIED_HEADERS.length).setValues(allRows);
    formatUnifiedReportBody(sheet, allRows.length, groupRanges, trackSections);
    formatCircleWeeklySummaryRows_(sheet, summaryStartRow, summaryRows.length);
    applyUnifiedValidations(sheet, groupRanges);
    applyUnifiedReportGroups(sheet, groupRanges);
  }

  sheet.autoResizeRows(1, Math.max(sheet.getLastRow(), 1));
}

function buildCircleWeeklySummaryRows_(circleWeeklyTotals) {
  if (!ENABLE_CIRCLE_WEEKLY_SUMMARY) return [];
  const rows = [];
  for (let w = 1; w <= COURSE_WEEKS_COUNT; w++) {
    const item = circleWeeklyTotals[w] || {};
    const total = Number(item.total) || 0;

    // صف عنوان الأسبوع ومجموع النقاط التي حصلت عليها الحلقة خلاله.
    rows.push([
      CIRCLE_WEEKLY_SUMMARY_PREFIX + w,
      '', '', '', '', '', '', '', '', '',
      total,
      '',
      ''
    ]);

    // تحت كل أسبوع تظهر أيامه ومجموع نقاط الحلقة في كل يوم فقط.
    const dayItems = Object.keys(item.days || {}).map(function(key) {
      return item.days[key];
    }).sort(function(a, b) {
      const da = parseDate(normalizeDate(a.dateStr || ''));
      const db = parseDate(normalizeDate(b.dateStr || ''));
      return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
    });

    dayItems.forEach(function(dayItem) {
      rows.push([
        CIRCLE_DAILY_SUMMARY_PREFIX + (dayItem.day || '') + ' — ' + (dayItem.dateStr || ''),
        '', '', '', '', '', '', '', '', '',
        Number(dayItem.total) || 0,
        '',
        ''
      ]);
    });
  }
  return rows;
}

function formatCircleWeeklySummaryRows_(sheet, startRow, count) {
  if (!sheet || !count || count <= 0) return;
  const range = sheet.getRange(startRow, 1, count, UNIFIED_HEADERS.length);
  range
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  const labels = sheet.getRange(startRow, 1, count, 1).getDisplayValues();
  labels.forEach(function(row, index) {
    const rowNumber = startRow + index;
    const label = String(row[0] || '').trim();
    const rowRange = sheet.getRange(rowNumber, 1, 1, UNIFIED_HEADERS.length);

    if (isCircleWeeklySummaryLabel_(label)) {
      rowRange
        .setBackground('#fff7ed')
        .setFontWeight('bold')
        .setFontColor('#7c2d12');
      try { sheet.setRowHeight(rowNumber, 36); } catch (e) {}
      return;
    }

    if (isCircleDailySummaryLabel_(label)) {
      rowRange
        .setBackground('#ecfeff')
        .setFontWeight('bold')
        .setFontColor('#0f766e');
      sheet.getRange(rowNumber, 1).setHorizontalAlignment('right');
      try { sheet.setRowHeight(rowNumber, 31); } catch (e) {}
    }
  });

  // عمود K هو مجموع النقاط الفعلي للحلقة.
  sheet.getRange(startRow, 11, count, 1).setNumberFormat('0');
}

function isCircleDailySummaryLabel_(value) {
  return String(value || '').trim().indexOf(CIRCLE_DAILY_SUMMARY_PREFIX) === 0;
}

function parseCircleDailySummaryLabel_(value) {
  const text = String(value || '').trim();
  if (!isCircleDailySummaryLabel_(text)) return null;
  const rest = text.slice(CIRCLE_DAILY_SUMMARY_PREFIX.length).trim();
  const match = rest.match(/^(.*?)\s*[—–-]\s*(.+)$/);
  if (!match) return null;
  const dateStr = normalizeDate(match[2]);
  if (!dateStr) return null;
  return { day: String(match[1] || '').trim(), dateStr: dateStr };
}

function findCircleDailySummaryRow_(sheet, dateStr) {
  if (!sheet || !dateStr) return 0;
  const normalizedDate = normalizeDate(dateStr);
  const lastRow = sheet.getLastRow();
  if (!normalizedDate || lastRow < 3) return 0;
  const labels = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
  for (let i = 0; i < labels.length; i++) {
    const parsed = parseCircleDailySummaryLabel_(labels[i][0]);
    if (parsed && parsed.dateStr === normalizedDate) return i + 3;
  }
  return 0;
}

function getUnifiedWeekIndexFromLabel_(value) {
  const text = String(value || '').replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).trim();
  const m = text.match(/^الأسبوع\s+(\d+)/);
  return m ? Number(m[1]) || 0 : 0;
}

function extractFirstNumber_(value) {
  const text = String(value || '')
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[٬,]/g, '');
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) || 0 : 0;
}

function isCircleWeeklySummaryLabel_(value) {
  return String(value || '').trim().indexOf(CIRCLE_WEEKLY_SUMMARY_PREFIX) === 0;
}

function findCircleWeeklySummaryRow_(sheet, weekIndex) {
  if (!sheet || !weekIndex) return 0;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;
  const labels = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
  const wanted = CIRCLE_WEEKLY_SUMMARY_PREFIX + weekIndex;
  for (let i = 0; i < labels.length; i++) {
    if (String(labels[i][0] || '').trim() === wanted) return i + 3;
  }
  return 0;
}

function hasCircleWeeklySummaryRows_(sheet) {
  if (!ENABLE_CIRCLE_WEEKLY_SUMMARY) return true;
  if (!sheet) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return false;
  const count = Math.max(0, lastRow - 2);
  if (count <= 0) return false;
  const labels = sheet.getRange(3, 1, count, 1).getDisplayValues();
  const hasWeek = labels.some(function(row) { return isCircleWeeklySummaryLabel_(row[0]); });
  const hasDay = labels.some(function(row) { return isCircleDailySummaryLabel_(row[0]); });
  return hasWeek && hasDay;
}

function recalcCircleWeeklySummaryRows_(sheet, onlyWeekIndex) {
  if (!ENABLE_CIRCLE_WEEKLY_SUMMARY) return 0;
  if (!sheet) return 0;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return 0;

  const data = sheet.getRange(3, 1, lastRow - 2, UNIFIED_HEADERS.length).getValues();
  const totals = {};
  for (let w = 1; w <= COURSE_WEEKS_COUNT; w++) {
    totals[w] = {
      total: 0, target: 0, students: 0,
      present: 0, hifzScore: 0, muraScore: 0,
      haqibaCount: 0, istimaCount: 0,
      days: {}
    };
  }

  let activeWeekIndex = 0;
  data.forEach(function(row) {
    const label = String(row[0] || '').trim();
    if (!label) return;

    if (isCircleWeeklySummaryLabel_(label) || isCircleDailySummaryLabel_(label)) {
      activeWeekIndex = 0;
      return;
    }

    const weekIndex = getUnifiedWeekIndexFromLabel_(label);
    if (weekIndex) {
      activeWeekIndex = weekIndex;
      if (onlyWeekIndex && weekIndex !== Number(onlyWeekIndex)) return;
      if (!totals[weekIndex]) {
        totals[weekIndex] = {
          total: 0, target: 0, students: 0,
          present: 0, hifzScore: 0, muraScore: 0,
          haqibaCount: 0, istimaCount: 0,
          days: {}
        };
      }

      totals[weekIndex].present += extractFirstNumber_(row[1]);
      totals[weekIndex].hifzScore += Number(row[4]) || 0;
      totals[weekIndex].muraScore += Number(row[7]) || 0;
      totals[weekIndex].haqibaCount += Number(row[8]) || 0;
      totals[weekIndex].istimaCount += Number(row[9]) || 0;
      totals[weekIndex].total += Number(row[10]) || 0;
      totals[weekIndex].target += Number(row[11]) || 0;
      totals[weekIndex].students += 1;
      return;
    }

    const dayInfo = parseUnifiedDayLabel_(label);
    if (dayInfo && activeWeekIndex) {
      if (onlyWeekIndex && activeWeekIndex !== Number(onlyWeekIndex)) return;
      const dayKey = dayInfo.dateStr;
      if (!totals[activeWeekIndex].days[dayKey]) {
        totals[activeWeekIndex].days[dayKey] = {
          day: dayInfo.day,
          dateStr: dayInfo.dateStr,
          total: 0,
          target: 0
        };
      }
      totals[activeWeekIndex].days[dayKey].total += Number(row[10]) || 0;
      totals[activeWeekIndex].days[dayKey].target += Number(row[11]) || 0;
      return;
    }

    // صف طالب أو رأس مسار؛ لا نربطه بالأسبوع السابق.
    activeWeekIndex = 0;
  });

  let updated = 0;
  const weeks = onlyWeekIndex
    ? [Number(onlyWeekIndex)]
    : Object.keys(totals).map(Number).sort(function(a, b) { return a - b; });

  weeks.forEach(function(weekIndex) {
    if (!weekIndex) return;
    const summaryRow = findCircleWeeklySummaryRow_(sheet, weekIndex);
    if (!summaryRow) return;

    const item = totals[weekIndex] || {};
    const total = Number(item.total) || 0;

    // في ملخص الحلقة نعرض مجموع النقاط فقط، بدون إعادة إظهار مؤشرات أخرى.
    sheet.getRange(summaryRow, 2, 1, UNIFIED_HEADERS.length - 1).clearContent();
    sheet.getRange(summaryRow, 11).setValue(total).setNumberFormat('0');
    updated++;

    Object.keys(item.days || {}).forEach(function(dateKey) {
      const dayItem = item.days[dateKey] || {};
      const dayRow = findCircleDailySummaryRow_(sheet, dateKey);
      if (!dayRow) return;
      sheet.getRange(dayRow, 2, 1, UNIFIED_HEADERS.length - 1).clearContent();
      sheet.getRange(dayRow, 11).setValue(Number(dayItem.total) || 0).setNumberFormat('0');
      updated++;
    });
  });
  return updated;
}

function makeUnifiedDayDetail(dayDate, dateStr, row) {
  if (!row) {
    return {
      day: DAY_NAMES_AR[dayDate.getDay()],
      dateStr,
      hudur: '',
      hifzFrom: '',
      hifzTo: '',
      hifzScore: '',
      muraFrom: '',
      muraTo: '',
      muraScore: '',
      haqiba: '',
      istima: '',
      points: 0,
      target: getDayTargetForDate(dayDate),
      note: 'لم يتم تسجيل بيانات'
    };
  }

  return {
    day: DAY_NAMES_AR[dayDate.getDay()],
    dateStr,
    hudur: String(row[COL.HUDUR - 1] || '').trim(),
    hifzFrom: String(row[COL.HIFZ_FROM - 1] || '').trim(),
    hifzTo: String(row[COL.HIFZ_TO - 1] || '').trim(),
    hifzScore: row[COL.HIFZ_SCORE - 1] || '',
    muraFrom: String(row[COL.MURA_FROM - 1] || '').trim(),
    muraTo: String(row[COL.MURA_TO - 1] || '').trim(),
    muraScore: row[COL.MURA_SCORE - 1] || '',
    haqiba: String(row[COL.HAQIBA - 1] || '').trim(),
    istima: String(row[COL.ISTIMA - 1] || '').trim(),
    points: Number(row[COL.TOTAL - 1]) || 0,
    target: getDayTargetForDate(dayDate),
    note: String(row[COL.NOTE - 1] || '').trim()
  };
}

function summarizeUnifiedWeek(details) {
  const hifzFromValues = [];
  const hifzToValues = [];
  const muraFromValues = [];
  const muraToValues = [];
  let present = 0;
  let absent = 0;
  let hifzScore = 0;
  let muraScore = 0;
  let haqibaCount = 0;
  let istimaCount = 0;
  let total = 0;
  let target = 0;

  (details || []).forEach(d => {
    if (d.hudur === 'حاضر') present++;
    if (d.hudur === 'غائب') absent++;
    if (d.hifzFrom) hifzFromValues.push(d.hifzFrom);
    if (d.hifzTo) hifzToValues.push(d.hifzTo);
    if (d.muraFrom) muraFromValues.push(d.muraFrom);
    if (d.muraTo) muraToValues.push(d.muraTo);
    hifzScore += scoreToNumber(d.hifzScore);
    muraScore += scoreToNumber(d.muraScore);
    if (d.haqiba === 'نعم') haqibaCount++;
    if (d.istima === 'نعم') istimaCount++;
    total += Number(d.points) || 0;
    target += Number(d.target) || 0;
  });

  return {
    present,
    absent,
    hifzFrom: firstNonEmpty(hifzFromValues),
    hifzTo: lastNonEmpty(hifzToValues),
    hifzScore,
    muraFrom: firstNonEmpty(muraFromValues),
    muraTo: lastNonEmpty(muraToValues),
    muraScore,
    haqibaCount,
    istimaCount,
    total,
    target
  };
}

function firstNonEmpty(values) {
  for (let i = 0; i < (values || []).length; i++) {
    const v = String(values[i] || '').trim();
    if (v) return v;
  }
  return '';
}

function lastNonEmpty(values) {
  for (let i = (values || []).length - 1; i >= 0; i--) {
    const v = String(values[i] || '').trim();
    if (v) return v;
  }
  return '';
}

function summarizeUnifiedStudentWeeks_(studentWeeks, isSpecialTrack) {
  const weeks = studentWeeks || [];
  const hifzFromValues = [];
  const hifzToValues = [];
  const muraFromValues = [];
  const muraToValues = [];
  let present = 0;
  let hifzScore = 0;
  let muraScore = 0;
  let haqibaCount = 0;
  let samtCount = 0;
  let total = 0;
  let target = 0;

  weeks.forEach(function(week) {
    present += Number(week.present) || 0;
    hifzScore += Number(week.hifzScore) || 0;
    muraScore += Number(week.muraScore) || 0;
    haqibaCount += Number(week.haqibaCount) || 0;
    total += Number(week.total) || 0;
    target += Number(week.target) || 0;

    if (week.hifzFrom) hifzFromValues.push(week.hifzFrom);
    if (week.hifzTo) hifzToValues.push(week.hifzTo);
    if (!isSpecialTrack && week.muraFrom) muraFromValues.push(week.muraFrom);
    if (!isSpecialTrack && week.muraTo) muraToValues.push(week.muraTo);

    samtCount += Number(week.istimaCount) || 0;
  });

  return {
    present: present,
    hifzFrom: firstNonEmpty(hifzFromValues),
    hifzTo: lastNonEmpty(hifzToValues),
    hifzScore: hifzScore,
    muraFrom: isSpecialTrack ? '' : firstNonEmpty(muraFromValues),
    muraTo: isSpecialTrack ? '' : lastNonEmpty(muraToValues),
    muraScore: isSpecialTrack ? '' : muraScore,
    haqibaCount: haqibaCount,
    samtCount: samtCount,
    behaviorText: '',
    total: total,
    target: target,
    ratio: target ? total / target : 0
  };
}

function findUnifiedStudentRowForWeekRow_(sheet, weekRow) {
  if (!sheet || !weekRow) return 0;
  for (let r = Number(weekRow) - 1; r >= 3; r--) {
    const text = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!text) continue;
    if (parseUnifiedDayLabel_(text)) continue;
    if (getUnifiedWeekIndexFromLabel_(text) > 0) continue;
    if (isCircleWeeklySummaryLabel_(text) || isCircleDailySummaryLabel_(text)) continue;
    if (isFirstCircleTrackSectionLabel_(text)) return 0;
    if (isUnifiedTrackHeaderLabel_(text)) continue;
    if (isInvalidUnifiedStudentName_(text)) continue;
    return r;
  }
  return 0;
}

function recalcUnifiedStudentSummaryForWeekRow_(sheet, weekRow) {
  if (!sheet || !weekRow) return false;
  const studentRow = findUnifiedStudentRowForWeekRow_(sheet, weekRow);
  if (!studentRow) return false;

  const lastRow = sheet.getLastRow();
  const weeks = [];
  for (let r = studentRow + 1; r <= lastRow; r++) {
    const label = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!label) continue;
    if (isCircleWeeklySummaryLabel_(label) || isCircleDailySummaryLabel_(label) || isFirstCircleTrackSectionLabel_(label)) break;
    if (isUnifiedTrackHeaderLabel_(label) || parseUnifiedDayLabel_(label)) continue;

    const weekIndex = getUnifiedWeekIndexFromLabel_(label);
    if (weekIndex > 0) {
      const row = sheet.getRange(r, 1, 1, UNIFIED_HEADERS.length).getDisplayValues()[0];
      weeks.push({
        index: weekIndex,
        present: extractFirstNumber_(row[1]),
        hifzFrom: String(row[2] || '').trim(),
        hifzTo: String(row[3] || '').trim(),
        hifzScore: Number(row[4]) || 0,
        muraFrom: String(row[5] || '').trim(),
        muraTo: String(row[6] || '').trim(),
        muraScore: Number(row[7]) || 0,
        haqibaCount: Number(row[8]) || 0,
        istimaCount: Number(row[9]) || 0,
        total: Number(row[10]) || 0,
        target: Number(row[11]) || 0
      });
      continue;
    }

    // أي نص حقيقي آخر بعد بداية مجموعة الطالب يعني أننا وصلنا إلى الطالب التالي.
    if (!isInvalidUnifiedStudentName_(label)) break;
  }

  const summary = summarizeUnifiedStudentWeeks_(weeks, false);
  sheet.getRange(studentRow, 2, 1, UNIFIED_HEADERS.length - 1).setValues([[
    summary.present + ' يوم',
    summary.hifzFrom,
    summary.hifzTo,
    summary.hifzScore,
    summary.muraFrom,
    summary.muraTo,
    summary.muraScore,
    summary.haqibaCount,
    summary.behaviorText,
    summary.total,
    summary.target,
    summary.ratio
  ]]);
  sheet.getRange(studentRow, 11, 1, 2).setNumberFormat('0');
  sheet.getRange(studentRow, 13).setNumberFormat('0%');
  return true;
}

function clearUnifiedReportBody(sheet) {
  const lastRow = sheet.getMaxRows();
  if (lastRow >= 3) {
    sheet.getRange(3, 1, lastRow - 2, Math.max(sheet.getMaxColumns(), UNIFIED_HEADERS.length))
      .clearContent()
      .clearFormat()
      .clearDataValidations();
  }
}

function formatUnifiedReportBody(sheet, rowCount, groupRanges, trackSections) {
  if (rowCount <= 0) return;
  sheet.getRange(3, 1, rowCount, UNIFIED_HEADERS.length)
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#d9e2f3', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);

  (trackSections || []).forEach(function(section) {
    const theme = section.theme || { header: '#1e3a5f' };
    const sectionRange = sheet.getRange(section.row, 1, 1, UNIFIED_HEADERS.length);
    try { sectionRange.merge(); } catch (e) {}
    sectionRange
      .setBackground(theme.header || '#1e3a5f')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(12)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    try { sheet.setRowHeight(section.row, 38); } catch (e) {}
  });

  groupRanges.forEach(function(g) {
    const trackTheme = getFirstCircleReportTheme_(g.track);
    const studentBackground = trackTheme ? trackTheme.header : '#1e3a5f';
    const weekBackground = trackTheme ? trackTheme.week : '#e8f5e9';
    const dayBackground = trackTheme ? trackTheme.day : '#f8fbff';

    sheet.getRange(g.student, 1, 1, UNIFIED_HEADERS.length)
      .setBackground(studentBackground)
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.getRange(g.student, 2, 1, UNIFIED_HEADERS.length - 1)
      .setFontColor('#ffffff');
    sheet.getRange(g.student, 11, 1, 2).setNumberFormat('0');
    sheet.getRange(g.student, 13).setNumberFormat('0%');

    if (g.trackHeader) {
      sheet.getRange(g.trackHeader, 1, 1, UNIFIED_HEADERS.length)
        .setBackground(studentBackground)
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setFontSize(9);
      try { sheet.setRowHeight(g.trackHeader, 32); } catch (e) {}
    }

    g.weeks.forEach(function(w) {
      sheet.getRange(w.weekRow, 1, 1, UNIFIED_HEADERS.length)
        .setBackground(weekBackground)
        .setFontWeight('bold');
      sheet.getRange(w.weekRow, 11, 1, 2).setNumberFormat('0');
      sheet.getRange(w.weekRow, 13).setNumberFormat('0%');

      const count = w.lastDay - w.firstDay + 1;
      if (count > 0) {
        sheet.getRange(w.firstDay, 1, count, UNIFIED_HEADERS.length).setBackground(dayBackground);
        sheet.getRange(w.firstDay, 11, count, 2).setNumberFormat('0');
      }

      if (g.track === 'nurania' || g.track === 'tilawa') {
        sheet.getRange(w.weekRow, 6, 1, 3).setBackground('#f3f4f6').setFontColor('#9ca3af');
        if (count > 0) {
          sheet.getRange(w.firstDay, 6, count, 3).setBackground('#f8fafc').setFontColor('#c4c9d1');
        }
      }
    });
  });

  sheet.setRowHeights(3, rowCount, 34);
  groupRanges.forEach(function(g) {
    try { sheet.setRowHeight(g.student, 46); } catch (e) {}
  });
}

function applyUnifiedReportGroups(sheet, groupRanges) {
  try {
    sheet.setRowGroupControlPosition(SpreadsheetApp.GroupControlTogglePosition.BEFORE);
  } catch (e) {}

  // المستوى الأول: تحت كل طالب تظهر الأسابيع الستة.
  groupRanges.forEach(g => {
    if (g.last >= g.first) {
      try {
        sheet.getRange(g.first, 1, g.last - g.first + 1, 1).shiftRowGroupDepth(1);
      } catch (e) {
        Logger.log('Unified student group skipped: ' + e.message);
      }
    }
  });

  // المستوى الثاني: تحت كل أسبوع تظهر أيام الأسبوع.
  groupRanges.forEach(g => {
    g.weeks.forEach(w => {
      const count = w.lastDay - w.firstDay + 1;
      if (count > 0) {
        try {
          sheet.getRange(w.firstDay, 1, count, 1).shiftRowGroupDepth(1);
        } catch (e) {
          Logger.log('Unified week day group skipped: ' + e.message);
        }
      }
    });
  });

  // نغلق التفاصيل: يظهر الطالب فقط، وعند الفتح تظهر الأسابيع، وعند فتح الأسبوع تظهر الأيام.
  groupRanges.forEach(g => {
    g.weeks.forEach(w => {
      try {
        const detailGroup = sheet.getRowGroup(w.firstDay, 2);
        if (detailGroup) detailGroup.collapse();
      } catch (e) {}
    });
    try {
      const studentGroup = sheet.getRowGroup(g.first, 1);
      if (studentGroup) studentGroup.collapse();
    } catch (e) {}
  });
}

function applyUnifiedWidths(sheet, teamId) {
  void teamId;
  const widths = [220, 130, 160, 160, 95, 160, 160, 105, 105, 95, 90, 90, 180];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });
}

function rebuildUnifiedReportsNow() {
  // لا نبني كل الحلقات مرة واحدة حتى لا يظهر Exceeded maximum execution time.
  // نضع كل الحلقات في قائمة الانتظار ثم نعالج أول حلقة فقط الآن.
  markReportsDirty('', '');
  return refreshReportsIfDirty();
}

function rebuildUnifiedReportBlue() {
  markReportsDirty('', 'blue');
  return refreshReportsIfDirty();
}

function rebuildUnifiedReportRed() {
  markReportsDirty('', 'red');
  return refreshReportsIfDirty();
}

function rebuildUnifiedReportGreen() {
  markReportsDirty('', 'green');
  return refreshReportsIfDirty();
}

function rebuildUnifiedReportPurple() {
  markReportsDirty('', 'purple');
  return refreshReportsIfDirty();
}

function testAdminSaveConnection() {
  // دالة فحص: تضيف صف تجربة في شيت البيانات ثم تبني تقرير حلقة أولى.
  // احذف صف التجربة من شيت البيانات بعد الفحص إذا ما تحتاجه.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const teamId = 'blue';
  const studentName = '__اختبار اتصال الأدمن__';
  appendStudentToRosterIfMissing(ss, teamId, studentName);

  const dateStr = formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const data = {
    studentName,
    teamId,
    date: dateStr,
    hudur: true,
    hifzFrom: 'اختبار',
    hifzTo: 'اختبار',
    hifzScore: '30',
    muraFrom: '',
    muraTo: '',
    muraScore: '',
    haqiba: true,
    istima: true,
    totalPoints: 70,
    notes: 'اختبار اتصال من Apps Script'
  };

  const existingRow = findLogRow(logSheet, dateStr, studentName, teamId);
  if (existingRow > 0) upsertLogRow(logSheet, existingRow, data, teamId);
  else insertLogRow(logSheet, dateStr, studentName, data, teamId);

  SpreadsheetApp.flush();
  generateUnifiedReportForTeamOnly(teamId, dateStr);
  return 'تم اختبار الاتصال: تحقق من شيت البيانات ومن تقرير حلقة أولى';
}


function repairUnifiedReportMergedCells() {
  // شغلها مرة واحدة لو ظهر خطأ merged range.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(TEAM_SHEETS).forEach(teamId => {
    const sheet = ss.getSheetByName(UNIFIED_PREFIX + TEAM_SHEETS[teamId]);
    if (sheet) safeBreakApartMergedCells(sheet);
  });
  return 'تم فك الدمج من تقارير الحلقات';
}


// ══════════════════════════════════════════════════════════════
//  GET — أوامر من AdminPage
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  const callback = e && e.parameter && e.parameter.callback;

  // صفحات تقارير أولياء الأمور
  if (action === 'parentReport') return showParentReportWeb_(e);
  if (action === 'parentPeriodReport') return showParentPeriodReportWeb_(e);
  if (action === 'teamPeriodReport') return showTeamPeriodReportWeb_(e);
  if (action === 'parentReports') return showParentReportsDashboard_(e);

  // بيانات JSON لصفحات التقارير السريعة في الموقع
  if (action === 'reportData' || action === 'reportsDashboardData') return handleReportsApi_(e);

  if (action === 'getClasses') {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const classes = getDynamicClasses_(ss);
      return jsonOrJsonp(callback, {
        status: 'ok',
        count: classes.length,
        classes: classes
      });
    } catch (err) {
      return jsonOrJsonp(callback, {
        status: 'error',
        count: 0,
        classes: [],
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  // بنود التسجيل الديناميكية: الإدارة تحددها وتتزامن على كل أجهزة المعلمين.
  if (action === 'getRegItems') {
    try {
      return jsonOrJsonp(callback, { status: 'ok', items: getRegItems_() });
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', items: [], message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'saveRegItems') {
    try {
      const items = parsePayloadParam_(e.parameter.payload || '[]');
      const result = saveRegItems_(items, e.parameter.password || '');
      return jsonOrJsonp(callback, { status: 'ok', items: getRegItems_(), updatedAt: result.updatedAt });
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'getStudents') {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const students = getAllTeamStudentsFast_(ss);
    const studentProfiles = getAllTeamStudentProfilesFast_(ss, students);
    return jsonOrJsonp(callback, { status: 'ok', students, studentProfiles });
  }

  // ── إدارة الحلقة من الموقع: إضافة/حذف طالب ──
  if (action === 'addStudent') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      return jsonOrJsonp(callback, addStudentToRoster_(p.teamId || '', p.studentName || ''));
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'addStudents') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      return jsonOrJsonp(callback, addStudentsToRoster_(p.teamId || '', p.names || ''));
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'removeStudent') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      return jsonOrJsonp(callback, removeStudentFromRoster_(p.teamId || '', p.studentName || ''));
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  // ── سجل التسجيلات: جلب تسجيلات يوم محدد لحلقة محددة / حذف تسجيل ──
  if (action === 'getEntries') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      return jsonOrJsonp(callback, getEntriesForResult_(p.teamId || '', p.date || ''));
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', entries: [], message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'deleteEntry') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      return jsonOrJsonp(callback, deleteEntry_(p.teamId || '', p.date || '', p.studentName || ''));
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err && err.message ? err.message : String(err) });
    }
  }

  if (action === 'debugStudents') {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const students = getAllTeamStudentsFast_(ss);
    const studentProfiles = getAllTeamStudentProfilesFast_(ss, students);
    const sheetNames = ss.getSheets().map(s => s.getName());
    return jsonOrJsonp(callback, { status: 'ok', sheetNames, students, studentProfiles });
  }

  if (action === 'setupRosterSheets') {
    setupRosterSheets();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم تجهيز أوراق الحلقات، وإضافة مسار طلاب حلقة أولى' });
  }

  if (action === 'checkTodayEntry') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const result = getTodayEntryResult_(p.studentName || '', p.teamId || p.teamName || p.team || '', p.date || '');
      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err.message });
    }
  }


  if (action === 'ultraHealthV7') {
    return jsonOrJsonp(callback, {
      status: 'ok',
      version: FAST_SAVE_VERSION_V7,
      mode: 'instant-save-plus-browser-kick-and-minute-trigger',
      timestamp: new Date().toISOString()
    });
  }

  if (action === 'saveEntryUltraV7') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const data = parsePayloadParam_(p.payload || '{}');
      const result = saveAdminEntryUltraV6_(data, p.mode || 'create');
      result.version = FAST_SAVE_VERSION_V7;
      result.reportStatus = result.reportStatus || 'queued-student-properties';
      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, {
        status: 'error',
        version: FAST_SAVE_VERSION_V7,
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  if (action === 'syncStudentReportV7') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const result = syncSingleStudentReportV7_(
        p.date || '',
        p.teamId || p.teamName || p.team || '',
        p.studentName || ''
      );
      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, {
        status: 'queued',
        version: FAST_SAVE_VERSION_V7,
        updated: false,
        message: err && err.message ? err.message : String(err)
      });
    }
  }

  if (action === 'reportQueueDebugV7') {
    return jsonOrJsonp(callback, DEBUG_RELIABLE_REPORT_V7());
  }

  if (action === 'saveEntry') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const data = parsePayloadParam_(p.payload || '{}');
      const result = saveAdminEntry_(data, p.mode || 'merge');

      // لا ننشئ تقارير منفصلة للفصول المدرسية في هذه المرحلة.
      // المزامنة الفورية تبقى للحلقات القديمة فقط حتى يتم اعتماد تصميم تقارير المدرسة لاحقاً.
      if (!isDynamicClassId_(result.teamId || data.teamId || '')) {
        try {
          const directReportSync = syncSingleStudentReportV7_(
            result.date || data.date || '',
            result.teamId || data.teamId || data.teamName || data.team || '',
            result.studentName || data.studentName || ''
          );

          result.reportSync = directReportSync;
          if (directReportSync && directReportSync.updated) {
            result.reportStatus = 'updated-now';
            result.message = 'تم حفظ البيانات وتحديث تقرير الطالب مباشرة';
          } else {
            result.reportStatus = (directReportSync && directReportSync.status) || result.reportStatus || 'queued';

            // احتياط فوري: لو ما لقينا صف الطالب أو صف اليوم في التقرير (طالب جديد أو
            // تقرير مبني قبل إضافته) نعيد بناء تقرير الحلقة ثم نكتب صف الطالب مباشرة،
            // حتى لا ينتظر المعلم تريجر الخلفية.
            try {
              const fallbackSs = SpreadsheetApp.openById(SPREADSHEET_ID);
              const rebuildSync = syncUnifiedReportAfterSave_(
                fallbackSs,
                result.date || data.date || '',
                result.teamId || data.teamId || '',
                result.studentName || data.studentName || ''
              );
              result.reportRebuild = rebuildSync;
              if (rebuildSync && Number(rebuildSync.updatedRows) > 0) {
                result.reportStatus = 'updated-now';
                result.message = 'تم حفظ البيانات وتحديث تقرير الطالب مباشرة';
              }
            } catch (rebuildErr) {
              Logger.log('saveEntry rebuild sync ERROR: ' + (rebuildErr && rebuildErr.message ? rebuildErr.message : rebuildErr));
            }
          }
        } catch (reportErr) {
          Logger.log('saveEntry direct student report sync ERROR: ' + (reportErr && reportErr.message ? reportErr.message : reportErr));
          result.reportSync = {
            status: 'queued',
            updated: false,
            message: reportErr && reportErr.message ? reportErr.message : String(reportErr)
          };
          result.reportStatus = result.reportStatus || 'queued';
        }
      }

      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err.message });
    }
  }

  if (action === 'getTodayEntries') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const result = getTodayEntriesResult_(p.teamId || p.teamName || p.team || '', p.date || '');
      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err.message });
    }
  }

  if (action === 'getTodayEntriesAll') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const result = getTodayEntriesAllResult_(p.date || '');
      return jsonOrJsonp(callback, result);
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err.message });
    }
  }

  if (action === 'clearToday') {
    const p = e && e.parameter ? e.parameter : {};
    const password = p.password || p.resetPassword || p.token;
    return handleClearToday(callback, password, p.date || '');
  }

  if (action === 'clearAll') {
    const password = e && e.parameter && (e.parameter.password || e.parameter.resetPassword || e.parameter.token);
    return handleClearAll(callback, password);
  }

  if (action === 'dailyMaintenance') {
    dailyMaintenance();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تمت الصيانة بدون حذف أسماء الطلاب' });
  }

  if (action === 'buildWeekly') {
    generateUnifiedReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم بناء التقرير الموحد' });
  }

  if (action === 'rebuildWeeklyNow') {
    const result = rebuildWeeklyNow();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم تحديث التقرير الأسبوعي حسب آخر تسجيل', debug: result });
  }

  if (action === 'buildMonthly') {
    generateUnifiedReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم حذف التقرير الشهري وبناء التقرير الموحد' });
  }

  if (action === 'buildFinal') {
    generateUnifiedReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم بناء التقرير الموحد' });
  }

  if (action === 'buildReports') {
    migrateHeaders();
    generateUnifiedReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم تحديث التقرير الموحد' });
  }

  if (action === 'buildUnified') {
    generateUnifiedReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم بناء التقرير الموحد' });
  }


  if (action === 'fixOldDatesAndRebuildReports') {
    fixOldDatesAndRebuildReports();
    clearReportsDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: 'تم إصلاح التواريخ القديمة وإعادة بناء تقارير الحلقات' });
  }

  if (action === 'refreshReportsIfDirty') {
    const result = refreshReportsIfDirty();
    return jsonOrJsonp(callback, { status: 'ok', message: result });
  }

  if (action === 'runOneQueuedReportNow') {
    const result = runOneQueuedReportNow();
    return jsonOrJsonp(callback, { status: 'ok', message: result.message || String(result), result: result });
  }

  if (action === 'runReportQueueNow') {
    const p = e && e.parameter ? e.parameter : {};
    const result = runReportQueueNow(p.maxTeams || 4, p.maxMillis || 240000);
    return jsonOrJsonp(callback, { status: 'ok', message: result.message || String(result), result: result });
  }

  if (action === 'syncTodayReportsNow') {
    try {
      const p = e && e.parameter ? e.parameter : {};
      const dateStr = normalizeDate(p.date || formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));
      const result = syncUnifiedReportsForDateNow_(dateStr, p.teamId || p.team || '', p.studentName || '');
      return jsonOrJsonp(callback, { status: 'ok', message: result.message || 'تم تحديث تقارير اليوم فوراً', result });
    } catch (err) {
      return jsonOrJsonp(callback, { status: 'error', message: err.message });
    }
  }

  if (action === 'debugReportsQueueStatus') {
    const result = debugReportsQueueStatus();
    return jsonOrJsonp(callback, { status: 'ok', debug: result });
  }

  return jsonOrJsonp(callback, { status: 'ok', message: 'سباق البحارة — نظام القوائم وقاعدة البيانات' });
}

function handleClearToday(callback, password, dateValue) {
  try {
    if (!isResetPasswordValid(password)) {
      return jsonOrJsonp(callback, {
        status: 'unauthorized',
        message: 'كلمة مرور التصفير غير صحيحة'
      });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getOrCreateLogSheet(ss);
    const dateStr = normalizeDate(dateValue || formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date()));

    // تصفير اليوم يجب أن ينعكس على كل تقارير الحلقات فوراً.
    // نحذف بيانات اليوم من قاعدة البيانات، ثم نزامن صف هذا اليوم في كل تقرير حلقة
    // ونحدث صف الأسبوع مباشرة بدون انتظار طابور أو Trigger.
    const removed = clearLogRowsForDate_(logSheet, dateStr);
    const reportClear = clearUnifiedReportRowsForDate_(ss, dateStr);

    let syncResult = null;
    let queueMessage = 'تم تحديث تقارير الحلقات فوراً';
    try {
      syncResult = syncUnifiedReportsForDateNow_(dateStr, '', '');
    } catch (syncErr) {
      queueMessage = 'تم التصفير، لكن تعذر تحديث التقارير فوراً؛ تم وضعها في الطابور: ' + syncErr.message;
      Logger.log('clearToday instant sync skipped: ' + syncErr.message);
      try {
        markReportsDirty(dateStr, '');
        if (typeof createFastReportsTrigger === 'function') createFastReportsTrigger();
      } catch (queueErr) {
        Logger.log('clearToday queue skipped: ' + queueErr.message);
      }
    }

    SpreadsheetApp.flush();

    return jsonOrJsonp(callback, {
      status: 'clearedToday',
      date: dateStr,
      deletedRows: removed.deletedRows,
      removedPointsByTeam: removed.removedPointsByTeam,
      totalRemovedPoints: removed.totalRemovedPoints,
      reportClear,
      syncResult,
      refreshMessage: queueMessage,
      message: 'تم تصفير بيانات اليوم من قاعدة البيانات ومن تقارير الحلقات'
    });
  } catch (err) {
    Logger.log('handleClearToday ERROR: ' + err.message);
    return jsonOrJsonp(callback, { status: 'error', message: err.message });
  }
}

function clearLogRowsForDate_(sheet, dateStr) {
  const removedPointsByTeam = {};
  Object.keys(TEAM_SHEETS).forEach(teamId => removedPointsByTeam[teamId] = 0);
  getDynamicClassLookup_().list.forEach(function(meta) {
    removedPointsByTeam[meta.classId] = 0;
  });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { deletedRows: 0, removedPointsByTeam, totalRemovedPoints: 0 };
  }

  const data = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const rowsToDelete = [];

  data.forEach((row, index) => {
    const rowDate = dateValueToString(row[COL.DATE - 1]);
    if (rowDate !== dateStr) return;

    const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    const points = Number(row[COL.TOTAL - 1]) || 0;

    if (teamId && Object.prototype.hasOwnProperty.call(removedPointsByTeam, teamId)) {
      removedPointsByTeam[teamId] += points;
    }

    rowsToDelete.push(index + 2);
  });

  rowsToDelete.sort((a, b) => b - a).forEach(rowNumber => sheet.deleteRow(rowNumber));

  const totalRemovedPoints = Object.keys(removedPointsByTeam)
    .reduce((sum, teamId) => sum + (Number(removedPointsByTeam[teamId]) || 0), 0);

  return {
    deletedRows: rowsToDelete.length,
    removedPointsByTeam,
    totalRemovedPoints
  };
}


function extractDateFromUnifiedReportLabel_(label) {
  const text = String(label || '')
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[\u200e\u200f\u061c]/g, '')
    .trim();
  if (!text) return '';

  // أمثلة:
  // الأحد — 7/5/2026
  // الإثنين — 2026-07-05
  const match = text.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/);
  return match ? normalizeDate(match[1]) : '';
}

function clearUnifiedReportRowsForDate_(ss, dateStr) {
  const targetDate = normalizeDate(dateStr);
  const result = {
    targetDate,
    checkedSheets: [],
    clearedRowsBySheet: {},
    totalClearedRows: 0
  };

  if (!targetDate) return result;

  ss.getSheets().forEach(sheet => {
    const sheetName = sheet.getName();

    // نمسح من تقارير الحلقات الموحدة فقط:
    // تقرير حلقة أولى / تقرير حلقة ثاني / تقرير حلقة ثالث / تقرير حلقة رابع
    const normalizedSheetName = normalizeArabicSheetName(sheetName);
    const normalizedUnifiedPrefix = normalizeArabicSheetName(UNIFIED_PREFIX);
    if (normalizedSheetName.indexOf(normalizedUnifiedPrefix) !== 0) return;
    if (sheetName.indexOf(WEEKLY_PREFIX) === 0 || sheetName.indexOf(FINAL_PREFIX) === 0) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) return;

    result.checkedSheets.push(sheetName);

    const labels = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
    const rowsToClear = [];
    const weekRowsToRecalc = {};

    labels.forEach((row, index) => {
      const rowDate = extractDateFromUnifiedReportLabel_(row[0]);
      if (rowDate === targetDate) rowsToClear.push(index + 3);
    });

    rowsToClear.forEach(rowNumber => {
      // نترك عمود اليوم/التاريخ A كما هو حتى يبقى شكل التقرير ثابتاً،
      // ونمسح بيانات اليوم فقط من B إلى M.
      const dayDate = parseDate(targetDate);
      const target = dayDate ? getDayTargetForDate(dayDate) : 100;
      sheet.getRange(rowNumber, 2, 1, UNIFIED_HEADERS.length - 1).setValues([[
        '', '', '', '', '', '', '', '', '',
        0,
        target,
        'لم يتم تسجيل بيانات'
      ]]);
      const weekRange = findUnifiedWeekRangeForDayRow_(sheet, rowNumber);
      if (weekRange) weekRowsToRecalc[weekRange.weekRow] = weekRange;
    });

    Object.keys(weekRowsToRecalc).forEach(key => {
      const weekRange = weekRowsToRecalc[key];
      if (recalcUnifiedWeekRowFromDayRows_(sheet, weekRange)) {
        const weekIndex = getUnifiedWeekIndexFromLabel_(sheet.getRange(weekRange.weekRow, 1).getDisplayValue());
        recalcCircleWeeklySummaryRows_(sheet, weekIndex);
      }
    });

    if (rowsToClear.length) {
      result.clearedRowsBySheet[sheetName] = rowsToClear.length;
      result.totalClearedRows += rowsToClear.length;
    }
  });

  return result;
}

function handleClearAll(callback, password) {
  try {
    if (!isResetPasswordValid(password)) {
      return jsonOrJsonp(callback, {
        status: 'unauthorized',
        message: 'كلمة مرور التصفير غير صحيحة'
      });
    }
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // نمسح قاعدة البيانات فقط، ونضع كل تقارير الحلقات في التحديث بالخلفية.
    // لا نبني كل التقارير داخل طلب التصفير حتى لا يحصل timeout.
    const logSheet = getOrCreateLogSheet(ss);
    clearDataRows(logSheet);
    deleteMonthlyReportSheet(ss);

    try {
      markReportsDirty('', '');
      createFastReportsTrigger();
    } catch (queueErr) {
      Logger.log('clearAll queue skipped: ' + queueErr.message);
    }

    return jsonOrJsonp(callback, { status: 'cleared', message: 'تم التصفير ووضع كل تقارير الحلقات في قائمة التحديث بالخلفية' });
  } catch (err) {
    return jsonOrJsonp(callback, { status: 'error', message: err.message });
  }
}

function dailyMaintenance() {
  // صيانة آمنة فقط: لا نعيد كتابة أوراق الأسماء عند فتح AdminPage.
  // إعادة الكتابة المتكررة كانت سبباً محتملاً لاختفاء أسماء الطلاب أو تأخر ظهورها.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return getAllTeamStudentsFast_(ss);
}

function migrateHeaders() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateLogSheet(ss);
  Object.keys(TEAM_SHEETS).forEach(teamId => getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]));
  deleteMonthlyReportSheet(ss);
}

// ══════════════════════════════════════════════════════════════
//  دوال مساعدة للأوراق
// ══════════════════════════════════════════════════════════════
function getOrCreateLogSheet(ss) {
  // مسار سريع: الورقة موجودة وجاهزة فلا نعيد تنسيقها في كل عملية حفظ.
  // كان إعادة التنسيق (العناوين وعروض الأعمدة ورقم التاريخ) تجعل تسجيل AdminPage بطيئاً.
  try {
    const existing = ss.getSheetByName(SHEET_LOG);
    if (existing && String(existing.getRange(1, 1).getDisplayValue() || '').trim() === HEADERS[0]) {
      return existing;
    }
  } catch (_) {}

  const sheet = getOrCreateSheet(ss, SHEET_LOG, HEADERS);
  setLogHeaders(sheet);
  return sheet;
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.setRightToLeft(true);

  if (headers) {
    ensureColumns(sheet, headers.length);
    if (sheet.getLastRow() === 0) sheet.insertRows(1, 1);
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#1e3a5f')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function setLogHeaders(sheet) {
  ensureColumns(sheet, HEADERS.length);
  sheet.setRightToLeft(true);
  // عمود التاريخ نص ثابت بصيغة شهر/يوم/سنة، حتى لا يغيّره Locale الخاص بملف Google Sheets.
  try {
    sheet.getRange(2, COL.DATE, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  } catch (e) {}
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setValues([HEADERS])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 28);
  applyLogWidths(sheet);
}

function formatLogDataRow(sheet, rowIdx) {
  sheet.getRange(rowIdx, 1, 1, HEADERS.length)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#e5e7eb', SpreadsheetApp.BorderStyle.SOLID)
    .setWrap(true);
}

function applyLogWidths(sheet) {
  const widths = [100, 140, 80, 150, 150, 90, 150, 150, 100, 110, 90, 90, 180, 130, 155];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

function ensureColumns(sheet, count) {
  const current = sheet.getMaxColumns();
  if (current < count) sheet.insertColumnsAfter(current, count - current);
}

function clearDataRows(sheet) {
  const last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, sheet.getLastColumn())
      .clearContent()
      .clearFormat()
      .clearDataValidations();
  }
}


// ══════════════════════════════════════════════════════════════
//  إصلاح التاريخ القديم: من يوم/شهر/سنة إلى شهر/يوم/سنة
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  أدوات إصلاح يدوية للحالات القديمة قبل تركيب تريجر تعديل الأسماء
// ══════════════════════════════════════════════════════════════
function fixStudentNameOnce() {
  // عدّل القيم الثلاث التالية ثم شغّل هذه الدالة مرة واحدة فقط.
  // teamId: blue = حلقة أولى، red = حلقة ثاني، green = حلقة ثالث، purple = حلقة رابع.
  const teamId = 'blue';
  const oldName = 'خالد المطري';
  const newName = 'خالد يوسف المطري';

  return renameStudentInTeam(teamId, oldName, newName);
}

function renameStudentInTeam(teamId, oldName, newName) {
  teamId = normalizeTeamId(teamId);
  oldName = String(oldName || '').trim();
  newName = String(newName || '').trim();

  if (!teamId) throw new Error('teamId غير صحيح. استخدم blue أو red أو green أو purple');
  if (!oldName || !newName) throw new Error('اكتب الاسم القديم والجديد');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rosterSheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);

  // نضمن أن الاسم الجديد موجود في شيت الأسماء، ونستبدل القديم إن كان لا يزال موجوداً.
  const lastRow = Math.max(rosterSheet.getLastRow(), 2);
  const values = rosterSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
  let foundNewInRoster = false;

  for (let i = 0; i < values.length; i++) {
    const v = String(values[i] || '').trim();
    if (v === newName) foundNewInRoster = true;
    if (v === oldName) {
      rosterSheet.getRange(i + 2, 1).setValue(newName);
      foundNewInRoster = true;
    }
  }

  if (!foundNewInRoster) {
    rosterSheet.getRange(Math.max(rosterSheet.getLastRow() + 1, 2), 1).setValue(newName);
  }

  const changedRows = renameStudentEverywhere_(ss, teamId, oldName, newName);
  compactRosterSheetAllowEmpty_(rosterSheet);
  generateUnifiedReportForTeamOnly(teamId, '');
  SpreadsheetApp.flush();

  return 'تم تعديل الاسم من "' + oldName + '" إلى "' + newName + '". عدد سجلات البيانات المعدلة: ' + changedRows;
}

function deleteStudentInTeam(teamId, studentName) {
  teamId = normalizeTeamId(teamId);
  studentName = String(studentName || '').trim();

  if (!teamId) throw new Error('teamId غير صحيح. استخدم blue أو red أو green أو purple');
  if (!studentName) throw new Error('اكتب اسم الطالب');

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rosterSheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);

  const lastRow = Math.max(rosterSheet.getLastRow(), 2);
  const values = rosterSheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i] || '').trim() === studentName) {
      rosterSheet.getRange(i + 2, 1).clearContent();
    }
  }

  const deletedRows = deleteStudentEverywhere_(ss, teamId, studentName);
  compactRosterSheetAllowEmpty_(rosterSheet);
  generateUnifiedReportForTeamOnly(teamId, '');
  SpreadsheetApp.flush();

  return 'تم حذف الطالب "' + studentName + '". عدد سجلات البيانات المحذوفة: ' + deletedRows;
}

// ══════════════════════════════════════════════════════════════
//  دوال مساعدة عامة
// ══════════════════════════════════════════════════════════════
function formatDate(d) {
  // صيغة العرض والربط داخل التقرير: شهر/يوم/سنة
  // مثال: السبت 4 يوليو 2026 يظهر 7/4/2026 وليس 4/7/2026.
  return String(d.getMonth() + 1) + '/' + String(d.getDate()) + '/' + String(d.getFullYear());
}

function normalizeDate(str) {
  if (!str) return '';
  let s = String(str)
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim();

  // الأفضل أن يرسل AdminPage التاريخ بصيغة ISO غير ملتبسة: 2026-07-04
  // ثم نحوله للعرض داخل الشيت إلى 7/4/2026.
  const isoAny = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:T.*)?$/);
  if (isoAny) {
    const d = new Date(Number(isoAny[1]), Number(isoAny[2]) - 1, Number(isoAny[3]));
    return isNaN(d.getTime()) ? s : formatDate(d);
  }

  // الصيغة المعتمدة الآن: MM/DD/YYYY
  // مثال: 7/4/2026 = 4 يوليو 2026.
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return String(month) + '/' + String(day) + '/' + String(year);
    }
  }

  return s;
}

function normalizeLegacyDmyDate(str) {
  // تستخدم مرة واحدة فقط لإصلاح السجلات القديمة التي أرسلها AdminPage سابقاً بصيغة en-GB: DD/MM/YYYY.
  if (!str) return '';
  let s = String(str)
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .trim();

  const isoAny = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})(?:T.*)?$/);
  if (isoAny) {
    const d = new Date(Number(isoAny[1]), Number(isoAny[2]) - 1, Number(isoAny[3]));
    return isNaN(d.getTime()) ? s : formatDate(d);
  }

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return String(month) + '/' + String(day) + '/' + String(year);
    }
  }

  return normalizeDate(s);
}

function dateValueToString(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return formatDate(value);
  return normalizeDate(String(value || '').trim());
}

function parseDate(str) {
  const normalized = normalizeDate(str);
  if (!normalized) return null;
  const p = normalized.split('/');
  if (p.length !== 3) return null;
  const d = new Date(Number(p[2]), Number(p[0]) - 1, Number(p[1]));
  return isNaN(d.getTime()) ? null : d;
}

function getWeekStart(d) {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function formatPercentText(value) {
  const pct = Math.max(0, value || 0) * 100;
  return pct.toFixed(pct % 1 === 0 ? 0 : 1) + '%';
}

function normalizeTeamId(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  if (TEAM_SHEETS[s]) return s;

  // الفصول المدرسية تستخدم classId ثابتاً مشتقاً من sheetId.
  if (isDynamicClassId_(s)) {
    const metaById = getDynamicClassMetaByAny_(s);
    if (!metaById) return '';

    // الحلقات القديمة (حلقة أولى..رابع) معرّفها القديم هو مصدر منطق
    // التقارير والحفظ، فنعيده بدل classId حتى لا يتغير أي شيء آخر.
    return metaById.legacyTeamId || metaById.classId;
  }

  const normalized = normalizeArabicSheetName(s);
  for (const id in TEAM_SHEETS) {
    const names = [TEAM_SHEETS[id], TEAM_NAMES[id]].concat(TEAM_SHEET_ALIASES[id] || []);
    for (let i = 0; i < names.length; i++) {
      if (normalizeArabicSheetName(names[i]) === normalized) return id;
    }
  }

  // توافق مع اسم الفصل الحالي في شيت البيانات أو الطلبات القديمة.
  const dynamicMeta = getDynamicClassMetaByAny_(s);
  return dynamicMeta ? dynamicMeta.classId : '';
}

function teamIdFromSheetName(teamSheetName) {
  return normalizeTeamId(teamSheetName);
}

function inferTeamIdForStudent(studentName, rosterMap) {
  let found = '';
  Object.keys(TEAM_SHEETS).forEach(teamId => {
    if ((rosterMap[teamId] || []).indexOf(studentName) !== -1) {
      if (!found) found = teamId;
    }
  });
  return found;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp(callback, obj) {
  const payload = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(String(callback) + '(' + payload + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}


// ══════════════════════════════════════════════════════════════
//  تحديث فوري خفيف لتقارير الحلقات
//  لا يعيد بناء التقرير بالكامل. يزامن صف اليوم فقط ويعيد حساب صف الأسبوع.
// ══════════════════════════════════════════════════════════════
function normalizeStudentReportKey_(value) {
  // توحيد أقوى لأسماء الطلاب حتى لا يفشل تحديث التقرير بسبب مسافة مخفية،
  // تشكيل، تطويل، أو اختلاف بسيط في الألف/الياء بين ورقة الأسماء وورقة البيانات.
  return String(value || '')
    .replace(/[\u200e\u200f\u061c]/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9]+/g, '')
    .toLowerCase()
    .trim();
}

function readLogRowsForDateByTeamStudent_(logSheet, dateStr) {
  const targetDate = normalizeDate(dateStr);
  const out = {};
  const byNormalized = {};
  Object.keys(TEAM_SHEETS).forEach(teamId => {
    out[teamId] = {};
    byNormalized[teamId] = {};
  });

  const lastRow = logSheet.getLastRow();
  if (lastRow < 2 || !targetDate) return { exact: out, normalized: byNormalized };

  const data = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  data.forEach(row => {
    const rowDate = dateValueToString(row[COL.DATE - 1]);
    if (rowDate !== targetDate) return;

    const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    const studentName = String(row[COL.STUDENT - 1] || '').trim();
    if (!teamId || !studentName || !out[teamId]) return;

    out[teamId][studentName] = row;
    byNormalized[teamId][normalizeStudentReportKey_(studentName)] = row;
  });

  return { exact: out, normalized: byNormalized };
}

function getReportSheetForTeam_(ss, teamId) {
  const teamName = TEAM_SHEETS[teamId];
  if (!teamName) return null;
  return ss.getSheetByName(UNIFIED_PREFIX + teamName);
}

function getSavedRowForReportStudent_(maps, teamId, studentName) {
  const exact = maps && maps.exact && maps.exact[teamId] ? maps.exact[teamId] : {};
  const normalized = maps && maps.normalized && maps.normalized[teamId] ? maps.normalized[teamId] : {};
  const cleanName = String(studentName || '').trim();
  return exact[cleanName] || normalized[normalizeStudentReportKey_(cleanName)] || null;
}

function findUnifiedWeekRangeForDayRow_(sheet, dayRow) {
  const lastRow = sheet.getLastRow();
  let weekRow = 0;

  for (let r = dayRow - 1; r >= 3; r--) {
    const text = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!text) continue;
    if (parseUnifiedDayLabel_(text)) continue;
    if (text.indexOf('الأسبوع') === 0) {
      weekRow = r;
      break;
    }
    // وصلنا صف الطالب قبل العثور على الأسبوع.
    break;
  }

  if (!weekRow) return null;

  let firstDay = weekRow + 1;
  let lastDay = firstDay - 1;
  for (let r = firstDay; r <= lastRow; r++) {
    const text = String(sheet.getRange(r, 1).getDisplayValue() || '').trim();
    if (!parseUnifiedDayLabel_(text)) break;
    lastDay = r;
  }

  if (lastDay < firstDay) return null;
  return { weekRow, firstDay, lastDay };
}

function recalcUnifiedWeekRowFromDayRows_(sheet, weekRange) {
  if (!weekRange) return false;
  const count = weekRange.lastDay - weekRange.firstDay + 1;
  if (count <= 0) return false;

  const values = sheet.getRange(weekRange.firstDay, 1, count, UNIFIED_HEADERS.length).getDisplayValues();
  const details = [];

  values.forEach(row => {
    const info = parseUnifiedDayLabel_(row[0]);
    if (!info) return;
    const dayDate = parseDate(info.dateStr);
    details.push({
      day: info.day,
      dateStr: info.dateStr,
      hudur: String(row[1] || '').trim(),
      hifzFrom: String(row[2] || '').trim(),
      hifzTo: String(row[3] || '').trim(),
      hifzScore: row[4] || '',
      muraFrom: String(row[5] || '').trim(),
      muraTo: String(row[6] || '').trim(),
      muraScore: row[7] || '',
      haqiba: String(row[8] || '').trim(),
      istima: String(row[9] || '').trim(),
      points: Number(row[10]) || 0,
      target: Number(row[11]) || (dayDate ? getDayTargetForDate(dayDate) : 100),
      note: String(row[12] || '').trim()
    });
  });

  const summary = summarizeUnifiedWeek(details);
  sheet.getRange(weekRange.weekRow, 2, 1, UNIFIED_HEADERS.length - 1).setValues([[
    summary.present + ' يوم حضور / ' + summary.absent + ' غياب',
    summary.hifzFrom,
    summary.hifzTo,
    summary.hifzScore,
    summary.muraFrom,
    summary.muraTo,
    summary.muraScore,
    summary.haqibaCount,
    summary.istimaCount,
    summary.total,
    summary.target,
    summary.target ? summary.total / summary.target : 0
  ]]);
  sheet.getRange(weekRange.weekRow, 11, 1, 2).setNumberFormat('0');
  sheet.getRange(weekRange.weekRow, 13).setNumberFormat('0%');
  recalcUnifiedStudentSummaryForWeekRow_(sheet, weekRange.weekRow);
  return true;
}

function syncOneUnifiedReportSheetForDate_(sheet, teamId, targetDate, logMapsForDate, studentFilter) {
  const result = {
    teamId,
    teamName: TEAM_SHEETS[teamId] || teamId,
    sheetName: sheet ? sheet.getName() : '',
    dayRowsFound: 0,
    updatedRows: 0,
    weekRowsUpdated: 0,
    summaryRowsUpdated: 0,
    studentFound: !studentFilter,
    missingStudent: '',
    reportDateFound: false
  };

  if (!sheet) return result;
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return result;

  const normalizedTargetDate = normalizeDate(targetDate);
  const filterKey = normalizeStudentReportKey_(studentFilter || '');
  const labels = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
  const dayDate = parseDate(normalizedTargetDate);
  const matches = [];
  const weekRanges = {};

  let currentStudent = '';
  let currentStudentKey = '';
  let activeWeek = null;

  // قراءة عمود A مرة واحدة فقط. النسخة القديمة كانت تستدعي getRange مراراً
  // لكل صف، وهذا كان يبطئ تقرير حلقة ثالث خصوصاً ويؤخر الاستبدال.
  labels.forEach((row, index) => {
    const rowNumber = index + 3;
    const text = String(row[0] || '').trim();
    if (!text) return;

    const dayInfo = parseUnifiedDayLabel_(text);
    if (dayInfo) {
      if (activeWeek) activeWeek.lastDay = rowNumber;
      const rowDate = normalizeDate(dayInfo.dateStr);
      if (rowDate === normalizedTargetDate) {
        result.reportDateFound = true;
        if (!filterKey || currentStudentKey === filterKey) {
          matches.push({
            rowNumber,
            studentName: currentStudent,
            weekRow: activeWeek ? activeWeek.weekRow : 0
          });
        }
      }
      return;
    }

    const weekIndex = getUnifiedWeekIndexFromLabel_(text);
    if (weekIndex > 0) {
      activeWeek = {
        weekRow: rowNumber,
        firstDay: rowNumber + 1,
        lastDay: rowNumber,
        weekIndex
      };
      weekRanges[rowNumber] = activeWeek;
      return;
    }

    if (isCircleWeeklySummaryLabel_(text) || isCircleDailySummaryLabel_(text)) {
      activeWeek = null;
      return;
    }

    if (isFirstCircleTrackSectionLabel_(text) || isUnifiedTrackHeaderLabel_(text)) {
      activeWeek = null;
      return;
    }

    // أي نص آخر في العمود A داخل جسم التقرير هو صف اسم طالب.
    currentStudent = text.replace('👤', '').split('—')[0].trim();
    currentStudentKey = normalizeStudentReportKey_(currentStudent);
    activeWeek = null;
    if (filterKey && currentStudentKey === filterKey) result.studentFound = true;
  });

  result.dayRowsFound = matches.length;

  const weeksToRecalc = {};
  matches.forEach(item => {
    const saved = getSavedRowForReportStudent_(logMapsForDate, teamId, item.studentName);
    const detail = makeUnifiedDayDetail(dayDate || parseDate(normalizedTargetDate), normalizedTargetDate, saved);

    sheet.getRange(item.rowNumber, 2, 1, UNIFIED_HEADERS.length - 1).setValues([[
      detail.hudur,
      detail.hifzFrom,
      detail.hifzTo,
      detail.hifzScore,
      detail.muraFrom,
      detail.muraTo,
      detail.muraScore,
      detail.haqiba,
      detail.istima,
      detail.points,
      detail.target,
      detail.note
    ]]);
    sheet.getRange(item.rowNumber, 11, 1, 2).setNumberFormat('0');
    result.updatedRows++;

    if (item.weekRow && weekRanges[item.weekRow]) {
      weeksToRecalc[item.weekRow] = weekRanges[item.weekRow];
    }
  });

  Object.keys(weeksToRecalc).forEach(key => {
    const weekRange = weeksToRecalc[key];
    if (recalcUnifiedWeekRowFromDayRows_(sheet, weekRange)) {
      result.weekRowsUpdated++;
      if (ENABLE_CIRCLE_WEEKLY_SUMMARY) {
        result.summaryRowsUpdated += recalcCircleWeeklySummaryRows_(sheet, weekRange.weekIndex);
      }
    }
  });

  if (filterKey && !result.studentFound) result.missingStudent = String(studentFilter || '').trim();
  return result;
}

function syncUnifiedReportAfterSave_(ss, dateStr, teamId, studentName) {
  // تحديث سريع ومباشر بعد الحفظ أو الاستبدال.
  const targetDate = mapRequestedDateToSchoolDay_(dateStr);
  const normalizedTeamId = normalizeTeamId(teamId);
  if (!targetDate || !normalizedTeamId) throw new Error('بيانات تحديث التقرير غير مكتملة');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    throw new Error('تقرير الحلقة مشغول الآن؛ سيُحدّث من الطابور بدون تعطيل التسجيل');
  }

  try {
    const logSheet = getOrCreateLogSheet(ss);
    const maps = readLogRowsForDateByTeamStudent_(logSheet, targetDate);
    let sheet = getReportSheetForTeam_(ss, normalizedTeamId);

    if (!sheet) {
      generateUnifiedReportForTeamOnly(normalizedTeamId, targetDate);
      sheet = getReportSheetForTeam_(ss, normalizedTeamId);
    }

    let result = syncOneUnifiedReportSheetForDate_(sheet, normalizedTeamId, targetDate, maps, studentName || '');

    // إعادة البناء فقط عند غياب اسم الطالب أو غياب تاريخ اليوم فعلاً من بنية التقرير.
    // لا نعيد البناء بسبب اختلاف مسافة أو حرف عربي بسيط في الاسم.
    if (studentName && (!result.studentFound || result.dayRowsFound === 0)) {
      generateUnifiedReportForTeamOnly(normalizedTeamId, targetDate);
      sheet = getReportSheetForTeam_(ss, normalizedTeamId);
      result = syncOneUnifiedReportSheetForDate_(sheet, normalizedTeamId, targetDate, maps, studentName || '');
      result.rebuiltBecauseStructureWasMissing = true;
    }

    SpreadsheetApp.flush();
    return result;
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function syncUnifiedReportsForDateNow_(dateStr, teamId, studentName) {
  // دالة تشغيل يدوي/احتياطي: تحدث تقارير اليوم لكل الحلقات أو حلقة محددة.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const targetDate = mapRequestedDateToSchoolDay_(dateStr);
  if (!targetDate) throw new Error('التاريخ غير صحيح');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const logSheet = getOrCreateLogSheet(ss);
    const maps = readLogRowsForDateByTeamStudent_(logSheet, targetDate);
    const oneTeam = normalizeTeamId(teamId || '');
    const teams = oneTeam ? [oneTeam] : Object.keys(TEAM_SHEETS);
    const details = [];

    teams.forEach(id => {
      let sheet = getReportSheetForTeam_(ss, id);
      if (!sheet || (ENABLE_CIRCLE_WEEKLY_SUMMARY && !hasCircleWeeklySummaryRows_(sheet))) {
        generateUnifiedReportForTeamOnly(id, targetDate);
        sheet = getReportSheetForTeam_(ss, id);
      }
      details.push(syncOneUnifiedReportSheetForDate_(sheet, id, targetDate, maps, studentName || ''));
    });

    SpreadsheetApp.flush();
    const totalRows = details.reduce((sum, item) => sum + (Number(item.updatedRows) || 0), 0);
    return {
      status: 'synced',
      date: targetDate,
      updatedRows: totalRows,
      details,
      message: 'تم تحديث تقارير الحلقات لتاريخ ' + targetDate + ' — عدد الصفوف المحدثة: ' + totalRows
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function syncTodayReportsNow() {
  return syncUnifiedReportsForDateNow_('', '', '');
}

/**
 * يحذف صفوف ملخص الحلقة الأسبوعي الموجودة حالياً من تقارير الحلقات الأربع.
 * شغّل هذه الدالة مرة واحدة من محرر Apps Script بعد تركيب هذا الملف.
 * لا يحذف أسماء الطلاب أو الأسابيع أو الأيام أو أي تسجيلات.
 */
function removeCircleWeeklySummariesNow() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const details = [];
  let totalDeleted = 0;

  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    const sheet = getReportSheetForTeam_(ss, teamId);
    if (!sheet) {
      details.push({ teamId: teamId, sheet: UNIFIED_PREFIX + TEAM_SHEETS[teamId], deleted: 0, missing: true });
      return;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      details.push({ teamId: teamId, sheet: sheet.getName(), deleted: 0 });
      return;
    }

    const labels = sheet.getRange(3, 1, lastRow - 2, 1).getDisplayValues();
    const rowsToDelete = [];
    labels.forEach(function(row, index) {
      if (isCircleWeeklySummaryLabel_(row[0]) || isCircleDailySummaryLabel_(row[0])) rowsToDelete.push(index + 3);
    });

    // الحذف من الأسفل للأعلى حتى لا تتغير أرقام الصفوف أثناء العملية.
    rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
      sheet.deleteRow(rowNumber);
    });

    totalDeleted += rowsToDelete.length;
    details.push({ teamId: teamId, sheet: sheet.getName(), deleted: rowsToDelete.length });
  });

  SpreadsheetApp.flush();
  return {
    status: 'removed',
    totalDeleted: totalDeleted,
    details: details,
    message: totalDeleted
      ? 'تم حذف ' + totalDeleted + ' صفوف ملخص من تقارير الحلقات.'
      : 'لا توجد صفوف ملخص ظاهرة حالياً.'
  };
}

function rebuildAllCircleWeeklyPercentReportsNow() {
  // لا نبني التقارير الأربعة في تنفيذ واحد؛ لأن Apps Script يوقف التنفيذ بعد قرابة 6 دقائق.
  // نضع الحلقات الأربع في الطابور، نبني حلقة واحدة الآن، ثم يكمل التريجر حلقة واحدة كل 5 دقائق.
  markReportsDirty('', '');
  createFastReportsTrigger();

  const firstResult = runReportQueueNow(1, 240000);
  const remaining = firstResult && firstResult.remainingTeams
    ? firstResult.remainingTeams.length
    : 0;

  return {
    status: remaining > 0 ? 'queued' : 'done',
    message: remaining > 0
      ? 'تم تحديث أول تقرير، وباقي ' + remaining + ' تقارير ستتحدث تلقائياً، تقرير واحد كل 5 دقائق. لا تعِد تشغيل الدالة.'
      : 'تم تحديث جميع تقارير الحلقات.',
    firstResult: firstResult
  };
}

function rebuildNextCircleWeeklyPercentReportNow() {
  // تشغيل يدوي اختياري لتسريع الطابور: كل ضغطة Run تبني تقرير حلقة واحدة فقط.
  return runReportQueueNow(1, 240000);
}

function getCircleWeeklyPercentRebuildStatus() {
  // يعرض الحلقات التي ما زالت في انتظار إعادة البناء.
  return debugReportsQueueStatus();
}

function syncBlueTodayReportNow() {
  return syncUnifiedReportsForDateNow_('', 'blue', '');
}

function syncRedTodayReportNow() {
  return syncUnifiedReportsForDateNow_('', 'red', '');
}

function syncPurpleTodayReportNow() {
  return syncUnifiedReportsForDateNow_('', 'purple', '');
}

function normalizeDirtyTeamsList(value) {
  const seen = {};
  const out = [];
  String(value || '').split(',').forEach(id => {
    id = normalizeTeamId(id);
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push(id);
  });
  return out;
}

function setDirtyTeamsList(list) {
  const props = PropertiesService.getScriptProperties();
  const clean = normalizeDirtyTeamsList((list || []).join(','));
  if (clean.length) {
    props.setProperty(REPORTS_DIRTY_TEAMS_KEY, clean.join(','));
    props.setProperty(REPORTS_DIRTY_KEY, '1');
  } else {
    props.deleteProperty(REPORTS_DIRTY_TEAMS_KEY);
    props.deleteProperty(REPORTS_DIRTY_KEY);
  }
}

function markReportsDirty(dateStr, teamId) {
  const props = PropertiesService.getScriptProperties();
  const current = normalizeDirtyTeamsList(props.getProperty(REPORTS_DIRTY_TEAMS_KEY) || '');

  if (teamId) {
    const id = normalizeTeamId(teamId);
    if (id && current.indexOf(id) === -1) current.push(id);
  } else {
    Object.keys(TEAM_SHEETS).forEach(id => {
      if (current.indexOf(id) === -1) current.push(id);
    });
  }

  props.setProperty(REPORTS_DIRTY_KEY, '1');
  props.setProperty(REPORTS_DIRTY_TEAMS_KEY, current.join(','));
  if (dateStr) props.setProperty(REPORTS_LAST_DATE_KEY, String(dateStr));
  if (teamId) props.setProperty(REPORTS_LAST_TEAM_KEY, String(teamId));
  props.setProperty('REPORTS_DIRTY_AT', Utilities.formatDate(new Date(), APP_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
}

function areReportsDirty() {
  return PropertiesService.getScriptProperties().getProperty(REPORTS_DIRTY_KEY) === '1';
}

function clearReportsDirty() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(REPORTS_DIRTY_KEY);
  props.deleteProperty(REPORTS_DIRTY_TEAMS_KEY);
}

function markReportEditingActive_() {
  PropertiesService.getScriptProperties().setProperty(
    REPORT_EDIT_ACTIVE_UNTIL_KEY,
    String(Date.now() + REPORT_EDIT_GRACE_MS)
  );
}

function isReportEditingActive_() {
  const props = PropertiesService.getScriptProperties();
  const until = Number(props.getProperty(REPORT_EDIT_ACTIVE_UNTIL_KEY) || 0);
  if (!Number.isFinite(until) || until <= 0) return false;
  if (Date.now() < until) return true;
  props.deleteProperty(REPORT_EDIT_ACTIVE_UNTIL_KEY);
  return false;
}

function manualReportEditKey_(dateStr, teamId, studentName) {
  return MANUAL_REPORT_EDIT_PREFIX + v6Hash_(v6StudentIdentity_(dateStr, teamId, studentName));
}

function readManualReportProtection_(dateStr, teamId, studentName) {
  const props = PropertiesService.getScriptProperties();
  const key = manualReportEditKey_(dateStr, teamId, studentName);
  const raw = String(props.getProperty(key) || '').trim();
  if (!raw) return { key: key, until: 0, overrides: {} };

  // توافق مع النسخة السابقة التي كانت تخزن وقت الانتهاء كرقم فقط.
  const numericUntil = Number(raw);
  if (Number.isFinite(numericUntil) && numericUntil > 0) {
    return { key: key, until: numericUntil, overrides: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      key: key,
      until: Number(parsed && parsed.until) || 0,
      overrides: parsed && parsed.overrides && typeof parsed.overrides === 'object'
        ? parsed.overrides
        : {}
    };
  } catch (_) {
    return { key: key, until: 0, overrides: {} };
  }
}

function markManualReportEntryProtected_(dateStr, teamId, studentName, overrides) {
  const props = PropertiesService.getScriptProperties();
  const current = readManualReportProtection_(dateStr, teamId, studentName);
  const mergedOverrides = Object.assign({}, current.overrides || {}, overrides || {});
  props.setProperty(
    current.key,
    JSON.stringify({
      until: Date.now() + MANUAL_REPORT_EDIT_PROTECT_MS,
      overrides: mergedOverrides
    })
  );
}

function isManualReportEntryProtected_(dateStr, teamId, studentName) {
  const props = PropertiesService.getScriptProperties();
  const protection = readManualReportProtection_(dateStr, teamId, studentName);
  if (protection.until > Date.now()) return true;
  if (protection.until || Object.keys(protection.overrides || {}).length) {
    props.deleteProperty(protection.key);
  }
  return false;
}

function buildManualReportOverridesFromPayload_(data, editedCol, numCols) {
  const overrides = {};
  const endCol = editedCol + numCols - 1;

  function included(col) {
    return col >= editedCol && col <= endCol;
  }

  if (included(2)) overrides.hudur = normalizeAttendance(data.hudur);
  if (included(3)) overrides.hifzFrom = String(data.hifzFrom || '').trim();
  if (included(4)) overrides.hifzTo = String(data.hifzTo || '').trim();
  if (included(5)) overrides.hifzScore = normalizeScore(data.hifzScore);
  if (included(6)) overrides.muraFrom = String(data.muraFrom || '').trim();
  if (included(7)) overrides.muraTo = String(data.muraTo || '').trim();
  if (included(8)) overrides.muraScore = normalizeScore(data.muraScore);
  if (included(9)) overrides.haqiba = normalizeYesNo(data.haqiba);
  if (included(10)) overrides.istima = normalizeYesNo(data.istima);
  if (included(11)) overrides.totalPoints = Number(data.totalPoints) || 0;
  if (included(13)) overrides.notes = String(data.notes || '').trim();

  return overrides;
}

function applyManualReportOverrides_(data, dateStr, teamId, studentName) {
  const protection = readManualReportProtection_(dateStr, teamId, studentName);
  if (!(protection.until > Date.now())) return data || {};

  const overrides = protection.overrides || {};
  if (!Object.keys(overrides).length) return data || {};

  const out = Object.assign({}, data || {});
  Object.keys(overrides).forEach(function(field) {
    out[field] = overrides[field];
  });
  return out;
}

function cleanupManualReportEditProtection_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const now = Date.now();
  let removed = 0;
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(MANUAL_REPORT_EDIT_PREFIX) !== 0) return;

    const raw = String(all[key] || '').trim();
    let until = Number(raw);
    if (!Number.isFinite(until)) {
      try {
        const parsed = JSON.parse(raw);
        until = Number(parsed && parsed.until) || 0;
      } catch (_) {
        until = 0;
      }
    }

    if (!Number.isFinite(until) || until <= now) {
      props.deleteProperty(key);
      removed++;
    }
  });
  return removed;
}

// شغّلها مرة واحدة بعد تركيب هذا الملف.
// توقف أي تحديث قديم متكرر كان يعيد بناء التقرير أثناء التعديل،
// تنظف الطابور القديم، وتضمن وجود تريجر واحد فقط لتعديل التقرير.
function installStableManualReportEditingFix() {
  const props = PropertiesService.getScriptProperties();

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshReportsIfDirty')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'handleUnifiedReportEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));

  clearReportsDirty();
  props.deleteProperty(REPORTS_LAST_DATE_KEY);
  props.deleteProperty(REPORTS_LAST_TEAM_KEY);
  props.deleteProperty('REPORTS_DIRTY_AT');
  props.deleteProperty(REPORT_EDIT_ACTIVE_UNTIL_KEY);

  ScriptApp.newTrigger('handleUnifiedReportEdit')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onEdit()
    .create();

  return 'تم تثبيت التعديل المستقر: لن يعاد بناء التقرير بالكامل عند تعديل الخلايا، وتم إيقاف طابور التحديث القديم.';
}

function refreshReportsIfDirty() {
  // لا نعيد بناء التقرير أثناء تعديل المعلم؛ إعادة البناء كانت سبب اختفاء المحتوى
  // وإغلاق قائمة الحضور/الغياب على الجوال قبل اختيار القيمة.
  if (isReportEditingActive_()) {
    return 'تم تأجيل تحديث التقرير لأن هناك تعديلاً يدوياً جارياً';
  }

  // تعالج حلقة واحدة فقط حتى لا يحصل timeout داخل التريجر.
  const result = runReportQueueNow(1, 240000);
  return result.message || JSON.stringify(result);
}

function runReportQueueNow(maxTeams, maxMillis) {
  // تحديث فوري لطابور التقارير.
  // AdminPage يشغل هذه الدالة بعد الحفظ بدون انتظارها، لذلك التسجيل يبقى سريعاً
  // والتقرير يبدأ يتحدث خلال ثواني بدل انتظار التريجر فقط.
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty(REPORTS_DIRTY_KEY) !== '1') {
    Logger.log('runReportQueueNow: no pending changes');
    return {
      status: 'idle',
      message: 'لا توجد تغييرات تحتاج تحديث',
      remainingTeams: [],
      updatedTeams: []
    };
  }

  maxTeams = Number(maxTeams || 4);
  if (!Number.isFinite(maxTeams) || maxTeams <= 0) maxTeams = 4;
  maxTeams = Math.max(1, Math.min(maxTeams, Object.keys(TEAM_SHEETS).length));

  maxMillis = Number(maxMillis || 240000);
  if (!Number.isFinite(maxMillis) || maxMillis <= 0) maxMillis = 240000;
  // نترك هامشاً قبل حد Apps Script حتى لا تنقطع العملية وهي تكتب في الشيت.
  maxMillis = Math.max(15000, Math.min(maxMillis, 300000));

  const startedAt = Date.now();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(7000)) {
    Logger.log('runReportQueueNow: skipped because another refresh is running');
    return {
      status: 'busy',
      message: 'تحديث آخر للتقارير يعمل الآن',
      remainingTeams: normalizeDirtyTeamsList(props.getProperty(REPORTS_DIRTY_TEAMS_KEY) || ''),
      updatedTeams: []
    };
  }

  const updatedTeams = [];
  try {
    let teams = normalizeDirtyTeamsList(props.getProperty(REPORTS_DIRTY_TEAMS_KEY) || '');
    if (!teams.length) teams = Object.keys(TEAM_SHEETS);

    const lastDate = props.getProperty(REPORTS_LAST_DATE_KEY) || '';

    while (teams.length && updatedTeams.length < maxTeams && Date.now() - startedAt < maxMillis) {
      const teamId = teams.shift();
      if (!teamId) continue;

      Logger.log('runReportQueueNow: rebuilding team=' + teamId + ' date=' + lastDate);
      SpreadsheetApp.flush();
      generateUnifiedReportForTeamOnly(teamId, lastDate);
      SpreadsheetApp.flush();

      updatedTeams.push({
        teamId: teamId,
        teamName: TEAM_SHEETS[teamId] || teamId
      });
    }

    if (teams.length) {
      setDirtyTeamsList(teams);
      const msg = 'تم تحديث ' + updatedTeams.length + ' تقرير وباقي ' + teams.length + ' في الانتظار';
      Logger.log(msg);
      return {
        status: 'partial',
        message: msg,
        updatedTeams: updatedTeams,
        remainingTeams: teams
      };
    }

    clearReportsDirty();
    const doneMsg = updatedTeams.length
      ? 'تم تحديث كل التقارير المعلقة: ' + updatedTeams.map(t => t.teamName).join('، ')
      : 'لا توجد تقارير معلقة';
    Logger.log(doneMsg);
    return {
      status: 'done',
      message: doneMsg,
      updatedTeams: updatedTeams,
      remainingTeams: []
    };
  } catch (err) {
    Logger.log('runReportQueueNow ERROR: ' + err.message);
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function createFastReportsTrigger() {
  // تحديث التقارير بالخلفية كل دقيقة. لا تُستدعى هذه الدالة مع كل تسجيل؛
  // شغّل AAA_INSTALL_FAST_REGISTRATION مرة واحدة بعد تركيب هذا الإصدار.
  const existing = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshReportsIfDirty');

  if (existing.length) {
    Logger.log('✅ تريجر تحديث التقارير موجود مسبقاً');
    return 'تريجر تحديث التقارير موجود مسبقاً';
  }

  ScriptApp.newTrigger('refreshReportsIfDirty')
    .timeBased()
    .everyMinutes(1)
    .create();

  Logger.log('✅ تم إنشاء تريجر تحديث التقارير بالخلفية كل دقيقة');
  return 'تم إنشاء تريجر تحديث التقارير بالخلفية كل دقيقة';
}

// شغّل هذه الدالة مرة واحدة بعد استبدال Code.gs.
// اسمها يبدأ بـ AAA حتى تظهر في أعلى قائمة الدوال داخل Apps Script.
function AAA_INSTALL_FAST_REGISTRATION() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'refreshReportsIfDirty'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('refreshReportsIfDirty')
    .timeBased()
    .everyMinutes(1)
    .create();

  clearReportsDirty();
  Logger.log('✅ تم تفعيل الحفظ السريع: التسجيل يرجع فوراً، والتقارير تتحدث بالخلفية كل دقيقة.');
  return {
    status: 'ok',
    saveMode: 'fast',
    reportUpdate: 'background-every-minute',
    message: 'تم تفعيل الحفظ السريع وتحديث التقارير بالخلفية كل دقيقة'
  };
}

function debugReportsQueueStatus() {
  const props = PropertiesService.getScriptProperties();
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshReportsIfDirty')
    .map(t => ({ handler: t.getHandlerFunction(), eventType: String(t.getEventType()) }));

  const result = {
    dirty: props.getProperty(REPORTS_DIRTY_KEY) === '1',
    lastDate: props.getProperty(REPORTS_LAST_DATE_KEY) || '',
    lastTeam: props.getProperty(REPORTS_LAST_TEAM_KEY) || '',
    dirtyTeams: props.getProperty(REPORTS_DIRTY_TEAMS_KEY) || '',
    dirtyAt: props.getProperty('REPORTS_DIRTY_AT') || '',
    backgroundTriggersCount: triggers.length,
    triggers
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function debugWeeklyReportStatus(baseDateValue) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);
  const today = startOfDay(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const requested = parseDate(dateValueToString(baseDateValue));
  const base = requested || getWeeklyReportBaseDate(logSheet, today);
  const sunday = getWeekStart(base);

  const weekDates = SESSION_DAYS.map(d => formatDate(addDays(sunday, d)));
  const keysInThisWeek = Object.keys(logMaps.byKey).filter(key => {
    const datePart = key.split('|')[0];
    return weekDates.indexOf(datePart) !== -1;
  });

  const result = {
    today: formatDate(today),
    reportBaseDate: formatDate(base),
    weekStart: formatDate(sunday),
    weekDates,
    logRows: Math.max(0, logSheet.getLastRow() - 1),
    matchingRowsThisWeek: keysInThisWeek.length,
    sampleMatchingKeys: keysInThisWeek.slice(0, 10)
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function rebuildReportsNow() {
  // تحديث يدوي آمن: لا يبني كل الحلقات دفعة واحدة.
  // شغله ثم شغل runOneQueuedReportNow عدة مرات حتى تنتهي القائمة.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    SpreadsheetApp.flush();
    markReportsDirty('', '');
    createFastReportsTrigger();
    const result = refreshReportsIfDirty();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}


function rebuildWeeklyNow() {
  // للتوافق مع الاسم القديم: يضع التقرير الموحد في قائمة التحديث الآمنة.
  SpreadsheetApp.flush();
  markReportsDirty('', '');
  createFastReportsTrigger();
  const updateResult = refreshReportsIfDirty();
  SpreadsheetApp.flush();
  const debugResult = debugLastAdminRecordToWeekly();
  return { updateResult: updateResult, debugResult: debugResult };
}

function debugLastAdminRecordToWeekly() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);

  const lastRow = logSheet.getLastRow();
  if (lastRow <= 1) {
    const empty = { status: 'empty', message: 'لا توجد بيانات في شيت البيانات' };
    Logger.log(JSON.stringify(empty, null, 2));
    return empty;
  }

  const row = logSheet.getRange(lastRow, 1, 1, HEADERS.length).getValues()[0];
  const dateStr = dateValueToString(row[COL.DATE - 1]);
  const student = String(row[COL.STUDENT - 1] || '').trim();
  let teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
  if (!teamId) teamId = inferTeamIdForStudent(student, rosterMap);

  const key = dateStr + '|' + teamId + '|' + student;
  const d = parseDate(dateStr);
  const sunday = d ? getWeekStart(d) : null;
  const weekDates = sunday ? SESSION_DAYS.map(dayIndex => formatDate(addDays(sunday, dayIndex))) : [];

  const result = {
    lastRow,
    dateStr,
    student,
    teamId,
    key,
    keyExistsInWeeklyMap: !!logMaps.byKey[key],
    weekStart: sunday ? formatDate(sunday) : '',
    weekDates,
    expectedWeeklySheet: teamId ? (WEEKLY_PREFIX + TEAM_SHEETS[teamId]) : '',
    message: logMaps.byKey[key] ? 'آخر تسجيل موجود داخل خريطة التقرير الأسبوعي' : 'آخر تسجيل غير مطابق للتقرير الأسبوعي، افحص التاريخ/الحلقة/اسم الطالب'
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function runAbsenceNowAndRefreshReports() {
  // تشغيل يدوي: يسجل غياب آخر يوم دراسي انتهى (وليس اليوم الجاري)، ثم يحدث تقرير حلقة واحدة فقط لتجنب timeout.
  // ملاحظة: لن يكرر الغياب إذا الطالب لديه سجل اليوم.
  markAbsences();
  SpreadsheetApp.flush();
  markReportsDirty('', '');
  createFastReportsTrigger();
  const result = refreshReportsIfDirty();
  return 'تم تسجيل الغياب، وبدأ تحديث التقارير بالخلفية. آخر نتيجة: ' + result;
}

function REMOVE_EARLY_AUTO_ABSENCES_NOW() {
  // تنظيف لمرة واحدة: يحذف «الغياب التلقائي» المكتوب ليوم ما زال جارياً (اليوم الدراسي الحالي)
  // بسبب الخطأ القديم في وقت التريجر. لا يحذف إلا صفوف الغياب التلقائي الخالية من أي نشاط،
  // وأي طالب سجّله المعلم يبقى كما هو.
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const dateStr = normalizeDate(getSchoolDayDateStr_());
  const lastRow = logSheet.getLastRow();
  if (lastRow < 2) return 'لا توجد بيانات';

  const values = logSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  const rowsToDelete = [];
  const teams = {};
  values.forEach(function(row, index) {
    if (dateValueToString(row[COL.DATE - 1]) !== dateStr) return;
    if (String(row[COL.NOTE - 1] || '').trim() !== '🔴 غياب تلقائي') return;
    if (String(row[COL.HUDUR - 1] || '').trim() !== 'غائب') return;
    const hasActivity =
      String(row[COL.HIFZ_SCORE - 1] || '').trim() ||
      String(row[COL.MURA_SCORE - 1] || '').trim() ||
      String(row[COL.HAQIBA - 1] || '').trim() === 'نعم' ||
      String(row[COL.ISTIMA - 1] || '').trim() === 'نعم';
    if (hasActivity) return;
    rowsToDelete.push(index + 2);
    const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    if (teamId) teams[teamId] = true;
  });

  rowsToDelete.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
    logSheet.deleteRow(rowNumber);
  });
  SpreadsheetApp.flush();

  Object.keys(teams).forEach(function(teamId) { markReportsDirty(dateStr, teamId); });
  const msg = 'تم حذف ' + rowsToDelete.length + ' غياب تلقائي مبكر ليوم ' + dateStr +
    '. شغّل rebuild...ReportNow للحلقات حتى تتحدث التقارير.';
  Logger.log(msg);
  return msg;
}

function createAllTriggers() {
  // شغل هذه الدالة مرة واحدة بعد لصق الكود.
  createDailyAbsenceTrigger();

  if (typeof createFastReportsTrigger === 'function') {
    createFastReportsTrigger();
  }

  Logger.log('✅ تم إنشاء تريجر الغياب + تريجر تحديث التقارير');
  return 'تم إنشاء التريجرات المطلوبة';
}

function debugAbsenceTodayStatus() {
  const today = getTodayInAppTimezone ? getTodayInAppTimezone() : new Date();
  const dateStr = formatDate(today);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rosterMap = getAllTeamStudents(ss);
  const logSheet = getOrCreateLogSheet(ss);
  const out = {
    timezone: APP_TIMEZONE,
    today: dateStr,
    dayIndex: today.getDay(),
    isSessionDay: SESSION_DAYS.includes(today.getDay()),
    studentsByTeam: {},
    missingTodayByTeam: {}
  };

  Object.keys(TEAM_SHEETS).forEach(teamId => {
    const names = rosterMap[teamId] || [];
    out.studentsByTeam[teamId] = names.length;
    out.missingTodayByTeam[teamId] = names.filter(name => findLogRow(logSheet, dateStr, name, teamId) === 0);
  });

  Logger.log(JSON.stringify(out, null, 2));
  return out;
}


function setupUnifiedFastSystem() {
  // شغل هذه الدالة مرة واحدة بعد لصق الكود والنشر.
  // تجهز تحديث التقارير بالخلفية، وتفعل تعديل تقرير الحلقة وتعديل أسماء الطلاب من داخل الشيت.
  createFastReportsTrigger();
  createDailyAbsenceTrigger();
  createUnifiedEditTrigger();
  createRosterEditTrigger();
  markReportsDirty('', '');
  return 'تم تجهيز النظام ووضع التقارير في قائمة التحديث. شغل runOneQueuedReportNow الآن لتحديث حلقة واحدة أو انتظر التريجر.';
}

// ══════════════════════════════════════════════════════════════
//  Triggers اختيارية
// ══════════════════════════════════════════════════════════════
function createDailyAbsenceTrigger() {
  // تريجر الغياب التلقائي يومياً الساعة 6:00 صباحاً بتوقيت السعودية:
  // أي طالب لم يُسجل له حتى هذا الوقت يُحسب غياباً لليوم الدراسي المنتهي.
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'markAbsences')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('markAbsences')
    .timeBased()
    .inTimezone(APP_TIMEZONE)
    .atHour(6)
    .nearMinute(0)
    .everyDays(1)
    .create();

  Logger.log('✅ تم إنشاء تريجر الغياب التلقائي يومياً الساعة 6 صباحاً بتوقيت السعودية');
}


function INSTALL_AUTO_ATTENDANCE_AND_DAILY_ABSENCE() {
  createDailyAbsenceTrigger();
  Logger.log('✅ تم تفعيل الحضور التلقائي عند التسجيل والغياب التلقائي يومياً الساعة 6 صباحاً بتوقيت السعودية.');
  return {
    status: 'ok',
    attendance: 'أي طالب يتم تسجيله = حاضر تلقائياً',
    absenceTrigger: 'يومياً الساعة 6 صباحاً بتوقيت السعودية (نهاية اليوم الدراسي)',
    handler: 'markAbsences'
  };
}

function debugAbsenceTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'markAbsences')
    .map(t => ({
      handler: t.getHandlerFunction(),
      source: String(t.getTriggerSource()),
      eventType: String(t.getEventType())
    }));

  Logger.log(JSON.stringify({
    timezone: APP_TIMEZONE,
    today: formatDate(getTodayInAppTimezone()),
    dayIndex: getTodayInAppTimezone().getDay(),
    sessionDays: SESSION_DAYS,
    markAbsencesTriggersCount: triggers.length,
    triggers
  }, null, 2));

  return triggers.length;
}

function createWeeklyEditTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'handleWeeklyEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('handleWeeklyEdit')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onEdit()
    .create();
}

function createUnifiedEditTrigger() {
  // مهم: هذا التريجر هو الذي يجعل تعديل شيت "تقرير الحلقة" يرجع إلى ورقة "البيانات".
  // بدونه سيبقى التعديل شكلياً داخل التقرير فقط، ولن تتحدث المجاميع أو الغياب.
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'handleUnifiedReportEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('handleUnifiedReportEdit')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onEdit()
    .create();

  Logger.log('✅ تم إنشاء تريجر تعديل تقرير الحلقة الموحد');
}


// ============================================================================
// إعداد المدرسة الجديد:
// 1) حلقة أولى مثل بقية الحلقات تماماً، بلا مسار وبلا ألوان خاصة.
// 2) الدورة 3 أسابيع:
//    الأسبوع 1: الإثنين 17/08/2026 إلى الجمعة 21/08/2026
//    الأسبوع 2: السبت 22/08/2026 إلى الجمعة 28/08/2026
//    الأسبوع 3: السبت 29/08/2026 إلى الجمعة 04/09/2026
// شغّل هذه الدالة مرة واحدة بعد استبدال Code.gs.
// ============================================================================
function REMOVE_FIRST_CIRCLE_TRACK_AND_APPLY_SCHOOL_SCHEDULE() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // حذف عمود "المسار" فعلياً من حلقة أولى إن كان موجوداً.
  const blueSheet = findSheetByAliases(ss, TEAM_SHEETS.blue) || ss.getSheetByName(TEAM_SHEETS.blue);
  if (blueSheet) {
    const scanCols = Math.min(Math.max(blueSheet.getLastColumn(), 1), 5);
    const headers = blueSheet.getRange(1, 1, 1, scanCols).getDisplayValues()[0];

    for (let c = headers.length - 1; c >= 1; c--) {
      const header = normalizeHeaderText_(headers[c]);
      if (
        header === normalizeHeaderText_('المسار') ||
        header === normalizeHeaderText_('مسار الطالب')
      ) {
        blueSheet.deleteColumn(c + 1);
      }
    }
  }

  // توحيد جميع أوراق الحلقات: عمود اسم الطالب فقط.
  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    const sheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);
    formatRosterHeader(sheet);
  });

  // إعادة بناء التقارير الأربعة بالتنسيق الموحد والتواريخ الجديدة.
  const rebuilt = [];
  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    generateUnifiedReportForTeamOnly(teamId, '');
    rebuilt.push(UNIFIED_PREFIX + TEAM_SHEETS[teamId]);
  });

  SpreadsheetApp.flush();

  return {
    status: 'ok',
    courseStart: COURSE_START_DATE,
    courseEnd: COURSE_END_DATE,
    weeks: COURSE_WEEKS_COUNT,
    week1: '17/08/2026 - 21/08/2026',
    week2: '22/08/2026 - 28/08/2026',
    week3: '29/08/2026 - 04/09/2026',
    rebuiltReports: rebuilt,
    message: 'تم توحيد حلقة أولى مع بقية الحلقات وحذف المسار والألوان الخاصة وتطبيق برنامج 3 أسابيع.'
  };
}

function APPLY_DIRECT_ROSTER_DELETE_MODE() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const details = [];

  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    const sheet = getOrCreateRosterSheet(ss, TEAM_SHEETS[teamId]);
    const firstCircle = teamId === 'blue';

    // حذف عمود "إجراء" القديم فعلياً إن كان موجوداً.
    const maxCols = sheet.getMaxColumns();
    const scanCols = Math.min(maxCols, 4);
    if (scanCols >= 2) {
      const headers = sheet.getRange(1, 1, 1, scanCols).getDisplayValues()[0];
      for (let c = headers.length - 1; c >= 1; c--) {
        if (normalizeHeaderText_(headers[c]) === normalizeHeaderText_('إجراء')) {
          sheet.deleteColumn(c + 1);
        }
      }
    }

    formatRosterHeader(sheet);

    // القائمة الحالية هي الحقيقة النهائية؛ أي طالب غير موجود فيها يُحذف من البيانات.
    const deletedDataRows = purgeLogStudentsMissingFromRoster_(ss, teamId);

    // إعادة بناء التقرير فوراً من القائمة الحالية.
    generateUnifiedReportForTeamOnly(teamId, '');

    details.push({
      teamId: teamId,
      sheet: sheet.getName(),
      students: readNamesFromRosterSheetRobust_(sheet).length,
      deletedDataRows: deletedDataRows
    });
  });

  // تريجر واحد فقط لمعالجة تعديل/حذف الأسماء.
  createRosterEditTrigger();
  SpreadsheetApp.flush();

  return {
    status: 'ok',
    mode: 'direct-roster-delete',
    details: details,
    message: 'تم حذف عمود إجراء. حذف الاسم من شيت الحلقة أصبح حذفاً نهائياً ويحدّث التقرير مباشرة.'
  };
}

function createRosterEditTrigger() {
  // مهم: هذا التريجر هو الذي يجعل تعديل الاسم في شيت أسماء الحلقة يغير الاسم داخل البيانات والتقرير.
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'handleRosterEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('handleRosterEdit')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onEdit()
    .create();

  Logger.log('✅ تم إنشاء تريجر تعديل أسماء الطلاب من شيت الحلقة');
}

function fixOldDatesAndRebuildReports() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);

  const lastRow = logSheet.getLastRow();
  if (lastRow > 1) {
    const range = logSheet.getRange(2, COL.DATE, lastRow - 1, 1);
    const values = range.getDisplayValues();

    const fixed = values.map(row => [normalizeLegacyDmyDate(row[0])]);
    range.setNumberFormat('@');
    range.setValues(fixed);
  }

  markReportsDirty('', '');
  createFastReportsTrigger();

  SpreadsheetApp.flush();
  return 'تم إصلاح التواريخ ووضع تقارير الحلقات في قائمة التحديث بالخلفية.';
}

function queueAllReportsOnly() {
  markReportsDirty('', '');
  createFastReportsTrigger();
  return 'تم وضع كل تقارير الحلقات في قائمة التحديث بالخلفية.';
}

function runOneQueuedReportNow() {
  return refreshReportsIfDirty();
}

function debugQueuedReportsStatus() {
  return debugReportsQueueStatus();
}

function rebuildBlueReportNow() {
  return generateUnifiedReportForTeamOnly('blue', '');
}

function rebuildRedReportNow() {
  return generateUnifiedReportForTeamOnly('red', '');
}

/**
 * استرجاع آمن لتقرير حلقة ثالث من شيت "البيانات" فقط.
 * لا يحذف ولا يعدّل أي سجل في قاعدة البيانات.
 * يشمل تلقائياً التعديلات اليدوية التي سبق حفظها من تقرير الحلقة إلى شيت البيانات.
 */
function RESTORE_GREEN_REPORT_FROM_DATA_NOW() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getOrCreateLogSheet(ss);
    const rosterMap = getAllTeamStudents(ss);
    const logMaps = readLogRowsByTeamStudentDate(logSheet, rosterMap);
    const courseStart = getCourseStartDate(logSheet, '');

    let greenDataRows = 0;
    let manualEditRows = 0;
    if (logSheet.getLastRow() > 1) {
      const values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
      values.forEach(function(row) {
        const student = String(row[COL.STUDENT - 1] || '').trim();
        const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '') || inferTeamIdForStudent(student, rosterMap);
        if (teamId !== 'green') return;
        greenDataRows++;
        const note = String(row[COL.NOTE - 1] || '');
        if (note.indexOf('تم التعديل من تقرير الحلقة') !== -1) manualEditRows++;
      });
    }

    buildUnifiedReportForTeam(ss, 'green', rosterMap.green || [], logMaps, courseStart);
    SpreadsheetApp.flush();

    return {
      status: 'ok',
      sheet: 'تقرير ' + TEAM_SHEETS.green,
      dataRowsFound: greenDataRows,
      manualEditsFoundInData: manualEditRows,
      message: 'تم استرجاع تقرير حلقة ثالث من شيت البيانات. لم يتم حذف أو تغيير أي سجل من البيانات.'
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function rebuildGreenReportNow() {
  return generateUnifiedReportForTeamOnly('green', '');
}

function DEBUG_GREEN_REPORT_DATA_NOW() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = getOrCreateLogSheet(ss);
  const rosterMap = getAllTeamStudents(ss);
  const stats = { greenRows: 0, manualEditRows: 0, students: {}, dates: {} };
  if (logSheet.getLastRow() > 1) {
    const values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, HEADERS.length).getDisplayValues();
    values.forEach(function(row) {
      const student = String(row[COL.STUDENT - 1] || '').trim();
      const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '') || inferTeamIdForStudent(student, rosterMap);
      if (teamId !== 'green') return;
      const dateStr = normalizeDate(dateValueToString(row[COL.DATE - 1]));
      stats.greenRows++;
      stats.students[student] = (stats.students[student] || 0) + 1;
      if (dateStr) stats.dates[dateStr] = (stats.dates[dateStr] || 0) + 1;
      if (String(row[COL.NOTE - 1] || '').indexOf('تم التعديل من تقرير الحلقة') !== -1) stats.manualEditRows++;
    });
  }
  return {
    status: 'ok',
    greenRows: stats.greenRows,
    manualEditRows: stats.manualEditRows,
    studentCount: Object.keys(stats.students).length,
    dates: stats.dates,
    message: 'تشخيص فقط؛ لم يتم تعديل أي بيانات.'
  };
}

function rebuildPurpleReportNow() {
  return generateUnifiedReportForTeamOnly('purple', '');
}

/**
 * بعد تركيب نسخة التقرير الختامي (5 أسابيع) شغّل هذه الدالة مع رقم الحلقة:
 * 1 = أولى، 2 = ثاني، 3 = ثالث، 4 = رابع.
 * تبني حلقة واحدة مباشرة حتى لا نصطدم بمهلة Apps Script.
 */
function REBUILD_FINAL_FIVE_WEEK_REPORT(teamNumber) {
  const map = { 1: 'blue', 2: 'red', 3: 'green', 4: 'purple' };
  const teamId = map[Number(teamNumber)];
  if (!teamId) throw new Error('اكتب رقم الحلقة من 1 إلى 4 داخل استدعاء الدالة');
  const result = generateUnifiedReportForTeamOnly(teamId, '');
  return 'تم بناء ' + (TEAM_SHEETS[teamId] || teamId) + ' بكل أسابيع السنة مع الملخص الخارجي للطالب';
}


/**
 * بعد تركيب هذا الإصدار شغّل هذه الدالة مرة واحدة.
 * تعيد بناء تقارير الحلقات تدريجياً حتى يظهر يوم الأحد 27/09/2026
 * ويصبح أصل الأسبوع الأول 400 نقطة لكل طالب.
 * صفوف ملخص الحلقة الأسبوعي تبقى مخفية.
 */
function restoreFirstSundayAndQueueReportsNow() {
  markReportsDirty('', '');
  createFastReportsTrigger();

  const firstResult = runReportQueueNow(1, 240000);
  const remaining = firstResult && firstResult.remainingTeams
    ? firstResult.remainingTeams.length
    : 0;

  return {
    status: remaining > 0 ? 'queued' : 'done',
    restoredDate: '2026-09-27',
    weeklyTargetPerStudent: WEEKLY_TARGET,
    remainingTeams: remaining,
    message: remaining > 0
      ? 'عاد يوم الأحد 27/09/2026 وأصل الأسبوع الأول 400 نقطة. تم تحديث أول تقرير، وباقي ' + remaining + ' تقارير ستتحدث تلقائياً.'
      : 'عاد يوم الأحد 27/09/2026 وأصل الأسبوع الأول 400 نقطة في جميع التقارير.'
  };
}


/**
 * يحذف السبت من الأسبوع الثاني في جميع تقارير الحلقات ويعيد أصل الأسبوع إلى 400.
 * لا يحذف سجلات السبت من ورقة البيانات؛ فقط يستبعدها من التقرير والحساب.
 * شغّل هذه الدالة مرة واحدة بعد نشر الإصدار الجديد.
 */
function removeSaturdayFromWeekTwoAndQueueReportsNow() {
  markReportsDirty('', '');
  createFastReportsTrigger();

  const firstResult = runReportQueueNow(1, 240000);
  const remaining = firstResult && firstResult.remainingTeams
    ? firstResult.remainingTeams.length
    : 0;

  return {
    status: remaining > 0 ? 'queued' : 'done',
    sessionDays: SESSION_DAYS_LABEL,
    weekTwoTargetPerStudent: WEEKLY_TARGET,
    remainingTeams: remaining,
    message: remaining > 0
      ? 'تم حذف السبت من الأسبوع الثاني وبدأ تحديث أول تقرير. بقي ' + remaining + ' تقارير وستتحدث تلقائياً.'
      : 'تم حذف السبت من الأسبوع الثاني. أصبحت أيام الأسبوع الأحد إلى الأربعاء وأصل الأسبوع 400 نقطة.'
  };
}

// إبقاء الأسماء القديمة للتوافق، لكنها الآن تنفذ إزالة السبت بدلاً من إضافته.
function enableSaturdayForWeekTwoOnlyAndQueueReportsNow() {
  return removeSaturdayFromWeekTwoAndQueueReportsNow();
}

function enableSaturdayTestAndQueueReportsNow() {
  return removeSaturdayFromWeekTwoAndQueueReportsNow();
}

// ══════════════════════════════════════════════════════════════
// إصلاح حجم وبنية تقارير الحلقات
// ══════════════════════════════════════════════════════════════
function trimUnifiedReportSheet_(sheet, desiredLastRow) {
  if (!sheet) return;
  const keepRows = Math.max(3, Number(desiredLastRow) || 3);
  const maxRows = sheet.getMaxRows();
  if (maxRows > keepRows) {
    try { sheet.deleteRows(keepRows + 1, maxRows - keepRows); } catch (err) {
      Logger.log('trimUnifiedReportSheet_ skipped: ' + err.message);
    }
  }
}

// شغّل هذه الدالة مرة واحدة لإصلاح تقرير حلقة ثالث فقط:
// - تعيد بناءه من ورقة البيانات
// - يثبت أيام التقرير من الأحد إلى الأربعاء فقط
// - تحذف الصفوف الزائدة القديمة
// - تجعل الاستبدال اللاحق يحدث الصف مباشرة
function repairGreenReportNow() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  generateUnifiedReportForTeamOnly('green', '');
  const sheet = getReportSheetForTeam_(ss, 'green');
  if (!sheet) throw new Error('لم يتم العثور على تقرير حلقة ثالث بعد إعادة البناء');

  trimUnifiedReportSheet_(sheet, sheet.getLastRow());
  SpreadsheetApp.flush();

  // إزالة حلقة ثالث من طابور قديم حتى لا يعاد بناء التقرير مرة أخرى بلا داعٍ.
  try {
    const props = PropertiesService.getScriptProperties();
    const pending = String(props.getProperty(REPORTS_DIRTY_TEAMS_KEY) || '')
      .split(',')
      .map(function(v) { return String(v || '').trim(); })
      .filter(function(v) { return v && v !== 'green'; });
    if (pending.length) {
      props.setProperty(REPORTS_DIRTY_TEAMS_KEY, pending.join(','));
    } else {
      clearReportsDirty();
    }
  } catch (err) {
    Logger.log('repairGreenReportNow queue cleanup skipped: ' + err.message);
  }

  return {
    status: 'ok',
    sheetName: sheet.getName(),
    lastRow: sheet.getLastRow(),
    maxRows: sheet.getMaxRows(),
    message: 'تم إصلاح تقرير حلقة ثالث وإعادة بنائه من ورقة البيانات وتقليص الصفوف الزائدة.'
  };
}

// اختبار سريع بعد تسجيل/استبدال طالب في حلقة ثالث.
function syncGreenTodayReportNow() {
  return syncUnifiedReportsForDateNow_('', 'green', '');
}


// ══════════════════════════════════════════════════════════════
// تشغيل واضح لتثبيت/اختبار تقرير حلقة أولى حسب المسارات — V2
// ابحث عن اسم هذه الدالة في قائمة الدوال وشغّلها مرة واحدة بعد استبدال Code.gs.
// ══════════════════════════════════════════════════════════════
function APPLY_FIRST_CIRCLE_TRACK_REPORT_V2() {
  return REMOVE_FIRST_CIRCLE_TRACK_AND_APPLY_SCHOOL_SCHEDULE();
}


// ══════════════════════════════════════════════════════════════
//  الإصلاح النهائي لتأخير التسجيل V3
// ══════════════════════════════════════════════════════════════
// تشغيل يدوي عند الحاجة لتحديث حلقة واحدة بعد انتهاء التسجيل.
// ══════════════════════════════════════════════════════════════
//  V4 — حفظ فوري + تحديث تلقائي لتقرير الحلقة بعد هدوء التسجيل
// ══════════════════════════════════════════════════════════════
function findLogEntryFastV5_(sheet, dateStr, studentName, teamId) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { row: 0, total: 0, values: null };

  const targetDate = normalizeDate(dateStr);
  const targetName = String(studentName || '').trim();
  const targetTeam = normalizeTeamId(teamId || '');

  try {
    const matches = sheet.getRange(2, COL.STUDENT, lastRow - 1, 1)
      .createTextFinder(targetName)
      .matchEntireCell(true)
      .matchCase(false)
      .findAll();

    for (let i = matches.length - 1; i >= 0; i--) {
      const rowNumber = matches[i].getRow();
      const row = sheet.getRange(rowNumber, 1, 1, HEADERS.length).getDisplayValues()[0];
      const rowDate = dateValueToString(row[COL.DATE - 1]);
      const rowTeam = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
      if (rowDate === targetDate && (!rowTeam || rowTeam === targetTeam)) {
        return {
          row: rowNumber,
          total: Number(row[COL.TOTAL - 1]) || 0,
          values: row
        };
      }
    }
  } catch (err) {
    Logger.log('findLogEntryFastV5_ TextFinder fallback: ' + err.message);
    return findLogEntryFastV3_(sheet, targetDate, targetName, targetTeam);
  }

  return { row: 0, total: 0, values: null };
}

/**
 * جميع عمليات التحقق والكتابة وإضافة طلب التقرير تتم داخل قفل قصير واحد.
 * هذا يمنع ستة طلبات متزامنة من اختيار الصف نفسه أو الكتابة فوق بعضها.
 * تحديث التقرير لا يحدث هنا إطلاقاً.
 */

// ══════════════════════════════════════════════════════════════
//  V6 — حفظ فائق السرعة + طابور خصائص مستقل لكل طالب
//  لا يستخدم عامل التقرير ScriptLock، ولذلك لا يمنع تسجيل المعلمين.
// ══════════════════════════════════════════════════════════════

function v6Hash_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '').substring(0, 36);
}

function v6StudentIdentity_(dateStr, teamId, studentName) {
  return [
    normalizeDate(dateStr),
    normalizeTeamId(teamId),
    normalizeStudentReportKey_(studentName)
  ].join('|');
}

function v6EntryIndexKey_(dateStr, teamId, studentName) {
  return V6_ENTRY_INDEX_PREFIX + v6Hash_(v6StudentIdentity_(dateStr, teamId, studentName));
}

function v6ReportQueueKey_(dateStr, teamId, studentName) {
  return V6_REPORT_QUEUE_PREFIX + v6Hash_(v6StudentIdentity_(dateStr, teamId, studentName));
}

function parseJsonSafeV6_(text, fallback) {
  try {
    const parsed = JSON.parse(String(text || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function getV6IndexedEntry_(props, dateStr, teamId, studentName) {
  const key = v6EntryIndexKey_(dateStr, teamId, studentName);
  const item = parseJsonSafeV6_(props.getProperty(key), null);
  if (!item) return { key: key, exists: false, row: 0, total: 0 };
  return {
    key: key,
    exists: true,
    row: Number(item.row || 0),
    total: Number(item.total || 0),
    reserved: item.reserved === true,
    item: item
  };
}

function setV6IndexedEntry_(props, key, data) {
  props.setProperty(key, JSON.stringify({
    date: normalizeDate(data.date),
    teamId: normalizeTeamId(data.teamId),
    studentName: String(data.studentName || '').trim(),
    row: Number(data.row || 0),
    total: Number(data.total || 0),
    reserved: data.reserved === true,
    updatedAt: Date.now()
  }));
}

function enqueueStudentReportV6_(dateStr, teamId, studentName) {
  const props = PropertiesService.getScriptProperties();
  const key = v6ReportQueueKey_(dateStr, teamId, studentName);
  const previous = parseJsonSafeV6_(props.getProperty(key), {});
  props.setProperty(key, JSON.stringify({
    date: normalizeDate(dateStr),
    teamId: normalizeTeamId(teamId),
    studentName: String(studentName || '').trim(),
    attempts: Number(previous.attempts || 0),
    queuedAt: Number(previous.queuedAt || Date.now()),
    updatedAt: Date.now(),
    lastError: ''
  }));
  return key;
}

function enqueueStudentReportsBatchV6_(items) {
  const props = PropertiesService.getScriptProperties();
  const batch = {};
  (items || []).forEach(function(item) {
    const dateStr = normalizeDate(item && item.date);
    const teamId = normalizeTeamId(item && item.teamId);
    const studentName = String(item && item.studentName || '').trim();
    if (!dateStr || !teamId || !studentName) return;
    const key = v6ReportQueueKey_(dateStr, teamId, studentName);
    batch[key] = JSON.stringify({
      date: dateStr,
      teamId: teamId,
      studentName: studentName,
      attempts: 0,
      queuedAt: Date.now(),
      updatedAt: Date.now(),
      lastError: ''
    });
  });
  const keys = Object.keys(batch);
  if (keys.length) props.setProperties(batch, false);
  return keys.length;
}

/**
 * المسار العادي create لا يبحث في عمود الطلاب مع كل تسجيل.
 * دالة التثبيت تبني فهرس اليوم مرة واحدة، ثم كل تسجيل جديد يحجز اسمه
 * في خصائص السكربت خلال قفل بالغ القصر، وبعدها يكتب الصف بدون إبقاء القفل.
 */
function saveAdminEntryUltraV6_(data, mode) {
  mode = String(mode || 'create').trim().toLowerCase();
  data = data || {};
  data.hudur = true;

  const studentName = String(data.studentName || '').trim();
  if (!studentName) throw new Error('studentName مطلوب');

  const teamId = normalizeTeamId(data.teamId || data.teamName || data.team || '');
  if (!teamId) throw new Error('teamId مطلوب أو غير صحيح');

  const dateStr = mapRequestedDateToSchoolDay_(data.date);
  if (!dateStr) throw new Error('التاريخ غير صحيح');

  const props = PropertiesService.getScriptProperties();
  const indexKey = v6EntryIndexKey_(dateStr, teamId, studentName);
  let indexed = getV6IndexedEntry_(props, dateStr, teamId, studentName);

  if (mode === 'create' && indexed.exists) {
    return {
      status: 'duplicate',
      version: FAST_SAVE_VERSION_V6,
      existed: true,
      date: dateStr,
      studentName: studentName,
      teamId: teamId,
      teamName: getCompetitionUnitName_(teamId, ''),
      oldTotal: indexed.total,
      newTotal: indexed.total,
      total: indexed.total,
      delta: 0,
      reportStatus: 'unchanged',
      message: 'الطالب مسجل مسبقاً اليوم'
    };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let logSheet = ss.getSheetByName(SHEET_LOG);
  if (!logSheet) logSheet = getOrCreateLogSheet(ss);

  let found = { row: 0, total: 0, values: null };
  // الاستبدال والدمج فقط يحتاجان معرفة الصف القديم. التسجيل الجديد لا يقوم ببحث ثقيل.
  if (mode !== 'create') {
    if (indexed.exists && indexed.row > 0) {
      const rowValues = logSheet.getRange(indexed.row, 1, 1, HEADERS.length).getDisplayValues()[0];
      found = { row: indexed.row, total: indexed.total, values: rowValues };
    } else {
      found = findLogEntryFastV5_(logSheet, dateStr, studentName, teamId);
    }
  }

  const existingRow = Number(found.row || 0);
  const oldTotal = Number(found.total || 0);
  let finalData = data;

  if (existingRow > 0 && mode === 'merge') {
    const oldValues = found.values ||
      logSheet.getRange(existingRow, 1, 1, HEADERS.length).getValues()[0];
    const oldData = logRowToPayload(oldValues, dateStr, studentName, teamId);
    finalData = mergeLogPayload(oldData, data, dateStr, studentName, teamId);
  }

  const rowValues = buildLogRow(dateStr, studentName, finalData, teamId);
  const newTotal = Number(rowValues[COL.TOTAL - 1]) || 0;

  // نحجز الطالب فقط داخل القفل. لا توجد أي قراءة/كتابة Sheets داخل هذا القفل.
  if (mode === 'create') {
    const reserveLock = LockService.getScriptLock();
    let locked = false;
    try {
      locked = reserveLock.tryLock(1800);
      if (locked) {
        indexed = getV6IndexedEntry_(props, dateStr, teamId, studentName);
        if (indexed.exists) {
          return {
            status: 'duplicate',
            version: FAST_SAVE_VERSION_V6,
            existed: true,
            date: dateStr,
            studentName: studentName,
            teamId: teamId,
            teamName: getCompetitionUnitName_(teamId, ''),
            oldTotal: indexed.total,
            newTotal: indexed.total,
            total: indexed.total,
            delta: 0,
            reportStatus: 'unchanged',
            message: 'الطالب مسجل مسبقاً اليوم'
          };
        }
        setV6IndexedEntry_(props, indexKey, {
          date: dateStr,
          teamId: teamId,
          studentName: studentName,
          row: 0,
          total: newTotal,
          reserved: true
        });
      }
    } finally {
      if (locked) {
        try { reserveLock.releaseLock(); } catch (_) {}
      }
    }
  }

  let targetRow = existingRow;
  try {
    if (existingRow > 0) {
      logSheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues]);
    } else {
      // appendRow يضيف كل تسجيل في صف مستقل حتى مع وصول عدة معلمين معاً.
      logSheet.appendRow(rowValues);
      // لا نطلب getLastRow هنا حتى لا نضيف اتصالاً إضافياً يبطئ الرد.
      targetRow = 0;
    }
  } catch (writeErr) {
    if (mode === 'create') {
      try { props.deleteProperty(indexKey); } catch (_) {}
    }
    throw writeErr;
  }

  setV6IndexedEntry_(props, indexKey, {
    date: dateStr,
    teamId: teamId,
    studentName: studentName,
    row: targetRow,
    total: newTotal,
    reserved: false
  });

  // طابور التقرير محفوظ في Properties وليس في شيت، لذلك لا توجد كتابة Sheets ثانية وقت التسجيل.
  enqueueStudentReportV6_(dateStr, teamId, studentName);

  try {
    CacheService.getScriptCache().put(
      fastEntryCacheKeyV3_(dateStr, studentName, teamId),
      String(newTotal),
      21600
    );
    props.setProperty('FAST_SAVE_ACTIVE_VERSION', FAST_SAVE_VERSION_V6);
  } catch (_) {}

  return {
    status: existingRow > 0 ? (mode === 'replace' ? 'replaced' : 'updated') : 'created',
    version: FAST_SAVE_VERSION_V6,
    existed: existingRow > 0,
    date: dateStr,
    studentName: studentName,
    teamId: teamId,
    teamName: getCompetitionUnitName_(teamId, ''),
    oldTotal: oldTotal,
    newTotal: newTotal,
    total: newTotal,
    delta: newTotal - oldTotal,
    reportStatus: 'queued-student-properties',
    message: 'تم حفظ التسجيل؛ سيُحدّث تقرير هذا الطالب في الخلفية'
  };
}

function processStudentReportQueueV6_() {
  // نستخدم DocumentLock فقط أثناء كتابة شيت التقرير. حفظ AdminPage لا يستخدم هذا القفل،
  // لذلك يبقى سريعاً، وفي الوقت نفسه لا يستطيع العامل الكتابة فوق تعديل يدوي جارٍ.
  const workerLock = LockService.getDocumentLock();
  if (!workerLock.tryLock(100)) {
    return { status: 'worker-busy', processed: 0 };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    const keys = Object.keys(all)
      .filter(function(key) { return key.indexOf(V6_REPORT_QUEUE_PREFIX) === 0; })
      .slice(0, V6_REPORT_BATCH);

    if (!keys.length) return { status: 'idle', processed: 0 };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getOrCreateLogSheet(ss);
    const mapsByDate = {};
    const sheetsByTeam = {};
    const deleteKeys = [];
    const updates = {};
    const details = [];

    keys.forEach(function(key) {
      const item = parseJsonSafeV6_(all[key], null);
      if (!item) {
        deleteKeys.push(key);
        return;
      }

      const dateStr = normalizeDate(item.date);
      const teamId = normalizeTeamId(item.teamId);
      const studentName = String(item.studentName || '').trim();
      if (!dateStr || !teamId || !studentName) {
        deleteKeys.push(key);
        return;
      }

      // المعلم عدّل هذا الطالب/اليوم يدوياً الآن؛ نترك الطلب في الطابور للدورة التالية
      // ولا نعدّه محاولة فاشلة ولا نكتب قيمة قديمة فوق الخلية.
      if (isManualReportEntryProtected_(dateStr, teamId, studentName)) {
        return;
      }

      try {
        if (!mapsByDate[dateStr]) {
          mapsByDate[dateStr] = readLogRowsForDateByTeamStudent_(logSheet, dateStr);
        }
        if (!sheetsByTeam[teamId]) {
          sheetsByTeam[teamId] = getReportSheetForTeam_(ss, teamId);
        }

        const reportSheet = sheetsByTeam[teamId];
        if (!reportSheet) throw new Error('شيت تقرير الحلقة غير موجود');

        const result = syncOneUnifiedReportSheetForDate_(
          reportSheet,
          teamId,
          dateStr,
          mapsByDate[dateStr],
          studentName
        );

        if (!result.studentFound || result.dayRowsFound === 0 || result.updatedRows === 0) {
          markReportsDirty(dateStr, teamId);
          throw new Error('صف الطالب أو يوم التقرير غير موجود؛ يحتاج إعادة بناء مرة واحدة');
        }

        deleteKeys.push(key);
        details.push(result);
      } catch (err) {
        const attempts = Number(item.attempts || 0) + 1;
        if (attempts >= V6_REPORT_MAX_ATTEMPTS) {
          markReportsDirty(dateStr, teamId);
          deleteKeys.push(key);
        } else {
          item.attempts = attempts;
          item.updatedAt = Date.now();
          item.lastError = err && err.message ? err.message : String(err);
          updates[key] = JSON.stringify(item);
        }
      }
    });

    SpreadsheetApp.flush();
    if (Object.keys(updates).length) props.setProperties(updates, false);
    deleteKeys.forEach(function(key) { props.deleteProperty(key); });

    return {
      status: 'done',
      version: FAST_SAVE_VERSION_V6,
      processed: keys.length,
      updatedStudents: details.length,
      pendingAgain: Object.keys(updates).length,
      details: details
    };
  } finally {
    try { workerLock.releaseLock(); } catch (_) {}
  }
}

function seedTodayEntryIndexV6_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(V6_ENTRY_INDEX_PREFIX) === 0 ||
        key.indexOf(V6_REPORT_QUEUE_PREFIX) === 0) {
      props.deleteProperty(key);
    }
  });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { indexed: 0 };

  const today = formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  const batch = {};
  let count = 0;

  values.forEach(function(row, i) {
    const dateStr = normalizeDate(dateValueToString(row[COL.DATE - 1]));
    if (dateStr !== today) return;
    const studentName = String(row[COL.STUDENT - 1] || '').trim();
    const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    if (!studentName || !teamId) return;
    const key = v6EntryIndexKey_(dateStr, teamId, studentName);
    batch[key] = JSON.stringify({
      date: dateStr,
      teamId: teamId,
      studentName: studentName,
      row: i + 2,
      total: Number(row[COL.TOTAL - 1]) || 0,
      reserved: false,
      updatedAt: Date.now()
    });
    count++;
  });

  if (Object.keys(batch).length) props.setProperties(batch, false);
  return { indexed: count, date: today };
}

function markAbsencesAndQueueStudentsV6_() {
  // نفس اليوم الدراسي الذي يكتبه markAbsences (اليوم المنتهي) حتى يُزامن الطابور يوم الغياب الصحيح.
  const today = getEndedSchoolDay_();
  const dateStr = formatDate(today);
  const result = markAbsences();
  if (!isSessionDayInAppTimezone(today)) return result;

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rosterMap = getAllTeamStudents(ss);
  const items = [];
  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    (rosterMap[teamId] || []).forEach(function(name) {
      const studentName = String(name || '').trim();
      if (studentName) items.push({ date: dateStr, teamId: teamId, studentName: studentName });
    });
  });
  return {
    status: 'ok',
    absenceResult: result || null,
    queuedStudents: enqueueStudentReportsBatchV6_(items)
  };
}

function cleanupV6Properties_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const today = formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  let deleted = 0;
  Object.keys(all).forEach(function(key) {
    if (key.indexOf(V6_ENTRY_INDEX_PREFIX) !== 0) return;
    const item = parseJsonSafeV6_(all[key], null);
    if (!item || normalizeDate(item.date) !== today) {
      props.deleteProperty(key);
      deleted++;
    }
  });
  return { deleted: deleted };
}

// ============================================================================
// V7 — حفظ فوري + تشغيل تحديث تقرير الطالب من المتصفح بدون انتظار المستخدم
// ============================================================================

function syncSingleStudentReportV7_(dateStr, teamId, studentName) {
  const normalizedDate = mapRequestedDateToSchoolDay_(dateStr);
  const normalizedTeam = normalizeTeamId(teamId);
  const normalizedStudent = String(studentName || '').trim();

  if (!normalizedDate || !normalizedTeam || !normalizedStudent) {
    return {
      status: 'invalid',
      version: FAST_SAVE_VERSION_V7,
      updated: false,
      message: 'بيانات الطالب أو الحلقة أو التاريخ غير مكتملة'
    };
  }

  if (isManualReportEntryProtected_(normalizedDate, normalizedTeam, normalizedStudent)) {
    return {
      status: 'manual-edit-protected',
      version: FAST_SAVE_VERSION_V7,
      updated: false,
      retry: true,
      message: 'يوجد تعديل يدوي حديث لهذا الطالب؛ تم تأجيل المزامنة حتى لا يُستبدل التعديل'
    };
  }

  // نستخدم نفس DocumentLock الذي يستخدمه التعديل اليدوي، حتى لا يصل طلب متأخر
  // من المتصفح ويعيد قيمة قديمة فوق اختيار المعلم. حفظ AdminPage نفسه لا يتأثر.
  const workerLock = LockService.getDocumentLock();
  if (!workerLock.tryLock(80)) {
    return {
      status: 'busy',
      version: FAST_SAVE_VERSION_V7,
      updated: false,
      retry: true,
      message: 'عامل التقارير مشغول؛ سيعاد الطلب تلقائياً'
    };
  }

  try {
    // قد يبدأ التعديل اليدوي بعد الفحص الأول وقبل حصول العامل على القفل.
    // نعيد الفحص هنا حتى لا نقرأ أو نكتب القيمة القديمة بعد اختيار المعلم.
    if (isManualReportEntryProtected_(normalizedDate, normalizedTeam, normalizedStudent)) {
      return {
        status: 'manual-edit-protected',
        version: FAST_SAVE_VERSION_V7,
        updated: false,
        retry: true,
        message: 'يوجد تعديل يدوي حديث لهذا الطالب؛ تم تأجيل المزامنة'
      };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getOrCreateLogSheet(ss);
    const reportSheet = getReportSheetForTeam_(ss, normalizedTeam);

    if (!reportSheet) {
      markReportsDirty(normalizedDate, normalizedTeam);
      return {
        status: 'needs-rebuild',
        version: FAST_SAVE_VERSION_V7,
        updated: false,
        retry: false,
        message: 'شيت تقرير الحلقة غير موجود'
      };
    }

    const logMaps = readLogRowsForDateByTeamStudent_(logSheet, normalizedDate);
    const result = syncOneUnifiedReportSheetForDate_(
      reportSheet,
      normalizedTeam,
      normalizedDate,
      logMaps,
      normalizedStudent
    );

    const updated = Boolean(
      result.studentFound &&
      result.dayRowsFound > 0 &&
      result.updatedRows > 0
    );

    if (!updated) {
      markReportsDirty(normalizedDate, normalizedTeam);
      return {
        status: 'needs-rebuild',
        version: FAST_SAVE_VERSION_V7,
        updated: false,
        retry: false,
        studentName: normalizedStudent,
        teamId: normalizedTeam,
        date: normalizedDate,
        details: result,
        message: 'لم يتم العثور على صف الطالب أو تاريخ اليوم داخل التقرير'
      };
    }

    SpreadsheetApp.flush();

    // نحذف الطلب من طابور V6 بعد نجاح التحديث المباشر.
    try {
      PropertiesService.getScriptProperties().deleteProperty(
        v6ReportQueueKey_(normalizedDate, normalizedTeam, normalizedStudent)
      );
    } catch (_) {}

    return {
      status: 'updated',
      version: FAST_SAVE_VERSION_V7,
      updated: true,
      studentName: normalizedStudent,
      teamId: normalizedTeam,
      date: normalizedDate,
      details: result,
      message: 'تم تحديث تقرير الطالب'
    };
  } finally {
    try { workerLock.releaseLock(); } catch (_) {}
  }
}

function queueTodayEntriesForReportsV7_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateLogSheet(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { queued: 0, date: '' };

  const today = formatDate(getTodayInAppTimezone ? getTodayInAppTimezone() : new Date());
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getDisplayValues();
  const unique = {};

  values.forEach(function(row) {
    const dateStr = normalizeDate(dateValueToString(row[COL.DATE - 1]));
    if (dateStr !== today) return;
    const studentName = String(row[COL.STUDENT - 1] || '').trim();
    const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
    if (!studentName || !teamId) return;
    unique[dateStr + '|' + teamId + '|' + normalizeStudentReportKey_(studentName)] = {
      date: dateStr,
      teamId: teamId,
      studentName: studentName
    };
  });

  const items = Object.keys(unique).map(function(key) { return unique[key]; });
  return {
    queued: enqueueStudentReportsBatchV6_(items),
    date: today
  };
}

function processStudentReportQueueV7_() {
  return processStudentReportQueueV6_();
}

function markAbsencesAndQueueStudentsV7_() {
  return markAbsencesAndQueueStudentsV6_();
}

function cleanupV7Properties_() {
  return cleanupV6Properties_();
}

/**
 * شغّل هذه الدالة مرة واحدة بعد استبدال Code.gs.
 * - تضمن وجود تريجر واحد فقط لتعديل تقرير الحلقة.
 * - لا تعيد بناء التقارير ولا تحذف التسجيلات.
 * - تنظف مفاتيح الحماية المنتهية فقط.
 */

/**
 * تنظيف السجلات الخاطئة التي أُنشئت عندما فُهم عنوان التقرير
 * "اسم الطالب / الأسبوع / اليوم" على أنه اسم طالب.
 *
 * الدالة آمنة: لا تحذف إلا العناوين المحجوزة، ثم تنظفها من شيتات الحلقات
 * وطوابير V7، وتعيد بناء تقارير الحلقات المتأثرة فقط.
 */
function CLEANUP_FAKE_REPORT_HEADER_STUDENTS_NOW() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const logSheet = getOrCreateLogSheet(ss);
    const affectedTeams = {};
    const deletedDataRows = [];
    const deletedRosterRows = [];

    // 1) حذف السجلات الخاطئة من شيت البيانات من الأسفل للأعلى.
    const lastLogRow = logSheet.getLastRow();
    if (lastLogRow >= 2) {
      const values = logSheet.getRange(2, 1, lastLogRow - 1, HEADERS.length).getDisplayValues();
      values.forEach(function(row, index) {
        const studentName = String(row[COL.STUDENT - 1] || '').trim();
        if (!isInvalidUnifiedStudentName_(studentName)) return;

        const teamId = normalizeTeamId(row[COL.CLASS_ID - 1] || row[COL.TEAM - 1] || '');
        if (teamId) affectedTeams[teamId] = true;
        deletedDataRows.push(index + 2);
      });

      deletedDataRows.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
        logSheet.deleteRow(rowNumber);
      });
    }

    // 2) حذف العنوان إن كان قد أُضيف بالخطأ إلى شيت أسماء أي حلقة.
    Object.keys(TEAM_SHEETS).forEach(function(teamId) {
      const rosterSheet = ss.getSheetByName(TEAM_SHEETS[teamId]);
      if (!rosterSheet || rosterSheet.getLastRow() < 2) return;

      const names = rosterSheet.getRange(2, 1, rosterSheet.getLastRow() - 1, 1).getDisplayValues();
      const rows = [];
      names.forEach(function(row, index) {
        if (isInvalidUnifiedStudentName_(row[0])) rows.push(index + 2);
      });

      rows.sort(function(a, b) { return b - a; }).forEach(function(rowNumber) {
        rosterSheet.deleteRow(rowNumber);
        deletedRosterRows.push({ teamId: teamId, row: rowNumber });
        affectedTeams[teamId] = true;
      });
    });

    // 3) حذف أي فهرس أو طلب V7 معلّق يحمل الاسم الخاطئ.
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const propertyKeysToDelete = [];
    Object.keys(allProps).forEach(function(key) {
      if (
        key.indexOf(V6_ENTRY_INDEX_PREFIX) !== 0 &&
        key.indexOf(V6_REPORT_QUEUE_PREFIX) !== 0 &&
        key.indexOf(MANUAL_REPORT_EDIT_PREFIX) !== 0
      ) return;

      const item = parseJsonSafeV6_(allProps[key], null);
      if (item && isInvalidUnifiedStudentName_(item.studentName)) {
        propertyKeysToDelete.push(key);
      }
    });
    propertyKeysToDelete.forEach(function(key) { props.deleteProperty(key); });

    // 4) إعادة بناء تقارير الحلقات المتأثرة فقط حتى تختفي الأسماء الوهمية فوراً.
    const rebuiltTeams = [];
    Object.keys(affectedTeams).forEach(function(teamId) {
      generateUnifiedReportForTeamOnly(teamId, '');
      rebuiltTeams.push(TEAM_SHEETS[teamId] || teamId);
    });

    SpreadsheetApp.flush();
    return {
      status: 'ok',
      deletedDataRows: deletedDataRows.length,
      deletedRosterRows: deletedRosterRows.length,
      deletedQueueProperties: propertyKeysToDelete.length,
      rebuiltTeams: rebuiltTeams,
      message: 'تم حذف سجلات عنوان التقرير الخاطئة وإعادة بناء الحلقات المتأثرة.'
    };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function INSTALL_MANUAL_REPORT_EDIT_NO_OVERWRITE_FIX() {
  const handlers = ScriptApp.getProjectTriggers();

  // منع تنفيذ handleUnifiedReportEdit مرتين من أكثر من تريجر مثبت.
  handlers
    .filter(function(t) { return t.getHandlerFunction() === 'handleUnifiedReportEdit'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  // أي تريجر قديم يعيد بناء شيت التقرير بالكامل يمكن أن يمسح التعديل اليدوي.
  // V7 يحدّث صف الطالب مباشرة، لذلك لا نحتاج refreshReportsIfDirty أثناء العمل اليومي.
  handlers
    .filter(function(t) { return t.getHandlerFunction() === 'refreshReportsIfDirty'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('handleUnifiedReportEdit')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onEdit()
    .create();

  const props = PropertiesService.getScriptProperties();
  const removedExpiredProtection = cleanupManualReportEditProtection_();
  props.deleteProperty(REPORT_EDIT_ACTIVE_UNTIL_KEY);
  // إلغاء أي إعادة بناء شاملة معلقة بدأت قبل تركيب الإصلاح.
  clearReportsDirty();

  const currentTriggers = ScriptApp.getProjectTriggers();
  return {
    status: 'ok',
    fix: 'manual-report-edit-event-value-no-row-rewrite',
    editTriggers: currentTriggers.filter(function(t) {
      return t.getHandlerFunction() === 'handleUnifiedReportEdit';
    }).length,
    refreshTriggers: currentTriggers.filter(function(t) {
      return t.getHandlerFunction() === 'refreshReportsIfDirty';
    }).length,
    removedExpiredProtection: removedExpiredProtection,
    message: 'تم تثبيت القيمة الجديدة من حدث التعديل ومنع إعادة كتابة صف اليوم أو إعادة بناء التقرير فوقها'
  };
}

function DEBUG_MANUAL_REPORT_EDIT_FIX() {
  const triggers = ScriptApp.getProjectTriggers().map(function(t) {
    return {
      handler: t.getHandlerFunction(),
      eventType: String(t.getEventType()),
      source: String(t.getTriggerSource())
    };
  });
  return {
    unifiedEditTriggers: triggers.filter(function(t) { return t.handler === 'handleUnifiedReportEdit'; }).length,
    refreshReportTriggers: triggers.filter(function(t) { return t.handler === 'refreshReportsIfDirty'; }).length,
    allTriggers: triggers,
    dirty: PropertiesService.getScriptProperties().getProperty(REPORTS_DIRTY_KEY) || '',
    message: 'المطلوب: unifiedEditTriggers = 1 و refreshReportTriggers = 0'
  };
}

function AAA_INSTALL_RELIABLE_REPORT_V7() {
  const handlersToRemove = [
    'refreshReportsIfDirty',
    'processNightlyReportsV3_',
    'markAbsences',
    'markAbsencesAndScheduleReportsV3_',
    'autoRefreshReportsAfterIdleV4_',
    'markAbsencesAndQueueReportsV4_',
    'processStudentReportQueueV5_',
    'markAbsencesAndQueueStudentsV5_',
    'cleanupStudentReportQueueV5_',
    'processStudentReportQueueV6_',
    'markAbsencesAndQueueStudentsV6_',
    'cleanupV6Properties_',
    'processStudentReportQueueV7_',
    'markAbsencesAndQueueStudentsV7_',
    'cleanupV7Properties_'
  ];

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (handlersToRemove.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // يعيد بناء فهرس تسجيلات اليوم، ثم يعيد إدخال كل تسجيلات اليوم في الطابور
  // حتى لا تضيع التسجيلات التي حُفظت قبل تركيب V7.
  const seed = seedTodayEntryIndexV6_();
  const requeue = queueTodayEntriesForReportsV7_();

  const props = PropertiesService.getScriptProperties();
  props.setProperty('FAST_SAVE_ACTIVE_VERSION', FAST_SAVE_VERSION_V7);

  ScriptApp.newTrigger('processStudentReportQueueV7_')
    .timeBased()
    .everyMinutes(1)
    .create();

  ScriptApp.newTrigger('markAbsencesAndQueueStudentsV7_')
    .timeBased()
    .inTimezone(APP_TIMEZONE)
    .atHour(6)
    .nearMinute(0)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('cleanupV7Properties_')
    .timeBased()
    .inTimezone(APP_TIMEZONE)
    .atHour(2)
    .nearMinute(20)
    .everyDays(1)
    .create();

  // نعالج فوراً التسجيلات الموجودة مسبقاً اليوم أثناء التثبيت.
  // هذه العملية قد تستغرق قليلاً مرة واحدة فقط، ولا تؤثر على سرعة صفحة الأدمن.
  const initialProcess = processStudentReportQueueV7_();

  return {
    status: 'ok',
    version: FAST_SAVE_VERSION_V7,
    saveEndpoint: 'saveEntryUltraV7',
    directReportEndpoint: 'syncStudentReportV7',
    indexedToday: seed.indexed || 0,
    queuedToday: requeue.queued || 0,
    initialProcess: initialProcess,
    message: 'تم تفعيل الحفظ الفوري مع تشغيل تحديث تقرير الطالب من المتصفح وتريجر احتياطي كل دقيقة'
  };
}

function UPDATE_STUDENT_REPORTS_NOW_V7() {
  return processStudentReportQueueV7_();
}

function QUEUE_TODAYS_REPORTS_V7() {
  return queueTodayEntriesForReportsV7_();
}

function DEBUG_RELIABLE_REPORT_V7() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const queueKeys = Object.keys(all).filter(function(key) {
    return key.indexOf(V6_REPORT_QUEUE_PREFIX) === 0;
  });
  return {
    status: 'ok',
    version: FAST_SAVE_VERSION_V7,
    queuedStudents: queueKeys.length,
    triggers: ScriptApp.getProjectTriggers().map(function(t) {
      return t.getHandlerFunction();
    }),
    message: queueKeys.length
      ? 'يوجد طلاب في انتظار تحديث التقرير'
      : 'لا توجد طلبات معلقة'
  };
}

function FIX_AND_SYNC_ALL_NOW() {
  // شغّل هذه الدالة مرة واحدة: تعيد تثبيت كل التريجرات على الملف الصحيح
  // ثم تعيد بناء تقارير الحلقات الأربعة فوراً بأسماء الطلاب الحالية.
  const lines = [];

  lines.push('── تثبيت التريجرات ──');
  try { createFastReportsTrigger(); lines.push('✅ تريجر تحديث التقارير بالخلفية'); }
  catch (e) { lines.push('❌ تريجر التقارير: ' + e.message); }
  try { createDailyAbsenceTrigger(); lines.push('✅ تريجر الغياب التلقائي (6 صباحاً)'); }
  catch (e) { lines.push('❌ تريجر الغياب: ' + e.message); }
  try { createUnifiedEditTrigger(); lines.push('✅ تريجر تعديل تقرير الحلقة'); }
  catch (e) { lines.push('❌ تريجر تعديل التقرير: ' + e.message); }
  try { createRosterEditTrigger(); lines.push('✅ تريجر تعديل أسماء الحلقات (الأهم)'); }
  catch (e) { lines.push('❌ تريجر الأسماء: ' + e.message); }

  lines.push('── إعادة بناء التقارير ──');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rosterMap = getAllTeamStudents(ss);
  Object.keys(TEAM_SHEETS).forEach(function(teamId) {
    try {
      generateUnifiedReportForTeamOnly(teamId, '');
      lines.push('✅ تقرير ' + TEAM_SHEETS[teamId] + ' — عدد الطلاب: ' + (rosterMap[teamId] || []).length);
    } catch (e) {
      lines.push('❌ تقرير ' + TEAM_SHEETS[teamId] + ': ' + e.message);
    }
  });

  lines.push('── التريجرات المثبتة الآن ──');
  ScriptApp.getProjectTriggers().forEach(function(t) {
    lines.push('• ' + t.getHandlerFunction());
  });

  const msg = lines.join('\n');
  Logger.log(msg);
  return msg;
}

