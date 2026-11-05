/**
 * Where the page under the house's hero starts, as far as Next can tell: at the top of the
 * document. After a navigation Next scrolls the page into view when its start is not, and the
 * hero lives above the page, in the layout: without this first element, the visit would start
 * past it. The page and its loading screen both open with it.
 */
export function PageTop() {
  return <div aria-hidden className="absolute top-0" />;
}
