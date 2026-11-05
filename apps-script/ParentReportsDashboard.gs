/**
 * لوحة تقارير أولياء الأمور.
 * تعتمد على ParentReportWeb.gs الموجود في نفس مشروع Apps Script.
 * لا تنشئ أي Sheet أو PDF تلقائياً؛ تعرض قائمة الطلاب وتفتح القالب الحالي فقط.
 */

const PRD_DEFAULT_TEAM_ID = 'purple';
const PRD_DEFAULT_WEEK = 1;
const PRD_DEFAULT_TEACHER = '';
const PRD_WEEKS_COUNT = (typeof COURSE_WEEKS_COUNT !== 'undefined') ? COURSE_WEEKS_COUNT : 16;

function showParentReportsDashboard_(e) {
  const params = (e && e.parameter) || {};
  const selectedTeamId = pwrNormalizeTeamId_(params.teamId || params.team || PRD_DEFAULT_TEAM_ID) || PRD_DEFAULT_TEAM_ID;
  // بدون أسبوع في الرابط نفتح على الأسبوع الدراسي الحالي.
  const selectedWeek = Math.max(1, Math.min(PRD_WEEKS_COUNT, Number(params.week || prdCurrentWeek_())));
  const teacherName = String(params.teacherName || PRD_DEFAULT_TEACHER).trim();

  const dashboard = prdBuildDashboardData_();
  const template = HtmlService.createTemplateFromFile('ParentReportsDashboardPage');
  template.dashboardJson = JSON.stringify(dashboard);
  template.baseUrl = prdGetPublicWebAppUrl_();
  template.initialTeamId = selectedTeamId;
  template.initialWeek = selectedWeek;
  template.teacherName = teacherName;
  template.logoDataUrl = (typeof PWR_LOGO_DATA_URL !== 'undefined') ? PWR_LOGO_DATA_URL : '';

  return template.evaluate()
    .setTitle('تقارير أولياء الأمور')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** شغّل هذه الدالة مرة واحدة للحصول على رابط لوحة جميع الطلاب. */
function getParentReportsDashboardUrl() {
  const base = prdGetPublicWebAppUrl_();
  if (!base) {
    throw new Error('انشر المشروع أولاً كتطبيق ويب، ثم شغّل الدالة مرة أخرى.');
  }

  const url = base + '?' + [
    'action=parentReports',
    'teamId=' + encodeURIComponent(PRD_DEFAULT_TEAM_ID),
    'week=' + encodeURIComponent(PRD_DEFAULT_WEEK),
    'teacherName=' + encodeURIComponent(PRD_DEFAULT_TEACHER)
  ].join('&');

  Logger.log('رابط لوحة تقارير أولياء الأمور: ' + url);
  return url;
}


function prdCurrentWeek_() {
  // رقم أسبوع اليوم الدراسي الحالي (من Code.gs)، أو الأسبوع الأول احتياطاً.
  try {
    if (typeof getCourseWeekNumberForDate_ === 'function' && typeof getSchoolDayNow_ === 'function') {
      return getCourseWeekNumberForDate_(getSchoolDayNow_()) || PRD_DEFAULT_WEEK;
    }
  } catch (e) {}
  return PRD_DEFAULT_WEEK;
}

function prdGetPublicWebAppUrl_() {
  // الرابط العام الثابت للنشر (من Deploy ← Manage deployments ← Web app URL)،
  // محفوظ في خصائص السكربت باسم PUBLIC_WEB_APP_URL.
  // ScriptApp.getService().getUrl() يرجع رابط «رأس» المشروع وليس رابط النشر الفعلي،
  // فروابطه تطلب «إذن الدخول» من أولياء الأمور، لذلك نستخدمه احتياطاً فقط.
  let saved = '';
  try { saved = String(PropertiesService.getScriptProperties().getProperty('PUBLIC_WEB_APP_URL') || '').trim(); } catch (e) {}
  if (saved) return saved.replace(/\?.*$/, '').replace(/\/dev$/, '/exec');
  const raw = String(ScriptApp.getService().getUrl() || '').trim();
  if (!raw) return '';
  return raw.replace(/\/dev(?:\?.*)?$/, '/exec');
}

function prdBuildDashboardData_() {
  if (typeof SPREADSHEET_ID === 'undefined' || !SPREADSHEET_ID) {
    throw new Error('SPREADSHEET_ID غير موجود في Code.gs');
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const teamIds = ['blue', 'red', 'green', 'purple'];
  const rosterByTeam = {};
  const displayNameByTeam = {};

  teamIds.forEach(function(teamId) {
    const students = prdReadRosterStudents_(ss, teamId);
    rosterByTeam[teamId] = students;
    displayNameByTeam[teamId] = {};
    students.forEach(function(name) {
      displayNameByTeam[teamId][pwrNormalizeName_(name)] = name;
    });
  });

  const logSheetName = (typeof SHEET_LOG !== 'undefined' && SHEET_LOG) ? SHEET_LOG : 'البيانات';
  const logSheet = ss.getSheetByName(logSheetName);
  const logRows = [];

  if (logSheet && logSheet.getLastRow() >= 2) {
    const values = logSheet.getRange(2, 1, logSheet.getLastRow() - 1, Math.min(14, logSheet.getLastColumn())).getValues();
    values.forEach(function(row) {
      const studentName = String(row[1] || '').trim();
      const normalizedName = pwrNormalizeName_(studentName);
      if (!normalizedName) return;

      let teamId = pwrNormalizeTeamId_(row[13]);
      if (!teamId) teamId = prdFindStudentTeam_(normalizedName, displayNameByTeam);
      if (!teamId) return;

      // أضف الطالب للقائمة حتى لو كان موجوداً في البيانات ولم يعد موجوداً في ورقة الأسماء.
      if (!displayNameByTeam[teamId][normalizedName]) {
        displayNameByTeam[teamId][normalizedName] = studentName;
        rosterByTeam[teamId].push(studentName);
      }

      const dateKey = pwrNormalizeDate_(row[0]);
      if (!dateKey) return;

      logRows.push({
        teamId: teamId,
        normalizedName: normalizedName,
        dateKey: dateKey,
        total: prdSafeNumber_(row[11])
      });
    });
  }

  const courseStart = pwrParseDate_(
    (typeof COURSE_START_DATE !== 'undefined' && COURSE_START_DATE)
      ? COURSE_START_DATE
      : '2026-07-05'
  );
  if (!courseStart) throw new Error('تاريخ بداية الدورة غير صحيح');

  const weekDateSets = {};
  const weekTargets = {};
  for (let week = 1; week <= PRD_WEEKS_COUNT; week++) {
    const dates = pwrGetWeekDates_(courseStart, week);
    const set = {};
    dates.forEach(function(d) { set[pwrDateKey_(d)] = true; });
    weekDateSets[week] = set;
    weekTargets[week] = dates.length * 100;
  }

  const weeklyStats = {};
  logRows.forEach(function(row) {
    for (let week = 1; week <= PRD_WEEKS_COUNT; week++) {
      if (!weekDateSets[week][row.dateKey]) continue;
      const key = row.teamId + '|' + row.normalizedName + '|' + week;
      if (!weeklyStats[key]) weeklyStats[key] = { recordCount: 0, points: 0 };
      weeklyStats[key].recordCount += 1;
      weeklyStats[key].points += row.total;
      break;
    }
  });

  const teams = teamIds.map(function(teamId) {
    const seen = {};
    const students = rosterByTeam[teamId]
      .map(function(name) { return String(name || '').trim(); })
      .filter(function(name) {
        const normalized = pwrNormalizeName_(name);
        if (!normalized || normalized === pwrNormalizeName_('اسم الطالب') || seen[normalized]) return false;
        seen[normalized] = true;
        return true;
      })
      .sort(function(a, b) { return a.localeCompare(b, 'ar'); })
      .map(function(name) {
        const normalized = pwrNormalizeName_(name);
        const weeks = {};
        for (let week = 1; week <= PRD_WEEKS_COUNT; week++) {
          const stat = weeklyStats[teamId + '|' + normalized + '|' + week] || { recordCount: 0, points: 0 };
          const target = weekTargets[week] || 0;
          weeks[week] = {
            recordCount: stat.recordCount,
            points: stat.points,
            target: target,
            percent: target ? Math.max(0, Math.min(100, Math.round((stat.points / target) * 100))) : 0,
            hasData: stat.recordCount > 0
          };
        }
        return { name: name, weeks: weeks };
      });

    return {
      id: teamId,
      name: pwrTeamName_(teamId),
      students: students
    };
  });

  return {
    teams: teams,
    // كل أسابيع السنة، مع تاريخ أحد كل أسبوع حتى يعرف المعلم الأسبوع المقصود.
    weeks: Array.from({ length: PRD_WEEKS_COUNT }, function(_, i) { return i + 1; }).map(function(week) {
      const dates = pwrGetWeekDates_(courseStart, week);
      const startLabel = dates.length ? Utilities.formatDate(dates[0], 'Asia/Riyadh', 'dd/MM') : '';
      return {
        number: week,
        title: 'الأسبوع ' + pwrOrdinal_(week) + (startLabel ? ' (' + startLabel + ')' : ''),
        target: weekTargets[week]
      };
    }),
    generatedAt: Utilities.formatDate(new Date(), 'Asia/Riyadh', 'dd/MM/yyyy HH:mm')
  };
}

function prdReadRosterStudents_(ss, teamId) {
  const sheet = prdFindRosterSheet_(ss, teamId);
  if (!sheet || sheet.getLastRow() < 1) return [];

  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getDisplayValues();
  const seen = {};
  const students = [];

  values.forEach(function(row) {
    const name = String(row[0] || '').trim();
    const normalized = pwrNormalizeName_(name);
    if (!normalized || normalized === pwrNormalizeName_('اسم الطالب') || seen[normalized]) return;
    seen[normalized] = true;
    students.push(name);
  });

  return students;
}

function prdFindRosterSheet_(ss, teamId) {
  const preferredName = (
    typeof TEAM_SHEETS !== 'undefined' && TEAM_SHEETS && TEAM_SHEETS[teamId]
  ) ? TEAM_SHEETS[teamId] : pwrTeamName_(teamId);

  let sheet = ss.getSheetByName(preferredName);
  if (sheet) return sheet;

  const aliases = {
    blue: ['حلقة أولى', 'حلقة اولى', 'الحلقة الأولى', 'الحلقة الاولى', 'حلقه أولى', 'حلقه اولى'],
    red: ['حلقة ثاني', 'حلقة ثانية', 'الحلقة الثانية', 'حلقه ثاني', 'حلقه ثانية'],
    green: ['حلقة ثالث', 'حلقة ثالثة', 'الحلقة الثالثة', 'حلقه ثالث', 'حلقه ثالثة'],
    purple: ['حلقة رابع', 'حلقة رابعة', 'الحلقة الرابعة', 'حلقه رابع', 'حلقه رابعة']
  };

  const wanted = (aliases[teamId] || []).map(pwrNormalizeName_);
  const allSheets = ss.getSheets();
  for (let i = 0; i < allSheets.length; i++) {
    const normalized = pwrNormalizeName_(allSheets[i].getName());
    if (wanted.indexOf(normalized) !== -1) return allSheets[i];
  }

  return null;
}

function prdFindStudentTeam_(normalizedName, displayNameByTeam) {
  const matches = ['blue', 'red', 'green', 'purple'].filter(function(teamId) {
    return !!displayNameByTeam[teamId][normalizedName];
  });
  return matches.length === 1 ? matches[0] : '';
}

function prdSafeNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
