import { posterSrc, POSTER_MARGIN, type PosterVersion } from "../../_lib/poster-versions";

// The sheet's poster, framed in the area the camera frames the sheet in: the version for the theme
// and for the screen, each a file of its own, loaded only if it is the one shown.

const frames = [
  { frame: "horizontal", className: "block [@media(aspect-ratio<9/10)]:hidden" },
  { frame: "vertical", className: "hidden [@media(aspect-ratio<9/10)]:block" },
] as const;
const themes = [
  { theme: "dia", className: "dark:hidden" },
  { theme: "noche", className: "hidden dark:block" },
] as const;

/** Past the area by the poster's margin on every side, for the frame inside it to fall on it. */
const reach = {
  inset: `${-POSTER_MARGIN * 100}%`,
  width: `${(1 + 2 * POSTER_MARGIN) * 100}%`,
  height: `${(1 + 2 * POSTER_MARGIN) * 100}%`,
};

export function SheetPoster({ slug }: { slug: string }) {
  return themes.map(({ theme, className }) => (
    <div key={theme} className={className}>
      {frames.map(({ frame, className }) => (
        // An SVG drawn by the site, at its own size: nothing for next/image to resize.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={frame}
          src={posterSrc(slug, `${theme}-${frame}` satisfies PosterVersion)}
          alt=""
          loading="lazy"
          decoding="async"
          style={reach}
          className={`absolute max-w-none object-contain ${className}`}
        />
      ))}
    </div>
  ));
}
