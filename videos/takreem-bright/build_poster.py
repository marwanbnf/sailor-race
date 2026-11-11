#!/usr/bin/env python3
"""Builds poster.html (one-image summary) from data.json and renders poster.png.

poster.html and poster.png hold students' names, so both are git-ignored.
Run: python3 build_poster.py
"""
import html
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "data.json").read_text())
COLORS = ["#029B97", "#F89A00", "#6A31AA", "#1D5FB8", "#02295B"]
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
esc = html.escape
best_i = max(range(len(DATA)), key=lambda i: DATA[i]["avg"])

SAIL = lambda c, n: f'''<svg viewBox="0 0 140 120" class="dhow"><g transform="translate(140 0) scale(-1 1)">
<ellipse cx="74" cy="100" rx="62" ry="7" fill="rgba(3,30,55,0.22)"/>
<path d="M 76 70 L 72 9" stroke="#3d240c" stroke-width="3.4" stroke-linecap="round"/>
<path d="M 128 44 L 24 3 Q 26 34 40 62 Q 88 62 128 44 Z" fill="{c}" stroke="rgba(0,0,0,0.38)" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M 30 10 Q 34 34 44 56 Q 40 32 30 10 Z" fill="rgba(255,255,255,0.35)"/>
<path d="M 130 45 L 22 2" stroke="#4f2d10" stroke-width="3.2" stroke-linecap="round"/>
<path d="M 8 56 Q 12 66 20 70 L 118 68 Q 130 64 139 52 Q 134 80 114 94 Q 76 100 40 96 Q 18 92 8 56 Z" fill="#8a5527" stroke="#2e1906" stroke-width="2" stroke-linejoin="round"/>
<path d="M 14 68 Q 18 72 22 73 L 120 71 Q 128 68 134 62 L 132 70 Q 124 77 118 78 L 26 80 Q 18 78 14 68 Z" fill="{c}" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>
<path d="M 14 66 L 13 56 L 40 57 L 42 69 Z" fill="#c99358" stroke="#2e1906" stroke-width="1.6" stroke-linejoin="round"/></g>
<text x="70" y="49" text-anchor="middle" font-size="27" font-weight="900" font-family="Tajawal" fill="#fff" stroke="rgba(0,0,0,0.45)" stroke-width="3" paint-order="stroke">{n}</text></svg>'''

cards = []
for i, h in enumerate(DATA):
    c = COLORS[i % 5]
    rows = "".join(
        f'<li><span class="medal r{r}">{str(r).translate(AR)}</span><span class="nm">{esc(n)}</span></li>'
        for n, _pts, r in h["win"]
    )
    cards.append(
        f'''<div class="hcard" style="--team:{c}">
      <div class="hhead">{SAIL(c, i + 1)}<span>{esc(h["h"])}</span></div>
      <ul>{rows}</ul>
    </div>'''
    )

best = DATA[best_i]
bc = COLORS[best_i % 5]
CROWN = '''<svg viewBox="0 0 50 40"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset="0.45" stop-color="#fcad0a"/><stop offset="1" stop-color="#d18a10"/></linearGradient></defs>
<path d="M5 34 L3 12 L15 22 L25 5 L35 22 L47 12 L45 34 Z" fill="url(#cg)" stroke="#7a4a05" stroke-width="2.2" stroke-linejoin="round"/>
<rect x="5" y="31" width="40" height="6" rx="2" fill="#e8a21c" stroke="#7a4a05" stroke-width="2.2"/><circle cx="25" cy="5" r="3.2" fill="#6a31aa" stroke="#7a4a05" stroke-width="1.6"/>
<circle cx="3" cy="12" r="2.6" fill="#029b97" stroke="#7a4a05" stroke-width="1.4"/><circle cx="47" cy="12" r="2.6" fill="#029b97" stroke="#7a4a05" stroke-width="1.4"/><circle cx="25" cy="25" r="3" fill="#029b97"/></svg>'''
CLOUD = '<svg viewBox="0 0 200 84"><path d="M 30 80 C 6 80 4 52 26 48 C 22 26 50 16 64 30 C 72 6 112 2 122 28 C 136 16 166 24 162 46 C 190 44 196 80 170 80 Z" fill="#fff"/></svg>'
WAVE = lambda col, amp, crest: (
    f'<svg viewBox="0 0 1080 200" preserveAspectRatio="none"><path d="M 0 {amp} '
    + " ".join(f"Q {i*180+45} 0 {i*180+90} {amp} T {i*180+180} {amp}" for i in range(6))
    + f' L 1080 200 L 0 200 Z" fill="{col}"/>'
    + (
        '<path d="M 0 %d ' % amp
        + " ".join(f"Q {i*180+45} 0 {i*180+90} {amp} T {i*180+180} {amp}" for i in range(6))
        + '" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="4"/>'
        if crest
        else ""
    )
    + "</svg>"
)

