---
name: claude-animation-base
description: Make short hand-painted 2D cartoon videos (character animation with brush strokes, boiling ink lines and watercolour fills, no text) with p5.js and p5.brush, starring Clawd or any character you design, rendered headless to MP4. Use for animated shorts, cartoon clips, character animation, music-video style scenes, mascot animations, or when a video should look hand-drawn rather than motion-graphics or UI-driven.
license: MIT (see kit/LICENSE)
---

# Claude Animation Base

A starter kit from [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) (`0ac8bf2`, MIT). The full kit sits in `kit/` next to this file. It holds a painted character (Clawd), an engine (painting, timing, camera, light, paper), a shot timeline with brush-wipe transitions, and a headless renderer.

## When to use it

- Use it for hand-painted cartoon shorts and character acting, such as a mascot doing something, a story beat, or a music-video moment.
- Use `hyperframes` or `onetake` instead for product UI, kinetic type, captions, or launch films built from real screens.

## Workflow

1. **Never work inside `kit/`.** Copy it to a project folder first, for example `videos/<name>/`:
   ```bash
   mkdir -p videos && cp -r .claude/skills/claude-animation-base/kit videos/<name>
   ```
   Add `videos/*/node_modules` and `videos/*/out` to `.gitignore` if they aren't already there.
2. In that folder, read **`ANIMATION_GUIDE.md` in full** before drawing anything. It holds the rules, the workflow and the API. Look at `docs/emotions.jpg` and `docs/views.jpg`.
3. Run `npm install`. The dependencies are p5, p5.brush and puppeteer-core.
4. Storyboard first. Then write the scene as `src/scenes/<name>.js` and swap it in for `demo.js` in `studio.html`. Don't copy the demo.
5. Check your own work with contact sheets and strips (`node render.mjs --sheet=... / --strip=...`) before the full render.
6. Render the full video with `node render.mjs --clip --out=out/video.mp4`.

## Environment notes

- **Browser:** the renderer needs Chrome or Chromium. In this cloud container, pass `--chrome=/opt/pw-browsers/chromium` or set `CHROME_PATH`; it also finds the Playwright-installed Chromium on Linux.
- **No GPU:** add `--soft-gl`. The p5.brush watercolour fills are slow without a GPU (seconds per frame). For drafts, use fewer or lighter fills, or replace them with something else that fits.
- **Video encoding:** needs `ffmpeg`.

## Using it for Sailor Race

The rules in the guide decide how a video is made. The person asking decides what it's about, and their request beats the guide's rules (for example, if they ask for a caption). To star a Sailor Race sailor or boat instead of Clawd, design the new character with the same `paint()` and `inkLine()` tools. Take its colours and look from the repo's `DESIGN.md` and the game's real assets, so it belongs with the rest of the game.
