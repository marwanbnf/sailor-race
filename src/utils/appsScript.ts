// اتصال JSONP بـ Google Apps Script (يتجاوز قيود CORS في صفحات GitHub Pages).
export const APPS_SCRIPT_URL = String(import.meta.env.VITE_APPS_URL || "");

type JsonpWindow = Window & Record<string, unknown>;

export function appsScriptJsonp<T>(
  action: string,
  params: Record<string, string> = {},
  timeoutMs = 45000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!APPS_SCRIPT_URL.includes("script.google.com")) {
      reject(new Error("رابط Apps Script غير مضبوط"));
      return;
    }

    const callbackName = `__sailorReport_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      delete (window as unknown as JsonpWindow)[callbackName];
      script.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("تأخر الاتصال بالخادم، حاول مرة أخرى"));
    }, timeoutMs);

    (window as unknown as JsonpWindow)[callbackName] = (payload: T) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("تعذر الاتصال بالخادم"));
    };

    const query = new URLSearchParams({ action, callback: callbackName, ...params });
    const separator = APPS_SCRIPT_URL.includes("?") ? "&" : "?";
    script.src = `${APPS_SCRIPT_URL}${separator}${query.toString()}`;
    document.body.appendChild(script);
  });
}
