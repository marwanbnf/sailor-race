# CLAUDE.md

## Skills policy (standing instruction from the repo owner)

- Any skill the owner shares (a GitHub repo, a link, or a folder) gets installed
  into `.claude/skills/<name>/`, committed, and pushed, so it is available in
  every session on this project. Keep the upstream license file next to it.
- Use installed skills by default for any task they cover. Do not hand-roll
  work a skill already handles. Read the skill's `SKILL.md` before starting.
- Pick the right skill for the job:
  - **Video, motion, montage, trailers, social clips, captions** → `hyperframes`
    (start here), with `hyperframes-cli`, `hyperframes-registry` (search for
    ready-made blocks before building a named effect) and `media-use` (music,
    SFX, voiceover, colour grading).
  - **Short launch films, teasers and feature demos (10–60 s) that should
    feel like one continuous take** → `onetake`. It is noncommercial-only
    (PolyForm Noncommercial 1.0.0): before using it for anything that earns
    money or is for a client, check with the owner (onetake Pro is the paid
    licence). For commercial work, use `hyperframes`.
  - **Hand-painted 2D cartoon shorts and character animation** (brush
    strokes, watercolour, no text) → `claude-animation-base` (p5.js +
    p5.brush). Copy its kit into `videos/<name>/` and read its guide first.
  - Recreating or copying an existing video → `reverse-any-video`.
  - Porting Remotion, Lottie, Three.js or other animation code → `remotion-to-hyperframes`.
  - A video in a known explainer style → `style-sampling`.
  - Live presentation decks → `slideshow`.
  - Figma links or designs → `figma`.
  - **UI and visual design for the game** → follow `DESIGN.md` and
    `PRODUCT.md` first, then:
    - `impeccable`: design, critique, audit, polish, animate or harden any
      screen or component (the default design skill here).
    - `redesign-skill`: upgrade an existing screen without breaking it.
    - `taste-skill`, `soft-skill`, `minimalist-skill`, `brutalist-skill`,
      `gpt-tasteskill`: a specific visual direction or motion style.
    - `ui-ux-pro-max`: palettes, font pairings and UX guidelines.
    - `brandkit`: logos and brand boards. `imagegen-frontend-web` and
      `imagegen-frontend-mobile`: reference images of screens.
      `image-to-code-skill`: build a screen from a generated reference.
    - `stitch-skill`: DESIGN.md design systems. `output-skill`: full,
      untruncated code output.
- Keep the work professional: stay on brand with `DESIGN.md`, use the game's
  real screens and assets instead of invented ones, and check renders
  (`npx hyperframes check`, frame snapshots) before calling a video done.

## Installed skills

| Skill | Source |
|---|---|
| impeccable (v4.5.0) + agents in `.claude/agents/` | [pbakaus/impeccable](https://github.com/pbakaus/impeccable). `${CLAUDE_PLUGIN_ROOT}` paths rewritten to `.claude/skills/impeccable`. Its plugin hooks are not installed. |
| brandkit, brutalist-skill, gpt-tasteskill, image-to-code-skill, imagegen-frontend-mobile, imagegen-frontend-web, minimalist-skill, output-skill, redesign-skill, soft-skill, stitch-skill, taste-skill, taste-skill-v1 | [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill) (MIT, see `.claude/skills/TASTE-SKILL-LICENSE`) |
| onetake | [feitangyuan/onetake](https://github.com/feitangyuan/onetake) @ abb6d17. PolyForm Noncommercial 1.0.0, see `.claude/skills/onetake/LICENSE`. The case films' `.mp4`/`.gif` renders were left out (~220 MB); their sources and READMEs are included. |
| claude-animation-base | [JohnHeibel/ClaudeAnimationBase](https://github.com/JohnHeibel/ClaudeAnimationBase) @ 0ac8bf2 (MIT). The repo has no SKILL.md, so the kit sits in `kit/` and a wrapper `SKILL.md` was written for it. The 6.7 MB animated `docs/emotions.webp` was left out; the `.jpg` model sheets are kept. |
| ui-ux-pro-max | Owner's account skill. Only `SKILL.md` was available; its `scripts/search.py` data is missing, so use its written guidance. |
| figma, hyperframes, hyperframes-cli, hyperframes-registry, media-use, remotion-to-hyperframes, reverse-any-video, slideshow, style-sampling | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `skills/` @ b7a8cfa (Apache-2.0, see `.claude/skills/HYPERFRAMES-LICENSE`) |
