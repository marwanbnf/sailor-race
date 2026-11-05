/**
 * واجهة بيانات تقارير أولياء الأمور لموقع ربيع القلوب.
 *
 * بدل صفحات HtmlService الثقيلة، يرجع السكربت هنا بيانات JSON فقط (JSONP)،
 * والموقع يرسم التقرير بنفسه. النتائج تُحفظ مؤقتاً في CacheService
 * حتى يفتح التقرير فوراً عند تكرار فتحه من أولياء الأمور.
 *
 * الأوامر:
 *   action=reportData&studentName=..&teamId=..&week=..
 *   action=reportsDashboardData
 * أضف ‎&fresh=1‎ لتجاوز الذاكرة المؤقتة.
 */

const RA_CACHE_SECONDS = 120;      // دقيقتان: أي تسجيل جديد يظهر خلال دقيقتين كحد أقصى
const RA_CACHE_CHUNK = 90000;      // حد CacheService لكل قيمة 100KB
const RA_CACHE_VERSION = 'ra1';

function handleReportsApi_(e) {
  const p = (e && e.parameter) || {};
  const callback = p.callback;
  const fresh = p.fresh === '1';

  try {
    if (p.action === 'reportData') {
      const studentName = String(p.studentName || p.name || '').trim();
      const teamId = pwrNormalizeTeamId_(p.teamId || p.team || '');
      if (!studentName) throw new Error('اسم الطالب مطلوب');
      if (!teamId) throw new Error('الحلقة غير صحيحة');
      const week = raClampWeek_(p.week || p.weekNumber || prdCurrentWeek_());
      const teacherName = String(p.teacherName || '').trim();
      const key = ['report', teamId, week, pwrNormalizeName_(studentName), teacherName].join('|');
      const report = raCached_(key, fresh, function() {
        return pwrBuildParentReportData_(studentName, teamId, week, teacherName);
      });
      return jsonOrJsonp(callback, { status: 'ok', report: report });
    }

    if (p.action === 'reportsDashboardData') {
      const dashboard = raCached_('dashboard', fresh, function() {
        return raCompactDashboard_(prdBuildDashboardData_());
      });
      return jsonOrJsonp(callback, {
        status: 'ok',
        dashboard: dashboard,
        currentWeek: raClampWeek_(prdCurrentWeek_())
      });
    }

    throw new Error('أمر غير معروف');
  } catch (err) {
    return jsonOrJsonp(callback, {
      status: 'error',
      message: err && err.message ? err.message : String(err)
    });
  }
}

function raClampWeek_(value) {
  const n = Math.floor(Number(value) || 1);
  return Math.max(1, Math.min(PRD_WEEKS_COUNT, n));
}

// نسخة مختصرة من بيانات اللوحة: لكل طالب مصفوفة [نقاط، عدد أيام التسجيل] لكل أسبوع،
// حتى يبقى الحجم صغيراً وسريع النقل.
function raCompactDashboard_(dashboard) {
  return {
    generatedAt: dashboard.generatedAt,
    weeks: dashboard.weeks,
    teams: dashboard.teams.map(function(team) {
      return {
        id: team.id,
        name: team.name,
        students: team.students.map(function(student) {
          const weeks = [];
          for (let week = 1; week <= PRD_WEEKS_COUNT; week++) {
            const w = student.weeks[week] || {};
            weeks.push([Number(w.points) || 0, Number(w.recordCount) || 0]);
          }
          return { name: student.name, weeks: weeks };
        })
      };
    })
  };
}

// ── ذاكرة مؤقتة مقسّمة (القيمة الواحدة في CacheService حدها 100KB) ──────────
function raCached_(key, fresh, build) {
  const cache = CacheService.getScriptCache();
  const baseKey = RA_CACHE_VERSION + ':' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, key, Utilities.Charset.UTF_8)
  );

  if (!fresh) {
    try {
      const head = cache.get(baseKey);
      if (head) {
        const count = Number(head);
        const keys = [];
        for (let i = 0; i < count; i++) keys.push(baseKey + ':' + i);
        const parts = cache.getAll(keys);
        let text = '';
        let complete = true;
        for (let i = 0; i < keys.length; i++) {
          if (parts[keys[i]] == null) { complete = false; break; }
          text += parts[keys[i]];
        }
        if (complete) return JSON.parse(text);
      }
    } catch (err) {}
  }

  const value = build();
  try {
    const text = JSON.stringify(value);
    const entries = {};
    let count = 0;
    for (let i = 0; i < text.length; i += RA_CACHE_CHUNK) {
      entries[baseKey + ':' + count] = text.slice(i, i + RA_CACHE_CHUNK);
      count++;
    }
    cache.putAll(entries, RA_CACHE_SECONDS);
    cache.put(baseKey, String(count), RA_CACHE_SECONDS);
  } catch (err) {}
  return value;
}
