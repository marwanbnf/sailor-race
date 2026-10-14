# ملفات Google Apps Script

نسخة من مشروع Apps Script المرتبط بشيت التقارير. الموقع يتصل به عبر رابط `VITE_APPS_URL`.

| الملف | الوظيفة |
|---|---|
| `Code.gs` | الحفظ والقراءة من شيت البيانات، وبناء تقارير الحلقات |
| `ParentReport.gs` / `ParentReportWeb.gs` | التقرير الأسبوعي لولي الأمر |
| `ParentPeriodReport.gs` | التقرير الختامي لولي الأمر |
| `ParentReportsDashboard.gs` | لوحة تقارير أولياء الأمور |
| `ReportsApi.gs` | بيانات JSON سريعة لصفحات التقارير في الموقع (`#/reports` و `#/report`) |
| `*.html` | قوالب صفحات التقارير |

## التطبيق
هذه الملفات لا تُنشر تلقائياً. بعد أي تعديل: انسخ الملف إلى محرّر Apps Script، ثم
**Deploy ← Manage deployments ← ✏️ ← New version ← Deploy**.

## كلمة مرور الإدارة
لا تُكتب في الكود لأن المستودع عام. تُحفظ في **Project Settings ⚙️ ← Script Properties**
باسم `RESET_PASSWORD`. بدونها تُرفض عمليات التصفير وتعديل البنود.
