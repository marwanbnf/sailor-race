#!/usr/bin/env python3
"""Builds the night teaser image (renders/teaser.png): a black ship on the horizon, dawn rising behind it.

Run: python3 build_teaser.py
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent

KICKER = "سباق البحارة"
TITLE = "تكريم اليوم"
QUESTION_1 = "من فارسا الحلقة؟"
QUESTION_2 = "ومن الحلقة المتميزة؟"
FOOT = "الكشف… اليوم"

SHIP = '''<svg viewBox="-80 -10 230 130" class="ship"><g transform="translate(140 0) scale(-1 1)">
<path d="M 22 92 Q -14 86 -70 70" stroke="rgba(255,220,150,0.35)" stroke-width="6" stroke-linecap="round" fill="none" stroke-dasharray="16 10"/>
<path d="M 22 96 Q -14 104 -70 118" stroke="rgba(255,220,150,0.35)" stroke-width="6" stroke-linecap="round" fill="none" stroke-dasharray="16 10"/>
<path d="M 76 70 L 72 9" stroke="#000" stroke-width="3.4" stroke-linecap="round"/>
<path d="M 72 8 L 50 4 L 56 10 L 50 16 Z" fill="#000"/>
<path d="M 128 44 L 24 3 Q 26 34 40 62 Q 88 62 128 44 Z" fill="#05070b"/>
<path d="M 130 45 L 22 2" stroke="#000" stroke-width="3.2" stroke-linecap="round"/>
<path d="M 8 56 Q 12 66 20 70 L 118 68 Q 130 64 139 52 Q 134 80 114 94 Q 76 100 40 96 Q 18 92 8 56 Z" fill="#05070b"/>
<path d="M 14 66 L 13 56 L 40 57 L 42 69 Z" fill="#000"/></g>
<text x="70" y="49" text-anchor="middle" font-size="30" font-weight="800" font-family="Baloo Bhaijaan 2" fill="#ffd25c">؟</text></svg>'''

# seeded stars
seed = 7
def rnd():
    global seed
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
stars = "".join(
    f'<i style="left:{rnd()*1080:.0f}px;top:{rnd()*820:.0f}px;width:{2+rnd()*3:.1f}px;height:{2+rnd()*3:.1f}px;opacity:{0.35+rnd()*0.65:.2f}"></i>'
    for _ in range(110)
)
WAVE = lambda col, amp, crest: (
    f'<svg viewBox="0 0 1080 200" preserveAspectRatio="none"><path d="M 0 {amp} '
    + " ".join(f"Q {i*180+45} 0 {i*180+90} {amp} T {i*180+180} {amp}" for i in range(6))
    + f' L 1080 200 L 0 200 Z" fill="{col}"/>'
    + (
        f'<path d="M 0 {amp} '
        + " ".join(f"Q {i*180+45} 0 {i*180+90} {amp} T {i*180+180} {amp}" for i in range(6))
        + '" fill="none" stroke="rgba(255,214,140,0.45)" stroke-width="3"/>'
        if crest
        else ""
    )
    + "</svg>"
)
rays = "".join(f'<i style="transform: rotate({-80 + k*10}deg)"></i>' for k in range(17))

page = f'''<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<style>
  @font-face {{ font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-arabic-800-normal.woff2"); unicode-range: U+0600-06FF, U+FB50-FDFF, U+FE70-FEFF; }}
  @font-face {{ font-family: "Baloo Bhaijaan 2"; font-weight: 800; src: url("assets/fonts/baloo-bhaijaan-2-latin-800-normal.woff2"); unicode-range: U+0000-00FF; }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: 1080px; height: 1350px; overflow: hidden; }}
  .frame {{ width: 1080px; height: 1350px; overflow: hidden; position: relative; font-family: "Baloo Bhaijaan 2", sans-serif;
    background: linear-gradient(180deg, #01060f 0%, #03122a 45%, #0a2a4e 72%, #3b3550 86%, #7a4a3a 100%); }}
  .stars i {{ position: absolute; border-radius: 50%; background: #fff; }}
  .moon {{ position: absolute; left: 110px; top: 120px; width: 120px; height: 120px; border-radius: 50%; box-shadow: 26px -6px 0 0 #f6e7b8; transform: rotate(-20deg); }}
  .glow {{ position: absolute; left: 50%; top: 1040px; width: 1700px; height: 1100px; margin-left: -850px; margin-top: -550px;
    background: radial-gradient(closest-side, rgba(255,214,120,0.9), rgba(248,154,0,0.55) 26%, rgba(248,120,0,0.18) 55%, transparent 100%); }}
  .rays {{ position: absolute; left: 540px; top: 1040px; width: 0; height: 0; }}
  .rays i {{ position: absolute; left: -26px; top: -1100px; width: 52px; height: 1100px; transform-origin: 26px 1100px;
    background: linear-gradient(rgba(255,214,120,0), rgba(255,214,120,0.16)); clip-path: polygon(50% 100%, 0 0, 100% 0); }}
  .sun {{ position: absolute; left: 540px; top: 1040px; width: 330px; height: 330px; margin: -165px 0 0 -165px; border-radius: 50%;
    background: radial-gradient(circle at 50% 40%, #fff3c4, #ffc93c 50%, #f89a00 100%); }}
  .sea {{ position: absolute; left: 0; right: 0; top: 1030px; bottom: 0; }}
  .sea div {{ position: absolute; left: 0; right: 0; }}
  .sea svg {{ width: 100%; height: 200px; display: block; }}
  .ship {{ position: absolute; left: 50%; top: 815px; width: 560px; height: 316px; margin-left: -280px; overflow: visible;
    filter: drop-shadow(0 0 2px rgba(255,220,150,0.8)) drop-shadow(0 0 14px rgba(255,190,90,0.35)); }}
  header {{ position: relative; text-align: center; padding-top: 34px; }}
  .logo {{ display: inline-block; background: #fff8e8; border-radius: 28px; padding: 12px 22px 8px; box-shadow: 0 0 0 3px rgba(255,210,92,0.6), 0 10px 24px rgba(0,0,0,0.45); }}
  .logo img {{ width: 130px; display: block; }}
  .kicker {{ margin-top: 14px; font-size: 44px; line-height: 1.3; color: #f2d28b; letter-spacing: 0.02em; }}
  .title {{ font-size: 150px; line-height: 1.15; color: #ffd25c; -webkit-text-stroke: 12px #2a1600; paint-order: stroke fill;
    text-shadow: 0 0 40px rgba(255,190,80,0.45), 0 10px 0 rgba(0,0,0,0.35); }}
  .q2 {{ margin-top: 0 !important; color: #ffd25c !important; }}
  .q {{ margin-top: 6px; font-size: 66px; line-height: 1.35; color: #fff8e8; text-shadow: 0 6px 18px rgba(0,0,0,0.6); }}
  .foot {{ position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; z-index: 3; }}
  .foot span {{ display: inline-block; padding: 8px 46px 14px; border-radius: 999px; background: rgba(1,8,20,0.72); color: #ffd25c; font-size: 52px; line-height: 1.3;
    box-shadow: 0 0 0 3px rgba(255,210,92,0.55); }}
</style></head>
<body><div class="frame">
  <div class="stars">{stars}</div>
  <div class="moon"></div>
  <div class="rays">{rays}</div>
  <div class="glow"></div>
  <div class="sun"></div>
  {SHIP}
  <div class="sea">
    <div style="top:0">{WAVE("#0d2b52", 22, True)}</div>
    <div style="top:56px">{WAVE("#08203f", 24, True)}</div>
    <div style="top:120px">{WAVE("#04152b", 22, False)}</div>
  </div>
  <header>
    <div class="logo"><img src="assets/img/riyada-full.png" alt="فريق ريادة التطوعي" /></div>
    <div class="kicker">{KICKER}</div>
    <div class="title">{TITLE}</div>
    <div class="q">{QUESTION_1}</div>
    <div class="q q2">{QUESTION_2}</div>
  </header>
  <div class="foot"><span>{FOOT}</span></div>
</div></body></html>'''
(ROOT / "teaser.html").write_text(page)

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
js = ROOT / ".teaser-shot.cjs"
js.write_text(shot)
(ROOT / "renders").mkdir(exist_ok=True)
subprocess.run(["node", str(js), str(ROOT / "teaser.html"), str(ROOT / "renders" / "teaser.png")], check=True)
js.unlink()
print("teaser:", ROOT / "renders" / "teaser.png")
