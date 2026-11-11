<template>
  <style>
    @font-face { font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-arabic-800-normal.woff2") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF; }
    @font-face { font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-latin-800-normal.woff2") format("woff2"); unicode-range: U+0000-00FF; }
    @font-face { font-family: "Tajawal"; font-weight: 900; src: url("assets/fonts/tajawal-arabic-900-normal.woff2") format("woff2"); unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF; }
    @font-face { font-family: "Tajawal"; font-weight: 900; src: url("assets/fonts/tajawal-latin-900-normal.woff2") format("woff2"); unicode-range: U+0000-00FF; }

    /* Riyada palette */
    #root {
      position: absolute; inset: 0; overflow: hidden; direction: rtl;
      --navy: #02295b; --teal: #029b97; --orange: #f89a00; --gold: #fcad0a; --purple: #6a31aa; --white: #ffffff;
      background: #6cc3f0;
      font-family: "Baloo Bhaijaan 2", "Tajawal", sans-serif;
    }
    #sky { position: absolute; inset: 0; background: linear-gradient(180deg, #2f9fe0 0%, #5fbdee 42%, #a6ddf7 74%, #c9ecfb 100%); }
    #sun { position: absolute; left: 190px; top: 175px; width: 0; height: 0; z-index: 1; }
    #sun-rays { position: absolute; left: -150px; top: -150px; width: 300px; height: 300px; }
    #sun-rays i { position: absolute; left: 140px; top: 0; width: 20px; height: 46px; border-radius: 10px; background: #fcc419; transform-origin: 10px 150px; }
    #sun-disc { position: absolute; left: -92px; top: -92px; width: 184px; height: 184px; border-radius: 50%; background: radial-gradient(circle at 38% 35%, #fff3b0, #ffd54a 45%, #f9b233 100%); box-shadow: 0 0 0 10px rgba(255, 230, 120, 0.35); }
    .cloud { position: absolute; left: 0; top: 0; z-index: 2; }
    .cloud svg { display: block; filter: drop-shadow(0 8px 0 rgba(2, 41, 91, 0.08)); }

    #isles { position: absolute; inset: 0; z-index: 3; }
    .isle { position: absolute; width: 190px; height: 190px; }
    .isle img { width: 100%; height: 100%; display: block; }
    .isle .tag { position: absolute; top: -34px; left: 50%; transform: translateX(-50%); padding: 4px 22px 8px; border-radius: 999px; background: #fff; color: var(--navy); font-size: 30px; font-weight: 800; white-space: nowrap; box-shadow: 0 6px 14px rgba(2, 41, 91, 0.18); }
    #isle-win { left: 110px; top: 470px; }
    #isle-start { left: 1620px; top: 470px; }
    #route { position: absolute; left: 290px; top: 590px; z-index: 3; overflow: visible; }

    #sea { position: absolute; left: 0; right: 0; top: 790px; bottom: 0; z-index: 4; }
    .wave { position: absolute; left: 0; width: 3840px; }
    .wave svg { display: block; }
    #wave-1 { top: 0; } #wave-2 { top: 50px; } #wave-3 { top: 112px; }
    #boats { position: absolute; inset: 0; z-index: 8; }

    #night { position: absolute; inset: 0; z-index: 3; opacity: 0; background: linear-gradient(180deg, #010814 0%, #03142e 55%, #062347 100%); }
    #stars { position: absolute; inset: 0 0 300px 0; z-index: 3; opacity: 0; }
    #stars i { position: absolute; width: 4px; height: 4px; border-radius: 50%; background: #fff; }
    #dawn { position: absolute; left: 960px; top: 900px; width: 0; height: 0; z-index: 3; opacity: 0; }
    #dawn-glow { position: absolute; left: -1300px; top: -1000px; width: 2600px; height: 2000px; background: radial-gradient(closest-side, rgba(255, 214, 120, 0.95), rgba(248, 154, 0, 0.55) 32%, rgba(248, 154, 0, 0.12) 62%, transparent 100%); }
    #dawn-sun { position: absolute; left: -170px; top: -170px; width: 340px; height: 340px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #fff3c4, #ffc93c 50%, #f89a00 100%); }
    #flash { position: absolute; inset: 0; background: #ffffff; opacity: 0; z-index: 40; }

    .ship { position: absolute; left: 0; top: 0; z-index: 8; }
    .ship .hd { position: absolute; transform-origin: 0 0; }
    .ship svg { display: block; overflow: visible; }
    #ship-best-dark { z-index: 9; } #ship-best { z-index: 10; }
    #confetti { position: absolute; inset: 0; z-index: 30; }
    #confetti i { position: absolute; left: 0; top: 0; display: block; border-radius: 2px; opacity: 0; }

    /* type */
    .navy { color: var(--navy); }
    .outlined { -webkit-text-stroke: 16px #fff; paint-order: stroke fill; text-shadow: 0 10px 0 rgba(2, 41, 91, 0.16); }
    .pill { display: inline-block; padding: 6px 30px 12px; border-radius: 999px; background: #fff; color: var(--navy); font-weight: 800; box-shadow: 0 8px 18px rgba(2, 41, 91, 0.18); white-space: nowrap; }
    .ribbon { position: relative; display: inline-block; padding: 10px 70px 18px; background: var(--orange); color: #fff; font-weight: 800; white-space: nowrap; box-shadow: 0 8px 0 rgba(150, 80, 0, 0.35); }
    .ribbon::before, .ribbon::after { content: ""; position: absolute; top: 14px; width: 54px; height: 100%; background: #c87400; z-index: -1; }
    .ribbon::before { right: -40px; clip-path: polygon(0 0, 100% 0, 70% 50%, 100% 100%, 0 100%); }
    .ribbon::after { left: -40px; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 30% 50%); }
    .ribbon span { position: relative; }

    .scene { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; }
    #t-title { padding-top: 60px; }
    #t-title .k { font-size: 40px; }
    #t-title .name { font-size: 210px; line-height: 1.1; margin-top: 10px; }
    #t-title .sub { font-size: 48px; margin-top: 14px; }
    #t-title .sub b { font-weight: 800; color: var(--teal); } #t-title .sub em { font-style: normal; color: var(--orange); }

    #t-today { justify-content: center; padding-bottom: 160px; }
    #today-burst { position: absolute; left: 960px; top: 400px; width: 0; height: 0; }
    #today-burst i { position: absolute; left: -40px; top: -900px; width: 80px; height: 900px; background: linear-gradient(rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.45)); transform-origin: 40px 900px; clip-path: polygon(50% 100%, 0 0, 100% 0); }
    #t-today .ribbon { font-size: 150px; padding: 10px 110px 30px; }
    #t-today .ribbon::before, #t-today .ribbon::after { width: 120px; top: 34px; }
    #t-today .ribbon::before { right: -90px; } #t-today .ribbon::after { left: -90px; }

    #t-fursan { justify-content: center; padding-bottom: 170px; }
    #t-fursan .crown { width: 220px; height: 176px; margin-bottom: -26px; position: relative; z-index: 2; }
    #t-fursan .crown svg { width: 100%; height: 100%; display: block; }
    #t-fursan .box { padding: 26px 110px 44px; border-radius: 48px; background: #fff; border: 12px solid var(--teal); box-shadow: 0 14px 0 rgba(2, 41, 91, 0.18); font-size: 150px; line-height: 1.1; color: var(--navy); }

    .head { position: absolute; inset: 0; z-index: 20; display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 300px; }
    .hcard { padding: 20px 120px 40px; border-radius: 52px; background: #fff; border: 14px solid var(--team); box-shadow: 0 16px 0 rgba(2, 41, 91, 0.18); }
    .hname { font-size: 190px; line-height: 1.1; color: var(--navy); }
    .head .ribbon { font-size: 60px; margin-top: -22px; background: var(--team); }
    .head .ribbon::before, .head .ribbon::after { background: color-mix(in srgb, var(--team) 70%, #000); }

    .card { position: absolute; inset: 0; z-index: 20; }
    .buoy { position: absolute; left: 1330px; top: 150px; width: 440px; display: flex; flex-direction: column; align-items: center; }
    .buoy .bl { padding: 4px 30px 10px; border-radius: 999px; background: #fff; color: var(--navy); font-size: 40px; font-weight: 800; box-shadow: 0 6px 14px rgba(2, 41, 91, 0.18); margin-bottom: 12px; }
    .ring {
      width: 380px; height: 380px; border-radius: 50%; display: grid; place-items: center;
      background: conic-gradient(var(--orange) 0 22deg, #fff 22deg 68deg, var(--orange) 68deg 112deg, #fff 112deg 158deg, var(--orange) 158deg 202deg, #fff 202deg 248deg, var(--orange) 248deg 292deg, #fff 292deg 338deg, var(--orange) 338deg 360deg);
      box-shadow: inset 0 0 0 6px rgba(2, 41, 91, 0.25), 0 14px 0 rgba(2, 41, 91, 0.18);
    }
    .ring .num { width: 210px; height: 210px; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: inset 0 0 0 6px rgba(2, 41, 91, 0.25); font: 900 150px/1 "Tajawal", sans-serif; color: var(--navy); padding-top: 18px; }
    .buoy .ribbon.small { font-size: 54px; margin-top: -40px; padding: 6px 60px 14px; }
    .ncard {
      position: absolute; left: 150px; top: 210px; width: 1080px; height: 470px; border-radius: 44px; background: #fff;
      border: 12px solid var(--team); box-shadow: 0 16px 0 rgba(2, 41, 91, 0.18);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    }
    .chip { padding: 4px 30px 10px; border-radius: 999px; background: var(--team); color: #fff; font-size: 42px; font-weight: 800; }
    .names .nm { font-size: 136px; line-height: 1.15; color: var(--navy); white-space: nowrap; }
    .route { display: flex; align-items: center; gap: 14px; width: 760px; }
    .route img { width: 76px; height: 76px; }
    .route i { flex: 1; height: 0; border-top: 6px dashed var(--team); }

    #t-ftitle { justify-content: flex-start; padding-top: 120px; }
    #t-ftitle .t { font-size: 120px; color: #ffe7b0; }
    #t-reveal { padding-top: 44px; }
    #t-reveal .crown { width: 200px; height: 160px; margin-bottom: -30px; position: relative; z-index: 2; }
    #t-reveal .crown svg { width: 100%; height: 100%; display: block; }
    #t-reveal .rbox { padding: 30px 120px 46px; border-radius: 52px; background: #fff; border: 14px solid var(--gold); box-shadow: 0 16px 0 rgba(2, 41, 91, 0.18); display: flex; flex-direction: column; align-items: center; }
    #t-reveal .rk { padding: 4px 36px 12px; border-radius: 999px; background: var(--orange); color: #fff; font-size: 54px; font-weight: 800; }
    #t-reveal .bn { font-size: 200px; line-height: 1.1; color: var(--navy); }
    #t-reveal .ribbon { font-size: 58px; margin-top: -26px; background: var(--teal); }
    #t-reveal .ribbon::before, #t-reveal .ribbon::after { background: #016f6c; }

    #t-logo { justify-content: center; padding-bottom: 130px; }
    #t-logo .lcard { padding: 40px 90px 34px; border-radius: 56px; background: #fff; box-shadow: 0 16px 0 rgba(2, 41, 91, 0.18); display: flex; flex-direction: column; align-items: center; }
    #logo { position: relative; width: 380px; height: 416.6px; }
    #logo img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    #logo-flag { transform-origin: 79.6% 9.2%; }
    #t-logo .bless { margin-top: 18px; font-size: 76px; color: var(--navy); }
  </style>

  <div id="root" data-composition-id="show" data-width="1920" data-height="1080" data-layout-allow-overflow data-layout-allow-overlap>
    <div id="sky"></div>
    <div id="sun"><div id="sun-rays"></div><div id="sun-disc"></div></div>
    <div id="clouds">
      <div id="cloud-1" class="cloud"></div><div id="cloud-2" class="cloud"></div><div id="cloud-3" class="cloud"></div>
      <div id="cloud-4" class="cloud"></div><div id="cloud-5" class="cloud"></div><div id="cloud-6" class="cloud"></div>
    </div>
    <div id="isles">
      <div id="isle-win" class="isle"><img src="assets/img/island-win.png" alt="" /><div class="tag">جزيرة الفوز</div></div>
      <div id="isle-start" class="isle"><img src="assets/img/island-start.png" alt="" /><div class="tag">الانطلاق</div></div>
      <svg id="route" width="1340" height="120" viewBox="0 0 1340 120"><path id="route-path" d="M 1330 40 C 1100 110, 900 -10, 670 50 S 230 110, 10 50" fill="none" stroke="#f89a00" stroke-width="7" stroke-dasharray="20 16" stroke-linecap="round" /></svg>
    </div>
    <div id="night"></div>
    <div id="stars"></div>
    <div id="dawn"><div id="dawn-glow"></div><div id="dawn-sun"></div></div>
    <div id="sea">
      <div id="wave-1" class="wave"></div><div id="wave-2" class="wave"></div><div id="wave-3" class="wave"></div>
    </div>
    <div id="boats">
      <div id="ship-i1" class="ship"></div><div id="ship-i2" class="ship"></div><div id="ship-i3" class="ship"></div><div id="ship-i4" class="ship"></div>
      <!--SHIPS-->
      <div id="ship-best-dark" class="ship"></div>
      <div id="ship-best" class="ship"></div>
    </div>
    <div id="confetti"></div>
    <div id="flash"></div>

    <div id="t-title" class="clip scene" data-start="{{TITLE_S}}" data-duration="{{TITLE_D}}">
      <div class="pill k">مسابقة قرآنية تفاعلية</div>
      <div id="t-name" class="name navy outlined" data-var-text="name">سباق البحارة</div>
      <div class="pill sub">حيث يُبحر <b>حفظُ</b> أبنائنا نحو <em>جزيرة الفوز</em></div>
    </div>
    <div id="t-today" class="clip scene" data-start="{{TODAY_S}}" data-duration="{{TODAY_D}}">
      <div id="today-burst"></div>
      <div id="today-rib" class="ribbon"><span>تكريم اليوم</span></div>
    </div>
    <div id="t-fursan" class="clip scene" data-start="{{FURSAN_S}}" data-duration="{{FURSAN_D}}">
      <div id="fursan-crown" class="crown"></div>
      <div id="fursan-box" class="box">فارسا الحلقة</div>
    </div>
    <!--TEXTS-->
    <div id="t-ftitle" class="clip scene" data-start="{{FTITLE_S}}" data-duration="{{FTITLE_D}}"><div class="t">والحلقة المتميزة…</div></div>
    <div id="t-reveal" class="clip scene" data-start="{{REVEAL_S}}" data-duration="{{REVEAL_D}}">
      <div id="reveal-crown" class="crown"></div>
      <div id="reveal-box" class="rbox">
        <div class="rk">الحلقة المتميزة</div>
        <div id="t-reveal-n" class="bn">{{BEST_NAME}}</div>
      </div>
      <div id="reveal-rib" class="ribbon"><span>مبارك لكم!</span></div>
    </div>
    <div id="t-logo" class="clip scene" data-start="{{LOGO_S}}" data-duration="{{LOGO_D}}">
      <div id="logo-card" class="lcard">
        <div id="logo"><img id="logo-base" src="assets/img/base.png" alt="فريق ريادة التطوعي" /><img id="logo-flag" src="assets/img/flag.png" alt="" /><img id="logo-star" src="assets/img/star.png" alt="" /></div>
        <div id="t-bless" class="bless">بارك الله في جهودكم</div>
      </div>
    </div>
  </div>

  <script>
    (function () {
      const TL = /*TIMELINE*/;
      const DUR = TL.dur;
      const COLORS = ["#029B97", "#F89A00", "#6A31AA", "#1D5FB8", "#02295B"];
      const clamp01 = (x) => Math.max(0, Math.min(1, x));
      const mod = (a, n) => ((a % n) + n) % n;
      const E = (n) => gsap.parseEase(n);

      // ── the dhow from the race board, drawn bow-right in 140×120 ──
      const shade = (hex, amt) => {
        const v = parseInt(hex.slice(1), 16);
        const mix = (c) => Math.round(c + ((amt < 0 ? 0 : 255) - c) * Math.abs(amt));
        return "#" + ((1 << 24) | (mix((v >> 16) & 255) << 16) | (mix((v >> 8) & 255) << 8) | mix(v & 255)).toString(16).slice(1);
      };
      const dhow = (color, label, uid) => {
        const light = shade(color, 0.38), deep = shade(color, -0.32);
        return `<svg width="140" height="120" viewBox="0 0 140 120">
<defs><linearGradient id="sail-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<linearGradient id="hull-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b77b3e"/><stop offset="0.5" stop-color="#8a5527"/><stop offset="1" stop-color="#4f2d10"/></linearGradient></defs>
<g class="wake" opacity="0"><path d="M 26 94 L -70 70 L -70 118 Z" fill="rgba(244,255,253,0.18)"/>
<path class="wl" d="M 22 92 Q -14 86 -70 70" stroke="rgba(244,255,253,0.95)" stroke-width="9" stroke-linecap="round" fill="none" stroke-dasharray="18 10"/>
<path class="wl" d="M 22 96 Q -14 104 -70 118" stroke="rgba(244,255,253,0.95)" stroke-width="9" stroke-linecap="round" fill="none" stroke-dasharray="18 10"/>
<path d="M 30 94 Q -6 94 -44 95" stroke="rgba(244,255,253,0.55)" stroke-width="18" stroke-linecap="round" fill="none"/></g>
<ellipse cx="74" cy="100" rx="62" ry="7" fill="rgba(3,30,55,0.25)"/><ellipse cx="74" cy="94" rx="58" ry="4.5" fill="rgba(244,255,253,0.6)"/>
<path d="M 76 70 L 72 9" stroke="#3d240c" stroke-width="3.4" stroke-linecap="round"/>
<path d="M 72 8 L 50 4 L 56 10 L 50 16 Z" fill="${light}" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>
<path d="M 128 44 L 24 3 Q 26 34 40 62 Q 88 62 128 44 Z" fill="url(#sail-${uid})" stroke="rgba(0,0,0,0.38)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M 52 14 Q 54 38 62 61" stroke="rgba(255,255,255,0.28)" stroke-width="1.4" fill="none"/><path d="M 80 25 Q 82 44 86 59" stroke="rgba(255,255,255,0.24)" stroke-width="1.4" fill="none"/>
<path d="M 30 10 Q 34 34 44 56 Q 40 32 30 10 Z" fill="rgba(255,255,255,0.35)"/>
<g class="lbl" transform="translate(70 40) scale(-1 1)"><text x="0" y="9" text-anchor="middle" font-size="27" font-weight="900" font-family="Tajawal, sans-serif" fill="#fff" stroke="rgba(0,0,0,0.45)" stroke-width="3" paint-order="stroke">${label}</text></g>
<path d="M 130 45 L 22 2" stroke="#4f2d10" stroke-width="3.2" stroke-linecap="round"/>
<path d="M 8 56 Q 12 66 20 70 L 118 68 Q 130 64 139 52 Q 134 80 114 94 Q 76 100 40 96 Q 18 92 8 56 Z" fill="url(#hull-${uid})" stroke="#2e1906" stroke-width="2" stroke-linejoin="round"/>
<path d="M 14 68 Q 18 72 22 73 L 120 71 Q 128 68 134 62 L 132 70 Q 124 77 118 78 L 26 80 Q 18 78 14 68 Z" fill="${color}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
<path d="M 26 86 Q 70 90 122 80" stroke="rgba(255,226,180,0.35)" stroke-width="1.4" fill="none"/>
<path d="M 14 66 L 13 56 L 40 57 L 42 69 Z" fill="#c99358" stroke="#2e1906" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M 15 56 L 15 50 M 24 56.4 L 24 50.6 M 33 56.7 L 33 51 M 14 50 L 40 51" stroke="#2e1906" stroke-width="1.5" stroke-linecap="round"/>
<path d="M 136 54 L 140 48" stroke="#2e1906" stroke-width="2.2" stroke-linecap="round"/></svg>`;
      };
      const CROWN = (id) => `<svg viewBox="0 0 50 40"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.45" stop-color="#fcad0a"/><stop offset="1" stop-color="#d18a10"/></linearGradient></defs>
<path d="M5 34 L3 12 L15 22 L25 5 L35 22 L47 12 L45 34 Z" fill="url(#${id})" stroke="#7a4a05" stroke-width="2.2" stroke-linejoin="round"/>
<rect x="5" y="31" width="40" height="6" rx="2" fill="#e8a21c" stroke="#7a4a05" stroke-width="2.2"/><circle cx="25" cy="5" r="3.2" fill="#6a31aa" stroke="#7a4a05" stroke-width="1.6"/>
<circle cx="3" cy="12" r="2.6" fill="#029b97" stroke="#7a4a05" stroke-width="1.4"/><circle cx="47" cy="12" r="2.6" fill="#029b97" stroke="#7a4a05" stroke-width="1.4"/><circle cx="25" cy="25" r="3" fill="#029b97"/></svg>`;
      document.getElementById("fursan-crown").innerHTML = CROWN("cg1");
      document.getElementById("reveal-crown").innerHTML = CROWN("cg2");

      // ── sky details ──
      const rays = document.getElementById("sun-rays");
      for (let i = 0; i < 12; i++) { const r = document.createElement("i"); r.style.transform = `rotate(${i * 30}deg)`; rays.appendChild(r); }
      const burst = document.getElementById("today-burst");
      for (let i = 0; i < 16; i++) { const r = document.createElement("i"); r.style.transform = `rotate(${i * 22.5}deg)`; burst.appendChild(r); }
      const CLOUD = (w) => `<svg width="${w}" height="${w * 0.42}" viewBox="0 0 200 84"><path d="M 30 80 C 6 80 4 52 26 48 C 22 26 50 16 64 30 C 72 6 112 2 122 28 C 136 16 166 24 162 46 C 190 44 196 80 170 80 Z" fill="#fff"/></svg>`;
      const CL = [[260, 80, 300, 4], [700, 40, 220, 6], [1120, 110, 260, 5], [1480, 30, 240, 7], [1700, 170, 200, 4.5], [420, 240, 180, 5.5]];
      const clouds = CL.map(([x, y, w, v], n) => { const el = document.getElementById("cloud-" + (n + 1)); el.innerHTML = CLOUD(w); return { el, x, y, w, v }; });
      const WAVE = (c1, amp, crest) => `<svg width="3840" height="300" viewBox="0 0 3840 300"><path d="M 0 ${amp} ${Array.from({ length: 16 }, (_, i) => `Q ${i * 240 + 60} 0 ${i * 240 + 120} ${amp} T ${i * 240 + 240} ${amp}`).join(" ")} L 3840 300 L 0 300 Z" fill="${c1}"/>${crest ? `<path d="M 0 ${amp} ${Array.from({ length: 16 }, (_, i) => `Q ${i * 240 + 60} 0 ${i * 240 + 120} ${amp} T ${i * 240 + 240} ${amp}`).join(" ")}" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="5"/>` : ""}</svg>`;
      document.getElementById("wave-1").innerHTML = WAVE("#5cc3ef", 30, false);
      document.getElementById("wave-2").innerHTML = WAVE("#2a9fdc", 34, true);
      document.getElementById("wave-3").innerHTML = WAVE("#1479c0", 30, true);
      const waves = [["wave-1", -18], ["wave-2", 26], ["wave-3", -38]].map(([id, v]) => ({ el: document.getElementById(id), v }));
      let seed = 5;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      const stars = document.getElementById("stars");
      for (let i = 0; i < 70; i++) { const s = document.createElement("i"); s.style.left = rnd() * 1920 + "px"; s.style.top = rnd() * 700 + "px"; s.style.opacity = 0.3 + rnd() * 0.7; stars.appendChild(s); }

      // ── ships: waterline anchor (75, 92); always sailing bow-left ──
      const makeShip = (id, color, label, w) => {
        const el = document.getElementById(id);
        const k = w / 140;
        el.innerHTML = `<div class="hd" style="left:${-75 * k}px; top:${-92 * k}px; transform: scale(${k})"><div style="transform: scaleX(-1); transform-origin: 70px 0">${dhow(color, label, id)}</div></div>`;
        return { el, wake: el.querySelector(".wake"), wls: el.querySelectorAll(".wl"), svg: el.querySelector("svg"), lbl: el.querySelector(".lbl") };
      };
      const setShip = (s, x, y, moving, t, opacity) => {
        s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        s.el.style.opacity = opacity;
        s.wake.setAttribute("opacity", moving.toFixed(3));
        const off = (-mod(t / 0.7, 1) * 28).toFixed(2);
        s.wls.forEach((w) => w.setAttribute("stroke-dashoffset", off));
      };
      const intro = [1, 2, 3, 4].map((n) => makeShip("ship-i" + n, COLORS[n - 1], n, 230));
      const big = TL.blocks.map((b) => ({ b, s: makeShip("ship-" + b.slot, b.color, b.slot, 330) }));
      const best = makeShip("ship-best", TL.best.color, TL.best.slot, 420);
      const dark = makeShip("ship-best-dark", "#000000", "", 420);

      const CC = ["#029b97", "#f89a00", "#6a31aa", "#fcad0a", "#02295b", "#ffffff"];
      const conf = document.getElementById("confetti");
      const bits = Array.from({ length: 110 }, (_, n) => {
        const i = document.createElement("i");
        i.style.width = 10 + rnd() * 10 + "px"; i.style.height = 6 + rnd() * 6 + "px"; i.style.background = CC[n % CC.length];
        conf.appendChild(i);
        return { el: i, x: rnd() * 1920, sway: (rnd() - 0.5) * 260, rot: (rnd() - 0.5) * 1080, dur: 2.8 + rnd() * 2.2, delay: rnd() * 1.4 };
      });

      const els = { sea: document.getElementById("sea"), night: document.getElementById("night"), stars, dawn: document.getElementById("dawn"), dsun: document.getElementById("dawn-sun"), flash: document.getElementById("flash"), rays, burst, isles: document.getElementById("isles"), route: document.getElementById("route-path") };
      const F = TL.fin;
      const SEA_Y = 905;

      function render(t) {
        rays.style.transform = `rotate(${(t * 8).toFixed(2)}deg)`;
        burst.style.transform = `rotate(${(t * 6).toFixed(2)}deg)`;
        clouds.forEach((c) => {
          const x = mod(c.x - c.v * t + c.w, 1920 + c.w * 2) - c.w;
          c.el.style.transform = `translate(${x.toFixed(1)}px, ${c.y}px)`;
        });
        waves.forEach((w) => { w.el.style.transform = `translateX(${(-mod(-w.v * t, 1920)).toFixed(1)}px)`; });
        // islands and route belong to the title scene
        const isl = clamp01((t - 0.3) / 0.8) * (1 - clamp01((t - (TL.T.title[1] - 0.4)) / 0.4));
        els.isles.style.opacity = isl.toFixed(3);
        els.route.setAttribute("stroke-dashoffset", (-t * 30).toFixed(1));

        // intro boats sail from the start island towards the win island
        intro.forEach((s, n) => {
          const u = clamp01((t - 0.2 - n * 0.4) / 9);
          const x = 2120 - 2500 * u - n * 60;
          setShip(s, x, SEA_Y + 20 + (n % 2) * 40, u > 0 && u < 1 ? 1 : 0, t, u > 0 && u < 1 ? 1 : 0);
        });

        // each halaqa's ship sails in under its card, waits, then sails on
        big.forEach(({ b, s }) => {
          const IN = 1.5;
          let x, m = 0, op = 1;
          if (t < b.t0 || t > b.t1 + 0.1) { op = 0; x = 2200; }
          else if (t < b.t0 + IN) { const u = (t - b.t0) / IN; x = 2150 - (2150 - 960) * E("power3.out")(u); m = 1 - u * 0.8; }
          else if (t < b.out) { x = 960; m = 0.2 * clamp01(1 - (t - b.t0 - IN) / 0.6); }
          else { const u = clamp01((t - b.out) / (b.t1 - b.out)); x = 960 - (960 + 300) * E("power2.in")(u); m = Math.min(1, u * 2); }
          setShip(s, x, SEA_Y + 70, m, t, op);
        });

        // finale: night, a black ship, the dawn sun rising behind it, then the reveal
        const night = clamp01((t - F.dark) / 1.3);
        const L = clamp01((t - F.light[0]) / (F.light[1] - F.light[0]));
        const rv = t >= F.reveal;
        const lift = rv ? clamp01((t - F.reveal) / 1.2) : 0;
        els.night.style.opacity = (night * (1 - 0.45 * L) * (1 - lift)).toFixed(3);
        els.sea.style.filter = `brightness(${(1 - 0.78 * night * (1 - 0.5 * L) * (1 - lift)).toFixed(3)})`;
        els.stars.style.opacity = (night * (1 - L) * (1 - lift)).toFixed(3);
        els.dawn.style.opacity = (Math.min(1, L * 1.4) * (1 - clamp01((t - F.reveal) / 1.6))).toFixed(3);
        els.dsun.style.transform = `translateY(${(260 - 360 * E("power2.out")(L)).toFixed(1)}px)`;
        const fl = rv ? Math.max(0, 1 - (t - F.reveal) / 0.7) : clamp01((t - (F.reveal - 0.12)) / 0.12);
        els.flash.style.opacity = (0.9 * fl).toFixed(3);

        const bu = clamp01((t - F.shipIn[0]) / (F.shipIn[1] - F.shipIn[0]));
        const bx = 2200 - (2200 - 960) * E("power2.out")(bu);
        const shown = t >= F.shipIn[0] && t < F.end - 0.1;
        const fadeEnd = 1 - clamp01((t - (F.end - 0.6)) / 0.5);
        const vis = shown ? fadeEnd : 0;
        const col = rv ? 1 : 0.85 * E("power2.in")(L);
        setShip(dark, bx, SEA_Y + 75, bu < 1 ? 1 - bu * 0.7 : 0.15, t, (vis * (rv ? 0 : 1)).toFixed(3));
        setShip(best, bx, SEA_Y + 75, bu < 1 ? 1 - bu * 0.7 : 0.15, t, (vis * col).toFixed(3));
        best.svg.style.filter = rv ? "none" : `brightness(${(0.55 + 0.45 * L).toFixed(3)})`;
        best.lbl.style.opacity = rv ? 1 : 0;
        dark.svg.style.filter = `brightness(0) drop-shadow(0 0 2px rgba(255, 236, 190, ${(0.25 + 0.5 * L).toFixed(3)}))`;

        bits.forEach((q) => {
          const u = (t - F.reveal - q.delay) / q.dur;
          if (u <= 0 || u >= 1) { q.el.style.opacity = 0; return; }
          q.el.style.opacity = (u < 0.8 ? 1 : (1 - u) / 0.2).toFixed(3);
          q.el.style.transform = `translate(${(q.x + q.sway * Math.sin(u * 3)).toFixed(1)}px, ${(-40 + 1180 * u).toFixed(1)}px) rotate(${(q.rot * u).toFixed(1)}deg)`;
        });
      }

      const tl = gsap.timeline({ paused: true });
      const clock = { t: 0 };
      tl.to(clock, { t: DUR, duration: DUR, ease: "none", onUpdate: () => render(clock.t) }, 0);
      const pop = (sel, t0, d = 0.6) => tl.fromTo(sel, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: d, ease: "back.out(1.7)" }, t0);
      const drop = (sel, t0) => tl.fromTo(sel, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, t0);
      const rise = (sel, t0) => tl.fromTo(sel, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6, ease: "expo.out" }, t0);
      const out = (sel, t1, d = 0.3) => tl.to(sel, { opacity: 0, scale: 0.92, duration: d, ease: "power3.in" }, t1 - d - 0.02);

      const T = TL.T;
      drop("#t-title .k", T.title[0] + 0.1); pop("#t-name", T.title[0] + 0.25, 0.8); rise("#t-title .sub", T.title[0] + 0.9); out("#t-title", T.title[1]);
      tl.fromTo("#today-burst", { opacity: 0 }, { opacity: 1, duration: 0.6 }, T.today[0]);
      tl.fromTo("#today-rib", { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.7, ease: "back.out(1.4)" }, T.today[0] + 0.1);
      out("#t-today", T.today[1]);
      tl.fromTo("#fursan-crown", { opacity: 0, y: -80 }, { opacity: 1, y: 0, duration: 0.8, ease: "bounce.out" }, T.fursan[0] + 0.35);
      pop("#fursan-box", T.fursan[0]); out("#t-fursan", T.fursan[1]);

      TL.blocks.forEach((b) => {
        const h = "#head-" + b.slot;
        pop(h + " .hcard", b.head[0]); tl.fromTo(h + " .ribbon", { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.6, ease: "back.out(1.4)" }, b.head[0] + 0.35);
        out(h, b.head[1]);
        b.cards.forEach(([s, e], k) => {
          const c = "#card-" + b.slot + "-" + k;
          tl.fromTo(c + " .buoy", { opacity: 0, x: 200, rotation: 40 }, { opacity: 1, x: 0, rotation: 0, duration: 0.7, ease: "back.out(1.3)" }, s);
          tl.fromTo(c + " .ncard", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.5)" }, s + 0.15);
          tl.fromTo(c + " .nm", { opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.45, ease: "power2.out" }, s + 0.45);
          tl.fromTo(c + " .route i", { scaleX: 0 }, { scaleX: 1, duration: 1.0, ease: "power2.out", transformOrigin: "100% 50%" }, s + 0.6);
          out(c, e);
        });
      });

      tl.fromTo("#t-ftitle .t", { opacity: 0, filter: "blur(14px)" }, { opacity: 0.9, filter: "blur(0px)", duration: 1.6, ease: "power2.out" }, F.title[0]);
      tl.to("#t-ftitle", { opacity: 0, duration: 0.5, ease: "power3.in" }, F.title[1] - 0.52);
      pop("#reveal-box", F.reveal + 0.05, 0.7);
      tl.fromTo("#reveal-crown", { opacity: 0, y: -90 }, { opacity: 1, y: 0, duration: 0.9, ease: "bounce.out" }, F.reveal + 0.5);
      tl.fromTo("#reveal-rib", { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.6, ease: "back.out(1.4)" }, F.reveal + 0.9);
      out("#t-reveal", F.end, 0.45);

      const Lg = TL.logo;
      pop("#logo-card", Lg[0] + 0.05, 0.7);
      tl.fromTo("#logo-flag", { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 0.6, ease: "expo.out" }, Lg[0] + 0.6);
      tl.fromTo("#logo-star", { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.6, ease: "back.out(2)", transformOrigin: "50% 50%" }, Lg[0] + 0.85);
      tl.fromTo("#t-bless", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, Lg[0] + 1.0);

      render(0);
      window.__timelines["show"] = tl;
    })();
  </script>
</template>
