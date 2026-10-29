# Costa Calma

Portfolio project: a cinematic, scroll-driven website for a fictional developer selling new-build homes in a small development by a Mediterranean beach. The interface is in Spanish (Spain).

Work in progress. Screenshots, demo and technical write-up will be added as the phases land.

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # lint, format, types, Vitest unit tests and Playwright E2E
npm run test         # Vitest unit tests only (pure logic, src/**/*.test.ts)
npm run screenshots  # review captures into docs/screenshots/phase-2 (desktop and mobile, Día and Noche)
```

## Phase 1: project base

Brand tokens, fonts, logo, header, mobile menu, Día/Noche theme, footer and the brand 404, error and loading pages. The landing sections are still placeholders.

| Desktop · Día                                                         | Mobile · Noche                                                 |
| --------------------------------------------------------------------- | -------------------------------------------------------------- |
| ![Landing, desktop](docs/screenshots/phase-1/landing-desktop-dia.png) | ![Mobile menu](docs/screenshots/phase-1/menu-mobile-noche.png) |
| ![Footer, desktop](docs/screenshots/phase-1/footer-desktop-dia.png)   | ![404, mobile](docs/screenshots/phase-1/404-mobile-noche.png)  |

All captures, at 1440×900 and 390×844 in both themes, are in [`docs/screenshots/phase-1`](docs/screenshots/phase-1).

### Design sources and tools

- **Header and footer references.** Both come from the Costa Calma design system (palette, type scale, logo guide), not from outside references. The logo guide asks for the logo to sit on a light pill over imagery, which shaped the transparent header over the hero that turns into a solid panel after it. The footer follows the same system: `surface-sunken`, the tagline in Fraunces and a clear portfolio notice.
- **shadcn/ui and Radix:** `Button` and `Sheet` (the full-screen mobile menu), re-themed to the brand tokens, radii and motion. Radix provides the focus trap, Esc to close and focus return.
- **next-themes:** Día/Noche follows the system, remembers the choice and applies it before the first paint without reading cookies, so the landing stays static.
- **Lucide:** the only icon set.
- **Playwright and axe-core:** E2E tests for every flow, plus a WCAG 2.1 AA audit (including text contrast) of the landing, the mobile menu and the 404 in both themes, a full keyboard pass, and the review captures (no console errors, broken images or horizontal overflow).
- **ui-ux-pro-max:** final usability and accessibility review of the phase.
- **Matt Pocock's skills** (grilling, domain-modeling, tdd, implement, code-review, pr) for the spec → tickets → test-first workflow.

The project also plans to use frontend-design, 21st.dev, Mobbin and motionsites. Phase 1 used none of them: its tickets arrived with the design already fixed by the design system. They come in with the cinematic sections from Phase 2 onwards.

### Review fixes

The final review of Phase 1 found and fixed:

- The button focus ring faded in over 550 ms, and its offset was painted in the page colour even on other surfaces. Buttons now use the same instant 2px `mar` outline as links.
- The mobile menu still animated with `prefers-reduced-motion`.
- Buttons showed an arrow cursor instead of a pointer.
- The 404 lost the site header and footer. It now keeps both and still answers with a 404 status.
- With the menu open, widening the window to the desktop header left it open and impossible to close by pointer.
- The loading pulse ran at 2 s, outside the brand's 400–700 ms motion range.

Reviewed and kept on purpose:

- **No active-section highlight in the header yet.** Every section is still a placeholder, and the flight (Phase 2) changes their geometry, so the highlight waits for the real sections.
- **The footer phone and email are plain text, not `tel:`/`mailto:` links.** The contact details are fictitious.
- **The menu links carry `type="button"`.** Radix `SheetClose asChild` adds it. On `<a>` it is only a MIME hint, browsers ignore it, and axe does not flag it.
- **The header and footer have separate link styles.** The header uses a padded pill hover. The footer uses a colour hover aligned to its column edge.
- **The admin area has no `loading` or `error` page yet.** Both arrive with its first page in Phase 5.
- **The error and loading pages have no automated audit of their own.** They are hard to trigger from E2E, but they use the same `StatusScreen` and `Logo` with the same tokens that the 404 audit checks.
