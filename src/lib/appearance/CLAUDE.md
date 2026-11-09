# Appearance

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Appearance** (roadmap 3.11, `src/lib/appearance/`): only overrides tokens, on `<html>`, replayed before first
  paint by `boot-script.ts`. A new color token goes in `styles.css` and `tokens.ts`. Fonts are self-hosted
  (`src/styles/fonts.css`), never a font CDN.
