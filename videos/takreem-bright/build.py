#!/usr/bin/env python3
"""Builds compositions/show.html and index.html from data.json.

data.json: a list of halaqat, each {"h": name, "avg": points per student, "win": [[name, points, rank], ...]}.
Edit data.json, then run: python3 build.py
"""
import json
import html
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "data.json").read_text())
# the race board's class colours: blue, red, green, violet
COLORS = ["#3B82F6", "#EF4444", "#22C55E", "#8B5CF6", "#F97316"]
RANK = {1: "الأول", 2: "الثاني", 3: "الثالث"}
AR = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")
NUMS = {1: "الأولى", 2: "الثانية", 3: "الثالثة", 4: "الرابعة"}

# ── Timeline (seconds) ──
T_TITLE = (0.0, 4.7)      # «سباق السفن»
T_TODAY = (5.0, 8.7)      # «تكريم اليوم» held 3 s
T_FURSAN = (9.0, 12.4)    # «فارسا الحلقة»
SHIP_IN, SHIP_OUT = 1.5, 1.5
HEAD = 3.0                # the halaqa's name held 3 s
CARD_ONE, CARD_GROUP = 4.0, 5.0

blocks = []
t = 12.6
for i, h in enumerate(DATA):
    groups = []
    # one screen per student; students tied at a rank each get a longer screen
    ranks = [w[2] for w in h["win"]]
    for name, pts, rank in h["win"]:
        groups.append({"rank": rank, "names": [name], "tied": ranks.count(rank) > 1})
    b = {"i": i, "h": h["h"], "avg": h["avg"], "color": COLORS[i % 5], "slot": i + 1, "t0": t}
    b["head"] = (t + 1.0, t + 1.0 + HEAD + 0.4)
    c = b["head"][1]
    b["cards"] = []
    for g in groups:
        d = CARD_GROUP if g["tied"] else CARD_ONE
        b["cards"].append({**g, "s": c, "e": c + d})
        c += d
    b["out"] = c
    b["t1"] = c + SHIP_OUT
    blocks.append(b)
    t = b["t1"] + 0.2

best = max(blocks, key=lambda b: b["avg"])
F0 = t                      # finale: darkness falls
FIN = {
    "dark": F0,
    "title": (F0 + 1.0, F0 + 5.6),     # «والحلقة المتميزة…»
    "shipIn": (F0 + 1.4, F0 + 7.6),    # silhouette sails in
    "light": (F0 + 4.4, F0 + 8.0),     # dawn grows behind it
    "reveal": F0 + 8.0,                # flash, colour, name
    "end": F0 + 14.5,
}
LOGO = (FIN["end"], FIN["end"] + 4.2)
DUR = round(LOGO[1], 2)

esc = html.escape


def fmt(n):
    return f"{int(round(n)):,}"


# ── Markup ──
ships = []
texts = []
for b in blocks:
    ships.append(f'<div id="ship-{b["slot"]}" class="ship big"></div>')
    texts.append(
        f'''<div id="head-{b["slot"]}" class="clip head" data-start="{b["head"][0]:.2f}" data-duration="{b["head"][1] - b["head"][0]:.2f}" style="--team:{b["color"]}">
      <div class="hcard"><div class="hname">{esc(b["h"])}</div></div>
      <div class="ribbon"><span>فارسا الحلقة</span></div>
    </div>'''
    )
    for k, c in enumerate(b["cards"]):
        many = len(c["names"]) > 1
        names = "".join(f'<div class="nm">{esc(n)}</div>' for n in c["names"])
        texts.append(
            f'''<div id="card-{b["slot"]}-{k}" class="clip card" data-start="{c["s"]:.2f}" data-duration="{c["e"] - c["s"]:.2f}" style="--team:{b["color"]}">
      <div class="buoy r{c["rank"]}">
        <div class="bl">المركز</div>
        <div class="ring"><div class="num">{str(c["rank"]).translate(AR)}</div></div>
        <div class="ribbon small"><span>{RANK.get(c["rank"], "")}</span></div>
      </div>
      <div class="ncard">
        <div class="chip">{esc(b["h"])}</div>
        <div class="names">{names}</div>
        <div class="route"><img src="assets/img/island-win.png" alt="" /><i></i><img src="assets/img/island-start.png" alt="" /></div>
      </div>
    </div>'''
        )

timeline = {
    "dur": DUR,
    "blocks": [
        {k: b[k] for k in ("slot", "color", "t0", "out", "t1")}
        | {"cards": [[c["s"], c["e"]] for c in b["cards"]], "head": b["head"]}
        for b in blocks
    ],
    "best": {"slot": best["slot"], "color": best["color"]},
    "fin": FIN,
    "logo": LOGO,
    "T": {"title": T_TITLE, "today": T_TODAY, "fursan": T_FURSAN},
}

show = (ROOT / "show.tpl").read_text()
show = (
    show.replace("<!--SHIPS-->", "\n      ".join(ships))
    .replace("<!--TEXTS-->", "\n    ".join(texts))
    .replace("/*TIMELINE*/", json.dumps(timeline, ensure_ascii=False))
    .replace("{{BEST_NAME}}", esc(best["h"]))
    .replace("{{BEST_AVG}}", fmt(best["avg"]))
    .replace("{{DUR}}", str(DUR))
)
for key, (a, b2) in {"TITLE": T_TITLE, "TODAY": T_TODAY, "FURSAN": T_FURSAN, "FTITLE": FIN["title"], "LOGO": LOGO}.items():
    show = show.replace("{{%s_S}}" % key, f"{a:.2f}").replace("{{%s_D}}" % key, f"{b2 - a:.2f}")
show = show.replace("{{REVEAL_S}}", f'{FIN["reveal"]:.2f}').replace("{{REVEAL_D}}", f'{FIN["end"] - FIN["reveal"]:.2f}')
(ROOT / "compositions" / "show.html").write_text(show)

(ROOT / "index.html").write_text(
    f'''<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: #062a3b; }}
      #root {{ position: relative; width: 100%; height: 100%; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1920" data-height="1080">
      <div id="show" data-composition-id="show" data-composition-src="compositions/show.html" data-start="0" data-duration="{DUR}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = gsap.timeline({{ paused: true }});
    </script>
  </body>
</html>
'''
)
print("duration", DUR)
for b in blocks:
    print(b["h"], round(b["t0"], 2), "→", round(b["t1"], 2), [(c["names"], c["rank"]) for c in b["cards"]])
print("best", best["h"], best["avg"], "finale", round(F0, 2))
