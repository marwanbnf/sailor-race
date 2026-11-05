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
| ui-ux-pro-max | Owner's account skill. Only `SKILL.md` was available; its `scripts/search.py` data is missing, so use its written guidance. |
| figma, hyperframes, hyperframes-cli, hyperframes-registry, media-use, remotion-to-hyperframes, reverse-any-video, slideshow, style-sampling | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `skills/` @ b7a8cfa (Apache-2.0, see `.claude/skills/HYPERFRAMES-LICENSE`) |
