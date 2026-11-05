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
  - UI and visual design for the game itself → follow `DESIGN.md` and
    `PRODUCT.md`, plus the design skills available in the session
    (impeccable, taste-skill, ui-ux-pro-max).
- Keep the work professional: stay on brand with `DESIGN.md`, use the game's
  real screens and assets instead of invented ones, and check renders
  (`npx hyperframes check`, frame snapshots) before calling a video done.

## Installed skills

| Skill | Source |
|---|---|
| figma, hyperframes, hyperframes-cli, hyperframes-registry, media-use, remotion-to-hyperframes, reverse-any-video, slideshow, style-sampling | [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) `skills/` @ b7a8cfa (Apache-2.0, see `.claude/skills/HYPERFRAMES-LICENSE`) |
