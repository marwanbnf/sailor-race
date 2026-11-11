// يولّد index.html من data.json.  التشغيل: node build.mjs
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync(new URL("./data.json", import.meta.url), "utf8"));
const COLORS = { 1: "#3b82f6", 2: "#ef4444", 3: "#22b45a", 4: "#a259f7" };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------- الخط الزمني (ثوانٍ) ----------
const T = { intro: [0, 6.4] };
let t = 6.4;
const HQ = 8.4; // ٢ ث لاسم الحلقة، ثم الأول، وبعد ٣ ث الثاني
data.halaqat.forEach((h) => { T["h" + h.n] = [t, HQ]; t += HQ; });
T.star = [t, 8.4]; t += 8.4;
T.list = [t, 7.6]; t += 7.6;
T.outro = [t, 5.8]; t += 5.8;
const TOTAL = +t.toFixed(2);
const EXIT = 0.32, ENTER = 0.42;
const best = data.halaqat.find((h) => h.n === data.distinguished);

// ---------- رسوم ----------
const ship = (color, cls = "") => `<svg class="ship ${cls}" viewBox="0 0 200 180" aria-hidden="true">
  <path d="M104 6 L104 128" stroke="#5b3716" stroke-width="6" stroke-linecap="round"/>
  <path d="M104 10 L128 18 L104 26 Z" fill="${color}"/>
  <path d="M108 28 Q160 70 176 122 L108 122 Z" fill="${color}"/>
  <path d="M100 40 Q70 80 44 120 L100 120 Z" fill="#fffaf0"/>
  <path d="M14 128 L188 128 Q178 160 150 166 L48 166 Q22 160 14 128 Z" fill="#8a5527"/>
  <path d="M16 128 L186 128 L183 139 L19 139 Z" fill="${color}"/>
  <path d="M40 152 L162 152" stroke="#6b3f18" stroke-width="4" stroke-linecap="round" opacity=".6"/>
</svg>`;

const buoy = (num, accent) => `<div class="buoy">
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="100" r="78" fill="none" stroke="#fff" stroke-width="40"/>
    <circle cx="100" cy="100" r="78" fill="none" stroke="${accent}" stroke-width="40" stroke-dasharray="61.26 61.26" transform="rotate(-22 100 100)"/>
    <circle cx="100" cy="100" r="98" fill="none" stroke="#12355b" stroke-opacity=".18" stroke-width="3"/>
    <circle cx="100" cy="100" r="58" fill="#fff"/>
  </svg>
  <span>${num}</span>
</div>`;

const crown = `<svg class="crown" viewBox="0 0 220 160" aria-hidden="true">
  <path d="M20 140 L10 40 L65 85 L110 15 L155 85 L210 40 L200 140 Z" fill="#ffc83d" stroke="#d98a00" stroke-width="6" stroke-linejoin="round"/>
  <rect x="20" y="128" width="180" height="22" rx="8" fill="#ffb21f" stroke="#d98a00" stroke-width="5"/>
  <circle cx="110" cy="95" r="13" fill="#ef4444"/><circle cx="62" cy="108" r="9" fill="#3b82f6"/><circle cx="158" cy="108" r="9" fill="#22b45a"/>
</svg>`;

const star = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4 L62 36 L96 38 L69 59 L79 93 L50 73 L21 93 L31 59 L4 38 L38 36 Z" fill="#ffd34d" stroke="#ff8a1f" stroke-width="5" stroke-linejoin="round"/></svg>`;

const cloud = (id, x, y, s) => `<svg id="${id}" class="cloud" style="left:${x}px;top:${y}px;width:${260 * s}px" viewBox="0 0 260 110" aria-hidden="true">
  <g fill="#fff"><ellipse cx="80" cy="72" rx="62" ry="34"/><ellipse cx="135" cy="52" rx="58" ry="46"/><ellipse cx="190" cy="74" rx="56" ry="30"/><rect x="40" y="70" width="190" height="36" rx="18"/></g>
</svg>`;

// موجة متكرّرة بعرض 3840 ودورة 320
const wave = (id, top, color, amp, period, travel) => {
  const W = 1920 + travel + 2 * period;
  let d = `M0 ${amp}`;
  for (let x = 0; x < W; x += period) d += ` Q${x + period / 4} ${-amp + amp} ${x + period / 2} ${amp} T${x + period} ${amp}`;
  d += ` L${W + period} 600 L0 600 Z`;
  return `<svg id="${id}" class="wave" data-travel="${travel}" style="top:${top}px" width="${W}" height="600" viewBox="0 0 ${W} 600" aria-hidden="true"><path d="${d}" fill="${color}"/></svg>`;
};

