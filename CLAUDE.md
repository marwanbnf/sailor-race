# CLAUDE.md

## Skills policy (standing instruction from the repo owner)

- Skills live in the owner's skills repo, https://github.com/marwanbnf/my-skills,
  which every cloud session installs into `~/.claude/skills/`, so they work in
  every project. Never install or commit skills into this repo's
  `.claude/skills/`. When the owner shares a new skill, add it to `my-skills`
  (see that repo's `CLAUDE.md`).
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
  - **A short film in a named visual style** (66 styles: oil painting,
    watercolour, ukiyo-e, satellite briefing, product teardown, archive
    documentary, and more), or help picking a style → `lemo-opuscar`. Its
    `setup.sh` downloads the style library to `~/lemo-opuscar` on first use.
    Put film projects in `videos/<name>/`.
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

## Where the skills come from

All skills, with their sources and licenses, are listed in the README of
https://github.com/marwanbnf/my-skills. `ui-ux-pro-max` is an Anthropic
account skill.
