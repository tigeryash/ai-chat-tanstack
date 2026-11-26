# Appearance

Notes for working in this folder. The root [CLAUDE.md](/CLAUDE.md) (commands, hard rules, conventions, workflow) still applies.

- **Appearance** (roadmap 3.11, `src/lib/appearance/`): only overrides tokens, on `<html>`, replayed before first
  paint by `boot-script.ts`. A new color token goes in `styles.css` and `tokens.ts`. Fonts are self-hosted
  (`src/styles/fonts.css`), never a font CDN.
- **Presets** (R2 S9, `presets.ts`): plain settings the app ships, with ids in `preset-ids.ts` so the schema stays
  small. Only Settings → Appearance and the palette import `presets.ts` (bundle budget). "Custom" isn't stored: it's
  `matchesPreset(settings) === false`. A new preset must pass `presets.test.ts` (AA in both schemes).
- **Code colors** (`code-themes.ts`): Shiki theme pairs for Streamdown; Shiki loads with the first code block
  (`src/components/ai-elements/lazy-code-plugin.ts`). Its token classes are listed by `@source inline` in styles.css.