page = f'''<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<style>
  @font-face {{ font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-arabic-800-normal.woff2"); unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFF; }}
  @font-face {{ font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-latin-800-normal.woff2"); unicode-range: U+0000-00FF; }}
  @font-face {{ font-family: "Tajawal"; font-weight: 900; src: url("assets/fonts/tajawal-arabic-900-normal.woff2"); unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFF; }}
  @font-face {{ font-family: "Tajawal"; font-weight: 900; src: url("assets/fonts/tajawal-latin-900-normal.woff2"); unicode-range: U+0000-00FF; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ width: 1080px; height: 1350px; overflow: hidden; font-family: "Baloo Bhaijaan 2", "Tajawal", sans-serif; color: #02295b;
    background: linear-gradient(180deg, #2f9fe0 0%, #5fbdee 40%, #a6ddf7 70%, #c9ecfb 100%); position: relative; }}
  .sun {{ position: absolute; left: 70px; top: 60px; width: 130px; height: 130px; border-radius: 50%;
    background: radial-gradient(circle at 38% 35%, #fff3b0, #ffd54a 45%, #f9b233 100%); box-shadow: 0 0 0 10px rgba(255,230,120,.35); }}
  .ray {{ position: absolute; left: 127px; top: 117px; width: 14px; height: 30px; border-radius: 7px; background: #fcc419; transform-origin: 7px 105px; margin-top: -105px; }}
  .cloud {{ position: absolute; }}
  .cloud svg {{ width: 100%; display: block; filter: drop-shadow(0 6px 0 rgba(2,41,91,.08)); }}
  header {{ position: relative; text-align: center; padding-top: 26px; }}
  .logo {{ display: inline-block; background: #fff; border-radius: 34px; padding: 14px 26px 10px; box-shadow: 0 10px 0 rgba(2,41,91,.15); }}
  .logo img {{ width: 112px; display: block; }}
  .title {{ font-size: 92px; line-height: 1.05; margin-top: 4px; -webkit-text-stroke: 12px #fff; paint-order: stroke fill; text-shadow: 0 8px 0 rgba(2,41,91,.16); }}
  .ribbon {{ position: relative; display: inline-block; margin-top: 6px; padding: 4px 60px 12px; background: #f89a00; color: #fff; font-size: 46px; box-shadow: 0 6px 0 rgba(150,80,0,.35); }}
  .ribbon::before, .ribbon::after {{ content: ""; position: absolute; top: 12px; width: 44px; height: 100%; background: #c87400; z-index: -1; }}
  .ribbon::before {{ right: -32px; clip-path: polygon(0 0,100% 0,70% 50%,100% 100%,0 100%); }}
  .ribbon::after {{ left: -32px; clip-path: polygon(0 0,100% 0,100% 100%,0 100%,30% 50%); }}
  .sub {{ font-size: 40px; margin-top: 12px; }}
  .grid {{ position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 8px 40px 0; }}
  .hcard {{ background: #fff; border: 8px solid var(--team); border-radius: 30px; padding: 10px 18px 16px; box-shadow: 0 10px 0 rgba(2,41,91,.15); }}
  .hhead {{ display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--team); color: #fff; border-radius: 999px; padding: 0 22px 6px; font-size: 40px; margin: 0 auto 10px; width: fit-content; }}
  .hhead .dhow {{ width: 58px; height: 50px; }}
  ul {{ list-style: none; }}
  li {{ display: flex; align-items: center; gap: 12px; padding: 4px 2px; font-size: 36px; line-height: 1.2; }}
  li + li {{ border-top: 3px dashed #e3edf5; }}
  .medal {{ flex: none; width: 48px; height: 48px; border-radius: 50%; display: grid; place-items: center; font: 900 34px/1 "Tajawal"; padding-top: 6px; color: #02295b; }}
  .medal.r1 {{ background: radial-gradient(circle at 40% 35%, #fff3b0, #fcad0a); box-shadow: inset 0 0 0 4px #d18a10; }}
  .medal.r2 {{ background: radial-gradient(circle at 40% 35%, #ffffff, #c9d6e2); box-shadow: inset 0 0 0 4px #9aaebf; }}
  .nm {{ white-space: nowrap; }}
  .best {{ position: relative; text-align: center; z-index: 3; margin-top: 18px; }}
  .best .crown {{ width: 96px; height: 77px; margin: 0 auto -16px; position: relative; z-index: 2; }}
  .best .box {{ display: inline-flex; align-items: center; gap: 22px; background: #fff; border: 10px solid #fcad0a; border-radius: 40px; padding: 8px 40px 14px; box-shadow: 0 10px 0 rgba(2,41,91,.18); }}
  .best .k {{ background: #f89a00; color: #fff; border-radius: 999px; padding: 2px 26px 8px; font-size: 38px; }}
  .best .n {{ font-size: 68px; line-height: 1.1; }}
  .best .dhow {{ width: 110px; height: 94px; }}
  .sea {{ position: absolute; left: 0; right: 0; bottom: 0; height: 160px; }}
  .sea div {{ position: absolute; left: 0; right: 0; }}
  .sea svg {{ width: 100%; height: 200px; display: block; }}
</style></head>
<body>
  <div class="sun"></div>
  {"".join(f'<div class="ray" style="transform: rotate({k*30}deg)"></div>' for k in range(12))}
  <div class="cloud" style="left:780px;top:40px;width:220px">{CLOUD}</div>
  <div class="cloud" style="left:250px;top:150px;width:150px">{CLOUD}</div>
  <div class="cloud" style="left:880px;top:250px;width:140px">{CLOUD}</div>
  <header>
    <div class="logo"><img src="assets/img/riyada-full.png" alt="فريق ريادة التطوعي" /></div>
    <div class="title">سباق البحارة</div>
    <div class="ribbon">تكريم اليوم</div>
    <div class="sub">فارسا الحلقة</div>
  </header>
  <section class="grid">{"".join(cards)}</section>
  <div class="sea">
    <div style="top:0">{WAVE("#5cc3ef", 26, False)}</div>
    <div style="top:44px">{WAVE("#2a9fdc", 28, True)}</div>
    <div style="top:96px">{WAVE("#1479c0", 26, True)}</div>
  </div>
  <div class="best">
    <div class="crown">{CROWN}</div>
    <div class="box">{SAIL(bc, best_i + 1)}<div><div class="k">الحلقة المتميزة</div><div class="n">{esc(best["h"])}</div></div></div>
  </div>
</body></html>'''
(ROOT / "poster.html").write_text(page)

shot = r"""
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.argv[2]);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  await p.screenshot({ path: process.argv[3] });
  await b.close();
})();
"""
js = ROOT / ".poster-shot.cjs"
js.write_text(shot)
subprocess.run(["node", str(js), str(ROOT / "poster.html"), str(ROOT / "renders" / "poster.png")], check=True)
js.unlink()
print("poster:", ROOT / "renders" / "poster.png")
