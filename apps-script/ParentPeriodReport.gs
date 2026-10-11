/**
 * تقرير الفترة الأولى لولي الأمر.
 *
 * ملف مستقل وآمن:
 * - لا يعدّل التقرير الأسبوعي.
 * - لا ينشئ أوراق Google Sheets جديدة.
 * - يجمع بيانات كل أسابيع السنة (13 أسبوعاً: من الأحد 11/10/2026 إلى الأربعاء 28/7/1448هـ = 06/01/2027م) من نفس مصدر التقرير الأسبوعي.
 */

const PPR_PERIOD_NUMBER = 1;
const PPR_PERIOD_WEEKS = Array.from({ length: (typeof COURSE_WEEKS_COUNT !== 'undefined' ? COURSE_WEEKS_COUNT : 16) }, function (_, i) { return i + 1; });

function showParentPeriodReportWeb_(e) {
  const p = (e && e.parameter) || {};
  const studentName = String(p.studentName || PWR_DEFAULT_STUDENT || '').trim();
  const teamId = pwrNormalizeTeamId_(p.teamId || PWR_DEFAULT_TEAM_ID);
  const teacherName = String(p.teacherName || PWR_DEFAULT_TEACHER || '').trim();

  const report = pprBuildPeriodReportData_(studentName, teamId, teacherName);
  const template = HtmlService.createTemplateFromFile('ParentPeriodReportTemplate');
  template.reportJson = JSON.stringify(report);
  template.rabiLogoDataUrl = (typeof PWR_LOGO_DATA_URL !== 'undefined') ? PWR_LOGO_DATA_URL : '';

  const dashboardBaseUrl = (typeof prdGetPublicWebAppUrl_ === 'function')
    ? prdGetPublicWebAppUrl_()
    : String(ScriptApp.getService().getUrl() || '').trim().replace(/\/dev(?:\?.*)?$/, '/exec');

  template.dashboardUrl = dashboardBaseUrl
    ? dashboardBaseUrl + '?' + [
        'action=parentReports',
        'teamId=' + encodeURIComponent(teamId),
        'week=3',
        'teacherName=' + encodeURIComponent(teacherName)
      ].join('&')
    : '';

  return template.evaluate()
    .setTitle('تقرير الفترة الأولى - ' + studentName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** رابط سريع لتجربة تقرير الفترة الأولى على الطالب الافتراضي. */
function getParentPeriodReportTestUrl() {
  const base = String(ScriptApp.getService().getUrl() || '').trim().replace(/\/dev(?:\?.*)?$/, '/exec');
  if (!base) throw new Error('انشر المشروع أولاً كتطبيق ويب، ثم شغّل الدالة مرة أخرى.');

  const url = base + '?' + [
    'action=parentPeriodReport',
    'studentName=' + encodeURIComponent(PWR_DEFAULT_STUDENT || ''),
    'teamId=' + encodeURIComponent(PWR_DEFAULT_TEAM_ID || 'purple'),
    'teacherName=' + encodeURIComponent(PWR_DEFAULT_TEACHER || '')
  ].join('&');

  Logger.log('رابط تقرير الفترة الأولى: ' + url);
  return url;
}

function pprBuildPeriodReportData_(studentName, teamId, teacherName) {
  if (!studentName) throw new Error('اسم الطالب مطلوب');
  if (!teamId) throw new Error('الحلقة غير صحيحة');
  if (typeof pwrBuildParentReportData_ !== 'function') {
    throw new Error('ملف ParentReportWeb.gs غير موجود أو لم يتم حفظه.');
  }

  const weeklyReports = PPR_PERIOD_WEEKS.map(function(weekNumber) {
    return pwrBuildParentReportData_(studentName, teamId, weekNumber, teacherName);
  });

  const allDays = [];
  weeklyReports.forEach(function(weekReport) {
    (weekReport.days || []).forEach(function(day) {
      allDays.push(day);
    });
  });

  const dayCount = allDays.length;
  const pointsTotal = weeklyReports.reduce(function(sum, report) {
    return sum + pwrNumber_(report.pointsTotal);
  }, 0);
  const target = weeklyReports.reduce(function(sum, report) {
    return sum + pwrNumber_(report.target);
  }, 0);

  const presentCount = allDays.filter(function(day) { return day.hudur === 'حاضر'; }).length;
  const absentCount = allDays.filter(function(day) { return day.hudur === 'غائب'; }).length;
  const hifzTotal = allDays.reduce(function(sum, day) { return sum + pwrNumber_(day.hifzScore); }, 0);
  const reviewTotal = allDays.reduce(function(sum, day) { return sum + pwrNumber_(day.muraScore); }, 0);
  const bagCount = allDays.filter(function(day) { return day.haqiba === 'نعم'; }).length;
  const listeningCount = allDays.filter(function(day) { return day.istima === 'نعم'; }).length;

  const metrics = {
    attendance: pwrPct_(presentCount, dayCount),
    hifz: pwrPct_(hifzTotal, dayCount * 30),
    review: pwrPct_(reviewTotal, dayCount * 30),
    bag: pwrPct_(bagCount, dayCount),
    listening: pwrPct_(listeningCount, dayCount),
    overall: pwrPct_(pointsTotal, target)
  };

  const weeks = weeklyReports.map(function(report) {
    return {
      number: report.weekNumber,
      title: report.weekTitle,
      points: pwrNumber_(report.pointsTotal),
      target: pwrNumber_(report.target),
      percent: pwrNumber_(report.metrics && report.metrics.overall),
      grade: pwrGrade_(pwrNumber_(report.metrics && report.metrics.overall)),
      hasData: report.hasAnyRecord === true
    };
  });

  const feedback = pprBuildFeedback_(metrics);
  const goal = pprBuildGoal_(metrics);
  const teacherNote = pprFindLastTeacherNote_(weeklyReports);
  const achievement = {
    hifz: pprBuildRangeFromDays_(allDays, 'hifzFrom', 'hifzTo', 'لم يسجل مقرر حفظ خلال الفترة'),
    review: pprBuildRangeFromDays_(allDays, 'muraFrom', 'muraTo', 'لم يسجل مقرر مراجعة خلال الفترة')
  };

  const firstDay = allDays.length ? allDays[0] : null;
  const lastDay = allDays.length ? allDays[allDays.length - 1] : null;
  const dateRange = firstDay && lastDay
    ? 'من ' + firstDay.displayDate + ' إلى ' + lastDay.displayDate
    : '';

  return {
    reportType: 'period',
    periodNumber: PPR_PERIOD_NUMBER,
    periodTitle: 'الفترة الأولى',
    periodSubtitle: 'كل أسابيع السنة — من الأحد 11/10/2026 إلى الأربعاء 06/01/2027م (28/7/1448هـ)',
    studentName: studentName,
    teacherName: teacherName,
    teamId: teamId,
    teamName: weeklyReports[0] ? weeklyReports[0].teamName : pwrTeamName_(teamId),
    dateRange: dateRange,
    pointsTotal: pointsTotal,
    target: target,
    metrics: metrics,
    grade: pwrGrade_(metrics.overall),
    weeks: weeks,
    trend: pprBuildTrend_(weeks),
    totalDays: dayCount,
    presentCount: presentCount,
    absentCount: absentCount,
    bagCount: bagCount,
    listeningCount: listeningCount,
    achievement: achievement,
    positives: feedback.positives,
    improvements: feedback.improvements,
    periodGoal: goal,
    teacherNote: teacherNote,
    hasAnyRecord: weeklyReports.some(function(report) { return report.hasAnyRecord === true; })
  };
}

function pprBuildRangeFromDays_(days, fromKey, toKey, emptyText) {
  const rows = (days || []).filter(function(day) {
    const from = String(day[fromKey] || '').trim();
    const to = String(day[toKey] || '').trim();
    return !!from || !!to;
  });

  if (!rows.length) return emptyText;

  const first = rows[0];
  const last = rows[rows.length - 1];
  const from = String(first[fromKey] || first[toKey] || '').trim();
  const to = String(last[toKey] || last[fromKey] || '').trim();

  if (from === 'لا يوجد' && to === 'لا يوجد') return 'لا يوجد';
  return pwrRangeText_(from, to);
}

function pprFindLastTeacherNote_(weeklyReports) {
  for (let i = weeklyReports.length - 1; i >= 0; i--) {
    const note = String(weeklyReports[i].teacherNote || '').trim();
    if (note) return note;
  }
  return '';
}

function pprBuildTrend_(weeks) {
  const values = weeks.map(function(week) { return pwrNumber_(week.percent); });
  if (!values.length) return { label: 'لا توجد بيانات كافية', type: 'neutral' };

  const first = values[0];
  const last = values[values.length - 1];
  const increasing = values.every(function(value, index) {
    return index === 0 || value >= values[index - 1];
  });
  const decreasing = values.every(function(value, index) {
    return index === 0 || value <= values[index - 1];
  });

  if (increasing && last > first) {
    return { label: 'تحسن مستمر خلال الفترة', type: 'up' };
  }
  if (decreasing && last < first) {
    return { label: 'يحتاج إلى استعادة مستواه', type: 'down' };
  }
  if (last - first >= 8) {
    return { label: 'تحسن واضح في نهاية الفترة', type: 'up' };
  }
  if (first - last >= 8) {
    return { label: 'انخفاض يحتاج إلى متابعة', type: 'down' };
  }
  return { label: 'مستوى مستقر خلال الفترة', type: 'steady' };
}

function pprBuildFeedback_(metrics) {
  const positives = [];
  const improvements = [];

  if (metrics.attendance >= 90) positives.push('التزام ممتاز بالحضور والانضباط.');
  else improvements.push('الحرص على الانتظام في الحضور.');

  if (metrics.hifz >= 80) positives.push('تقدم واضح في الحفظ المقرر.');
  else improvements.push('زيادة المراجعة اليومية للحفظ.');

  if (metrics.review >= 80) positives.push('أداء جيد في تثبيت المراجعة.');
  else improvements.push('تخصيص وقت ثابت للمراجعة.');

  if (metrics.bag >= 90) positives.push('ملتزم بإحضار الحقيبة بانتظام.');
  else improvements.push('الاهتمام بإحضار الحقيبة يومياً.');

  if (metrics.listening >= 80) positives.push('انتظام جيد في الاستماع للمقرر.');
  else improvements.push('الاستماع للمقرر قبل موعد الحلقة.');

  while (positives.length < 3) positives.push('نقدّر جهوده واستمراره في البرنامج.');
  while (improvements.length < 3) improvements.push('الاستمرار في المتابعة اليومية والتشجيع.');

  return {
    positives: positives.slice(0, 3),
    improvements: improvements.slice(0, 3)
  };
}

function pprBuildGoal_(metrics) {
  const items = [
    { key: 'review', value: metrics.review, text: 'رفع مستوى المراجعة إلى 80% مع المحافظة على الحضور.' },
    { key: 'hifz', value: metrics.hifz, text: 'رفع مستوى الحفظ إلى 80% مع الاستمرار في المراجعة اليومية.' },
    { key: 'listening', value: metrics.listening, text: 'رفع مستوى الاستماع إلى 80% قبل موعد الحلقة.' },
    { key: 'attendance', value: metrics.attendance, text: 'المحافظة على الحضور الكامل والانضباط اليومي.' },
    { key: 'bag', value: metrics.bag, text: 'الالتزام بإحضار الحقيبة في جميع أيام البرنامج.' }
  ];

  items.sort(function(a, b) { return a.value - b.value; });
  if (items[0].value >= 85) {
    return 'المحافظة على هذا المستوى المتميز ومواصلة التقدم في الحفظ والمراجعة.';
  }
  return items[0].text;
}