// ---------- مشهد الحلقة ----------
const card = (h, rank) => {
  const c = COLORS[h.n];
  const first = rank === 1;
  const name = first ? h.first : h.second;
  const p = first ? 1 : 0.78;
  const id = `h${h.n}${first ? "a" : "b"}`;
  return `<div id="${id}" class="card ${first ? "is-first" : ""}" style="--c:${c}" data-p="${p}">
      ${buoy(first ? "١" : "٢", first ? "#ffb21f" : "#ff8a1f")}
      <div class="ribbon"><span>${first ? "المركز الأول" : "المركز الثاني"}</span></div>
      <div class="name">${esc(name)}</div>
      <div class="badge">${ship("#fff", "mini")}<span>${esc(h.label)}</span></div>
      <div class="journey">
        <div class="rope"></div><div class="rope-done"></div>
        <img class="isl isl-start" src="assets/img/island-start.png" alt="">
        <img class="isl isl-win" src="assets/img/island-win.png" alt="">
        <div class="boat">${ship(c)}</div>
      </div>
    </div>`;
};

const halaqaScene = (h) => {
  const [s, d] = T["h" + h.n];
  return `
  <section id="s-h${h.n}" class="clip scene" data-start="${s}" data-duration="${d}" data-track-index="2">
    <div class="stage" id="st-h${h.n}">
      <div class="tc" id="tc-h${h.n}" style="--c:${COLORS[h.n]}"><div class="tc-name">${esc(h.label)}</div><div class="tc-ship">${ship(COLORS[h.n])}</div></div>
      <h2 class="head" id="hd-h${h.n}">أوائلُ <span style="color:${COLORS[h.n]}">${esc(h.label)}</span></h2>
      ${card(h, 1)}
      ${card(h, 2)}
    </div>
  </section>`;
};

// قصاصات بمولّد ثابت البذرة
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const confColors = ["#3b82f6", "#ef4444", "#22b45a", "#a259f7", "#ff8a1f", "#ffd34d"];
const confetti = Array.from({ length: 90 }, (_, i) => {
  const x = Math.round(rnd() * 1920), w = 12 + Math.round(rnd() * 12), hgt = 18 + Math.round(rnd() * 14);
  return { i, x, w, hgt, col: confColors[i % 6], dx: Math.round((rnd() - 0.5) * 260), rot: Math.round((rnd() - 0.5) * 1080), delay: +(rnd() * 0.9).toFixed(2), dur: +(2.6 + rnd() * 1.4).toFixed(2), y0: -40 - Math.round(rnd() * 260) };
});

const listPanel = (h, i) => `<div class="panel ${h.n === data.distinguished ? "is-best" : ""}" id="pn${h.n}" style="--c:${COLORS[h.n]}">
      <div class="p-head">${ship("#fff", "mini")}<span>${esc(h.label)}</span>${h.n === data.distinguished ? `<div class="p-crown">${crown}</div>` : ""}</div>
      <div class="p-row"><b class="p-num gold">١</b><span>${esc(h.first)}</span></div>
      <div class="p-row"><b class="p-num">٢</b><span>${esc(h.second)}</span></div>
    </div>`;

// ---------- الصفحة ----------
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, height=1080">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
@font-face{font-family:"Baloo Bhaijaan 2";src:url("assets/fonts/BalooBhaijaan2-ar.woff2") format("woff2");font-weight:400 800;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC;}
@font-face{font-family:"Baloo Bhaijaan 2";src:url("assets/fonts/BalooBhaijaan2-lat.woff2") format("woff2");font-weight:400 800;font-display:block;unicode-range:U+0000-00FF,U+2000-206F;}
@font-face{font-family:"Reem Kufi";src:url("assets/fonts/ReemKufi-ar.woff2") format("woff2");font-weight:400 700;font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC;}
@font-face{font-family:"Reem Kufi";src:url("assets/fonts/ReemKufi-lat.woff2") format("woff2");font-weight:400 700;font-display:block;unicode-range:U+0000-00FF,U+2000-206F;}
@font-face{font-family:"Amiri Quran";src:url("assets/fonts/AmiriQuran-ar.woff2") format("woff2");font-display:block;unicode-range:U+0600-06FF,U+0750-077F,U+08A0-08FF,U+200C-200E,U+FB50-FDFF,U+FE70-FEFC;}
@font-face{font-family:"Amiri Quran";src:url("assets/fonts/AmiriQuran-lat.woff2") format("woff2");font-display:block;unicode-range:U+0000-00FF,U+2000-206F;}
:root{--ink:#12355b;--orange:#ff8a1f;--gold:#ffc83d;}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:1920px;height:1080px;overflow:hidden;background:#8fd8ff;}
body{font-family:"Baloo Bhaijaan 2",sans-serif;color:var(--ink);}
#root{position:relative;width:1920px;height:1080px;overflow:hidden;}
.clip{position:absolute;inset:0;}
.stroke{-webkit-text-stroke:14px #fff;paint-order:stroke fill;}

/* العالم */
#world{background:linear-gradient(180deg,#5cc6f7 0%,#9fe0ff 42%,#d8f4ff 58%);}
#sun{position:absolute;left:150px;top:70px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,#fff6b0 0%,#ffd84a 55%,#ffc21f 70%,rgba(255,200,40,0) 71%);box-shadow:0 0 120px 50px rgba(255,220,90,.55);}
.cloud{position:absolute;opacity:.95;filter:drop-shadow(0 8px 0 rgba(18,53,91,.06));}
.wave{position:absolute;left:0;}
#sea-base{position:absolute;left:0;right:0;top:640px;bottom:0;background:linear-gradient(180deg,#36b3e3,#0f6fa8);}
.fleet{position:absolute;width:150px;}
.fleet .ship{width:100%;display:block;}
#veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(255,255,255,.18));opacity:0;}

.scene .stage{position:absolute;inset:0;}

/* الافتتاحية */
#in-badge{position:absolute;top:96px;left:50%;transform:translateX(-50%);background:var(--orange);color:#fff;font-weight:800;font-size:44px;line-height:1;padding:18px 44px 22px;border-radius:999px;box-shadow:0 8px 0 #d96a00;white-space:nowrap;}
#in-title{position:absolute;top:150px;left:0;right:0;text-align:center;font-family:"Reem Kufi",sans-serif;font-weight:700;font-size:190px;line-height:1.25;color:var(--ink);}
#in-tag{position:absolute;top:410px;left:0;right:0;text-align:center;font-size:56px;font-weight:700;line-height:1.3;}
#in-ribbon{position:absolute;top:510px;left:50%;}
.isl-big{position:absolute;width:260px;filter:drop-shadow(0 18px 14px rgba(18,53,91,.25));}
#isl-a{left:1520px;top:600px;} #isl-b{left:150px;top:590px;}
.isl-label{position:absolute;font-weight:800;font-size:34px;line-height:1;background:#fff;color:var(--ink);padding:10px 26px 14px;border-radius:999px;white-space:nowrap;box-shadow:0 6px 0 rgba(18,53,91,.15);}
#lab-a{left:1650px;top:870px;transform:translateX(-50%);} #lab-b{left:280px;top:860px;transform:translateX(-50%);}
#jstar{position:absolute;left:0;top:0;width:90px;height:90px;margin:-45px 0 0 -45px;filter:drop-shadow(0 0 18px rgba(255,210,60,.95));}
#logo{position:absolute;right:40px;top:30px;width:190px;background:rgba(255,255,255,.92);border-radius:28px;padding:14px;box-shadow:0 10px 30px rgba(18,53,91,.18);}
#logo img{width:100%;display:block;}

/* الشريط */
.ribbon{position:relative;display:inline-flex;justify-content:center;align-items:center;}
.ribbon span{display:block;background:var(--orange);color:#fff;font-weight:800;font-size:46px;line-height:1;padding:16px 64px 22px;clip-path:polygon(0 0,100% 0,96% 50%,100% 100%,0 100%,4% 50%);white-space:nowrap;}

/* مشاهد الحلقات */
.tc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:330px;}
.tc-name{font-size:210px;font-weight:800;line-height:1.25;color:var(--c);-webkit-text-stroke:16px #fff;paint-order:stroke fill;white-space:nowrap;}
.tc-ship{width:230px;margin-top:6px;} .tc-ship .ship{width:100%;display:block;}
.head{position:absolute;top:44px;left:0;right:0;text-align:center;font-size:92px;font-weight:800;line-height:1.25;-webkit-text-stroke:14px #fff;paint-order:stroke fill;}
.card{position:absolute;left:310px;top:205px;width:1300px;height:820px;background:#fff;border-radius:56px;box-shadow:0 26px 0 rgba(18,53,91,.12),0 30px 80px rgba(18,53,91,.25);border:10px solid var(--c);display:flex;flex-direction:column;align-items:center;padding-top:36px;}
.buoy{position:relative;width:190px;height:190px;}
.buoy svg{width:100%;height:100%;display:block;}
.buoy span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:96px;line-height:1;padding-bottom:10px;color:var(--ink);}
.card .ribbon{margin-top:-26px;}
.is-first .ribbon span{background:linear-gradient(180deg,#ffcf3d,#ffa51f);color:var(--ink);}
.name{margin-top:26px;font-size:124px;font-weight:800;line-height:1.2;white-space:nowrap;}
.badge{margin-top:14px;display:inline-flex;align-items:center;gap:16px;background:var(--c);color:#fff;font-weight:800;font-size:46px;line-height:1;padding:12px 36px 18px;border-radius:999px;}
.ship.mini{width:62px;height:auto;display:block;}
.journey{position:relative;margin-top:34px;width:1060px;height:150px;}
.rope{position:absolute;left:120px;right:120px;top:92px;height:0;border-top:10px dashed #b8d7ea;}
.rope-done{position:absolute;right:150px;top:88px;height:18px;width:0;border-radius:9px;background:linear-gradient(90deg,#ffd34d,#ff8a1f);}
.isl{position:absolute;top:0;width:150px;}
.isl-start{right:0;} .isl-win{left:0;}
.boat{position:absolute;right:150px;top:20px;width:130px;}
.boat .ship{width:100%;display:block;}

/* الحلقة المتميزة */
#sv-q{position:absolute;top:120px;left:0;right:0;text-align:center;font-size:104px;font-weight:800;line-height:1.3;-webkit-text-stroke:16px #fff;paint-order:stroke fill;}
#sv-isl{position:absolute;left:90px;top:610px;width:400px;filter:drop-shadow(0 20px 18px rgba(18,53,91,.3));}
#sv-glow{position:absolute;left:40px;top:560px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle,rgba(255,215,80,.85),rgba(255,215,80,0) 65%);opacity:0;}
#sv-card{position:absolute;left:640px;top:200px;width:1100px;height:440px;background:#fff;border-radius:56px;border:12px solid ${COLORS[data.distinguished]};box-shadow:0 26px 0 rgba(18,53,91,.12),0 30px 80px rgba(18,53,91,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;}
#sv-card .ribbon span{background:linear-gradient(180deg,#ffcf3d,#ffa51f);color:var(--ink);font-size:52px;}
#sv-name{font-size:150px;font-weight:800;line-height:1.2;color:${COLORS[data.distinguished]};margin-top:10px;}
#sv-crown{position:absolute;left:1095px;top:62px;width:190px;}
#sv-crown .crown{width:100%;display:block;filter:drop-shadow(0 10px 10px rgba(18,53,91,.25));}
#sv-ship{position:absolute;left:0;top:810px;width:260px;}
#sv-ship .ship{width:100%;display:block;}
#sv-banner{position:absolute;left:640px;width:1100px;top:720px;display:flex;justify-content:center;}
#sv-banner span{background:var(--ink);color:#fff;font-weight:800;font-size:56px;line-height:1;padding:22px 56px 30px;border-radius:999px;white-space:nowrap;box-shadow:0 10px 0 rgba(0,0,0,.15);}
.conf{position:absolute;top:0;border-radius:4px;}

/* القائمة الختامية */
#ls-title{position:absolute;top:14px;left:0;right:0;text-align:center;font-family:"Reem Kufi",sans-serif;font-weight:700;font-size:100px;line-height:1.3;-webkit-text-stroke:14px #fff;paint-order:stroke fill;}
#ls-grid{position:absolute;top:185px;left:110px;right:110px;display:grid;grid-template-columns:1fr 1fr;gap:34px 48px;}
.panel{position:relative;background:#fff;border-radius:40px;border:8px solid var(--c);padding:0 0 18px;overflow:visible;box-shadow:0 16px 40px rgba(18,53,91,.18);}
.p-head{position:relative;display:flex;align-items:center;justify-content:center;gap:16px;background:var(--c);color:#fff;font-weight:800;font-size:44px;line-height:1;padding:12px 0 18px;border-radius:30px 30px 0 0;}
.p-crown{position:absolute;left:24px;top:-50px;width:96px;}
.p-crown .crown{width:100%;display:block;}
.p-row{display:flex;align-items:center;gap:22px;padding:8px 44px 0;font-size:52px;font-weight:800;line-height:1.2;}
.p-num{flex:none;width:72px;height:72px;border-radius:50%;background:#e9f2fb;display:flex;align-items:center;justify-content:center;font-size:44px;line-height:1;padding-bottom:6px;}
.p-num.gold{background:linear-gradient(180deg,#ffd34d,#ffa51f);}
.glow{position:absolute;inset:-10px;border-radius:46px;box-shadow:0 0 0 8px #ffd34d,0 0 60px 16px rgba(255,200,60,.8);opacity:0;pointer-events:none;}
#ls-ayah{position:absolute;top:792px;left:0;right:0;text-align:center;}
#ls-ayah .a{font-family:"Amiri Quran",serif;font-size:78px;line-height:1.55;display:block;color:var(--ink);-webkit-text-stroke:12px #fff;paint-order:stroke fill;}
#ls-ayah .r{display:block;font-size:38px;font-weight:700;line-height:1;margin-top:18px;-webkit-text-stroke:8px #fff;paint-order:stroke fill;}

/* الخاتمة */
#ou-title{position:absolute;top:110px;left:0;right:0;text-align:center;font-family:"Reem Kufi",sans-serif;font-weight:700;font-size:170px;line-height:1.3;color:var(--ink);-webkit-text-stroke:16px #fff;paint-order:stroke fill;}
#ou-logo{position:absolute;left:50%;top:370px;width:230px;margin-left:-115px;background:rgba(255,255,255,.94);border-radius:36px;padding:18px;box-shadow:0 14px 40px rgba(18,53,91,.2);}
#ou-logo img{width:100%;display:block;}
#ou-spark{position:absolute;left:280px;top:680px;width:420px;height:420px;margin:-210px 0 0 -210px;border-radius:50%;background:radial-gradient(circle,rgba(255,225,110,.95),rgba(255,215,80,0) 62%);opacity:0;}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1920" data-height="1080" data-motion-blur="on">

  <!-- العالم الثابت: سماء وشمس وغيوم وبحر وسفن -->
  <div id="world" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="0" data-layout-ignore>
    <div id="sun"></div>
    ${cloud("cl1", 420, 70, 1.1)}${cloud("cl2", 980, 150, 0.8)}${cloud("cl3", 1500, 60, 1.0)}${cloud("cl4", 1980, 190, 0.7)}${cloud("cl5", -200, 220, 0.75)}
    <div id="sea-base"></div>
    ${wave("wv1", 600, "#7fd6f5", 14, 360, 1080)}
    <div class="fleet" id="sh1" style="left:1130px;top:664px">${ship(COLORS[1])}</div>
    <div class="fleet" id="sh2" style="left:930px;top:684px">${ship(COLORS[2])}</div>
    <div class="fleet" id="sh3" style="left:730px;top:664px">${ship(COLORS[3])}</div>
    <div class="fleet" id="sh4" style="left:530px;top:684px">${ship(COLORS[4])}</div>
    ${wave("wv2", 792, "#3db2e2", 18, 300, 1200)}
    ${wave("wv3", 900, "#1786c4", 22, 420, 1680)}
    <div id="veil"></div>
  </div>

  <!-- الافتتاحية -->
  <section id="s-intro" class="clip scene" data-start="${T.intro[0]}" data-duration="${T.intro[1]}" data-track-index="2">
    <div class="stage" id="st-intro">
      <div id="in-badge">مسابقة قرآنية تفاعلية</div>
      <h1 id="in-title" class="stroke">سباق البحّارة</h1>
      <p id="in-tag" class="stroke">حيث يُبحر حفظُ أبنائنا نحو جزيرة الفوز</p>
      <img id="isl-a" class="isl-big" src="assets/img/island-start.png" alt="">
      <img id="isl-b" class="isl-big" src="assets/img/island-win.png" alt="">
      <div id="lab-a" class="isl-label">جزيرة الانطلاق</div>
      <div id="lab-b" class="isl-label">جزيرة الفوز</div>
      <div id="in-ribbon"><div class="ribbon"><span>أوائل الحلقات</span></div></div>
      <div id="logo"><img src="assets/img/riyada.png" alt="شعار فريق ريادة"></div>
    </div>
  </section>
${data.halaqat.map(halaqaScene).join("")}
  <!-- الحلقة المتميزة -->
  <section id="s-star" class="clip scene" data-start="${T.star[0]}" data-duration="${T.star[1]}" data-track-index="2">
    <div class="stage" id="st-star">
      <div id="sv-glow"></div>
      <img id="sv-isl" src="assets/img/island-win.png" alt="">
      <h2 id="sv-q">والحلقةُ المتميّزةُ هي…</h2>
      <div id="sv-card"><div class="ribbon"><span>الحلقة المتميّزة</span></div><div id="sv-name">${esc(best.label)}</div></div>
      <div id="sv-crown">${crown}</div>
      <div id="sv-ship">${ship(COLORS[data.distinguished])}</div>
      <div id="sv-banner"><span>وصلت أولًا إلى جزيرة الفوز!</span></div>
      <div id="sv-conf" data-layout-ignore>${confetti.map((c) => `<i class="conf" id="cf${c.i}" style="left:${c.x}px;width:${c.w}px;height:${c.hgt}px;background:${c.col}"></i>`).join("")}</div>
    </div>
  </section>

  <!-- القائمة الختامية -->
  <section id="s-list" class="clip scene" data-start="${T.list[0]}" data-duration="${T.list[1]}" data-track-index="2">
    <div class="stage" id="st-list">
      <h2 id="ls-title">أوائل الحلقات</h2>
      <div id="ls-grid">
        ${data.halaqat.map(listPanel).join("\n        ")}
      </div>
      <div id="ls-ayah"><span class="a">﴿وَفِي ذَٰلِكَ فَلْيَتَنَافَسِ الْمُتَنَافِسُونَ﴾</span><span class="r">[المطففين: ٢٦]</span></div>
    </div>
  </section>

  <!-- الخاتمة -->
  <section id="s-outro" class="clip scene" data-start="${T.outro[0]}" data-duration="${T.outro[1]}" data-track-index="2">
    <div class="stage" id="st-outro">
      <img id="ou-isl-a" class="isl-big" style="left:1520px;top:600px" src="assets/img/island-start.png" alt="">
      <img id="ou-isl-b" class="isl-big" style="left:150px;top:590px" src="assets/img/island-win.png" alt="">
      <div id="ou-spark"></div>
      <h2 id="ou-title">مبارك للأبطال!</h2>
      <div id="ou-logo"><img src="assets/img/riyada.png" alt="شعار فريق ريادة"></div>
    </div>
  </section>

  <!-- النجمة: تبدأ رحلتها في الافتتاحية وتُتمّها في الخاتمة -->
  <div id="star-layer" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="3" data-layout-ignore>
    <div id="jstar">${star}</div>
  </div>
</div>

<script>
(function(){
  const T = ${JSON.stringify(T)}, TOTAL = ${TOTAL}, EXIT = ${EXIT}, ENTER = ${ENTER};
  const tl = gsap.timeline({ paused: true });
  const blurIn = (sel, at, d = 0.3) => tl.fromTo(sel, { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: d, ease: "power2.out" }, at);
  const popIn  = (sel, at) => tl.fromTo(sel, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.42, ease: "power3.out" }, at);
  // دخول من اليمين نحو اليسار، وخروج نحو اليسار (نحو جزيرة الفوز)
  const enter = (sel, at) => tl.fromTo(sel, { x: 560, opacity: 0 }, { x: 0, opacity: 1, duration: ENTER, ease: "power3.out" }, at);
  const exit  = (sel, at) => tl.fromTo(sel, { x: 0, opacity: 1 }, { x: -620, opacity: 0, duration: EXIT, ease: "power3.in", immediateRender: false }, at);

  // ---- العالم: أمواج وغيوم بسرعة ثابتة ----
  tl.fromTo("#wv1", { x: 0 }, { x: -1080, duration: TOTAL, ease: "none" }, 0);
  tl.fromTo("#wv2", { x: 0 }, { x: -1200, duration: TOTAL, ease: "none" }, 0);
  tl.fromTo("#wv3", { x: 0 }, { x: -1680, duration: TOTAL, ease: "none" }, 0);
  ["#cl1","#cl2","#cl3","#cl4","#cl5"].forEach((c, i) => tl.fromTo(c, { x: 0 }, { x: -(260 + i * 70), duration: TOTAL, ease: "none" }, 0));
  // السفن الأربع تُبحر إلى المشهد ثم تسكن
  ["#sh1","#sh2","#sh3","#sh4"].forEach((s, i) => tl.fromTo(s, { x: 1100 + i * 120 }, { x: 0, duration: 2.4, ease: "power3.out" }, 0.1 + i * 0.12));
  // ستارة خفيفة خلف البطاقات
  tl.fromTo("#veil", { opacity: 0 }, { opacity: 1, duration: ENTER, ease: "power2.out" }, T.h1[0]);
  tl.fromTo("#veil", { opacity: 1 }, { opacity: 0, duration: ENTER, ease: "power2.out", immediateRender: false }, T.outro[0]);

  // ---- الافتتاحية ----
  const I = T.intro[0];
  popIn("#in-badge", I + 0.5);
  blurIn("#in-title", I + 1.0, 0.4);
  blurIn("#in-tag", I + 1.9);
  blurIn(["#isl-a", "#isl-b"], I + 2.6, 0.4);
  blurIn(["#lab-a", "#lab-b"], I + 2.9);
  tl.fromTo("#in-ribbon", { opacity: 0, xPercent: -50, scaleX: 0.4 }, { opacity: 1, xPercent: -50, scaleX: 1, duration: 0.42, ease: "power3.out" }, I + 4.3);
  popIn("#logo", I + 4.8);
  exit("#st-intro", T.intro[0] + T.intro[1] - EXIT);

  // ---- النجمة على قوسٍ من جزيرة الانطلاق إلى جزيرة الفوز ----
  const P0 = [1650, 640], P1 = [960, 600], P2 = [280, 640];
  const st = { p: 0, o: 0 };
  const place = () => {
    const p = st.p, q = 1 - p;
    const x = q*q*P0[0] + 2*q*p*P1[0] + p*p*P2[0], y = q*q*P0[1] + 2*q*p*P1[1] + p*p*P2[1];
    gsap.set("#jstar", { x, y, opacity: st.o, rotation: p * 360 });
  };
  tl.fromTo(st, { o: 0 }, { o: 1, duration: 0.3, onUpdate: place }, I + 3.1);
  tl.fromTo(st, { p: 0 }, { p: 0.5, duration: 1.9, ease: "power1.inOut", onUpdate: place, immediateRender: false }, I + 3.3);
  tl.to(st, { o: 0, duration: EXIT, ease: "power3.in", onUpdate: place }, T.intro[0] + T.intro[1] - EXIT);
  const O = T.outro[0];
  tl.to(st, { o: 1, duration: 0.3, onUpdate: place }, O + ENTER);
  tl.to(st, { p: 1, duration: 1.7, ease: "power2.inOut", onUpdate: place }, O + 0.6);
  tl.to(st, { o: 0, duration: 0.25, onUpdate: place }, O + 2.4);

  // ---- مشاهد الحلقات ----
  ${JSON.stringify(data.halaqat.map((h) => h.n))}.forEach((n) => {
    const s = T["h" + n][0], d = T["h" + n][1];
    // ١) اسم الحلقة وحده ثانيتين
    blurIn("#tc-h" + n + " .tc-name", s, 0.4);
    tl.fromTo("#tc-h" + n + " .tc-ship", { x: 700, opacity: 0 }, { x: 0, opacity: 1, duration: 1.1, ease: "power3.out" }, s + 0.2);
    exit("#tc-h" + n, s + 2.0 - EXIT);
    // ٢) الأول، ثم بعد ٣ ثوانٍ الثاني
    const A = s + 2.0, B = A + 3.0;
    enter("#hd-h" + n, A);
    const run = (id, at, p) => {
      const c = "#" + id;
      enter(c, at);
      popIn(c + " .buoy", at + 0.15);
      tl.fromTo(c + " .ribbon", { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: 0.3, ease: "power3.out" }, at + 0.4);
      blurIn(c + " .name", at + 0.6, 0.3);
      popIn(c + " .badge", at + 0.95);
      blurIn(c + " .journey", at + 1.2, 0.25);
      const L = 650; // مسافة الإبحار
      tl.fromTo(c + " .boat", { x: 0 }, { x: -L * p, duration: 1.0, ease: "power2.inOut" }, at + 1.35);
      tl.fromTo(c + " .rope-done", { width: 0 }, { width: 760 * p, duration: 1.0, ease: "power2.inOut" }, at + 1.35);
      if (p >= 1) tl.fromTo(c + " .isl-win", { filter: "drop-shadow(0 0 0px rgba(255,200,60,0))" }, { filter: "drop-shadow(0 0 26px rgba(255,200,60,1))", duration: 0.3, ease: "power2.out" }, at + 2.3);
    };
    run("h" + n + "a", A, 1);
    exit("#h" + n + "a", B - EXIT);
    run("h" + n + "b", B, 0.78);
    exit("#st-h" + n, s + d - EXIT);
  });

  // ---- الحلقة المتميزة ----
  const S = T.star[0];
  enter("#sv-q", S);
  blurIn(["#sv-isl"], S + 0.5, 0.4);
  // سكون قصير، ثم يرتفع السؤال ويصعد الكشف
  tl.to("#sv-q", { y: -60, opacity: 0, duration: 0.3, ease: "power3.in" }, S + 2.3);
  tl.fromTo("#sv-card", { y: 260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, S + 2.65);
  tl.fromTo("#sv-crown", { y: -300, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, S + 3.3);
  ${JSON.stringify(confetti.map((c) => [c.i, c.dx, c.rot, c.delay, c.dur, c.y0]))}.forEach(([i, dx, rot, dl, du, y0]) => {
    tl.fromTo("#cf" + i, { y: y0, x: 0, rotation: 0, opacity: 1 }, { y: 1160, x: dx, rotation: rot, duration: du, ease: "power1.in" }, S + 3.6 + dl);
  });
  tl.fromTo("#sv-ship", { x: 1900 }, { x: 330, duration: 1.7, ease: "power2.inOut" }, S + 4.3);
  tl.fromTo("#sv-glow", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }, S + 5.9);
  tl.fromTo("#sv-banner", { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, ease: "power3.out" }, S + 6.1);
  exit("#st-star", S + T.star[1] - EXIT);

  // ---- القائمة الختامية ----
  const Lt = T.list[0];
  enter("#ls-title", Lt);
  ${JSON.stringify(data.halaqat.map((h) => h.n))}.forEach((n, i) => {
    blurIn("#pn" + n, Lt + 0.7 + i * 0.75, 0.3);
  });
  ${JSON.stringify(data.halaqat.map((h) => h.n))}.forEach((n, i) => {
    tl.fromTo("#pn" + n, { boxShadow: "0 0 0 0 rgba(255,200,60,0), 0 16px 40px rgba(18,53,91,.18)" }, { boxShadow: "0 0 0 10px rgba(255,211,77,1), 0 0 70px 18px rgba(255,200,60,.85)", duration: 0.3, ease: "power2.out" }, Lt + 0.95 + i * 0.75);
    tl.to("#pn" + n, { boxShadow: "0 0 0 0 rgba(255,200,60,0), 0 16px 40px rgba(18,53,91,.18)", duration: 0.45, ease: "power2.inOut" }, Lt + 1.4 + i * 0.75);
  });
  blurIn("#ls-ayah", Lt + 4.1, 0.4);
  exit("#st-list", Lt + T.list[1] - EXIT);

  // ---- الخاتمة (صعود) ----
  tl.fromTo(["#ou-isl-a", "#ou-isl-b"], { opacity: 0 }, { opacity: 1, duration: ENTER, ease: "power2.out" }, O);
  tl.fromTo("#ou-spark", { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" }, O + 2.2);
  tl.fromTo("#ou-title", { y: 120, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }, O + 2.4);
  tl.fromTo("#ou-logo", { y: 90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "power3.out" }, O + 3.0);

  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
  tl.seek(0);
})();
</script>
</body>
</html>
`;
writeFileSync(new URL("./index.html", import.meta.url), html);
console.log("index.html written, duration", TOTAL, "s");
