"use client";

import { useEffect, useRef, useState } from "react";

import { MOBILE_QUERY, REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

type HouseTypeListProps = {
  items: { key: string; card: React.ReactNode }[];
};

/**
 * The house type cards as a list. On desktop, tall panels in a row: the one under the pointer or
 * the keyboard's focus widens and gains light while the others narrow and dim, all in CSS
 * (`[data-picker]` in globals.css). On phones, a native scroll-snap carousel: the centred card,
 * found with an IntersectionObserver, is lit, its neighbours peek in dimmed, and dots below say
 * where you are.
 */
export function HouseTypeList({ items }: HouseTypeListProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const reducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [centred, setCentred] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!mobile || !list) return;
    const cards = [...list.children];
    // A thin strip down the middle of the carousel: the card crossing it is the centred one.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.findLast(({ isIntersecting }) => isIntersecting);
        if (entry) setCentred(cards.indexOf(entry.target));
      },
      { root: list, rootMargin: "0px -45%", threshold: 0 },
    );
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [mobile]);

  return (
    <div className="flex flex-col gap-6">
      <ul
        ref={listRef}
        data-picker
        // The browser scrolls a focused card only just into view, and the snap pulls the carousel
        // back to the card before: centre the card that takes the focus instead.
        onFocus={(event) => {
          if (!mobile) return;
          event.target.closest("li")?.scrollIntoView({
            inline: "center",
            block: "nearest",
            behavior: reducedMotion ? "instant" : "smooth",
          });
        }}
        className={cn(
          "flex gap-2 px-2 md:h-[min(85svh,56rem)] md:gap-4 md:px-4",
          // Phones: each card most of the screen wide, centred when it snaps; the padding lets the
          // first and the last centre too.
          "max-md:snap-x max-md:snap-mandatory max-md:[scrollbar-width:none] max-md:overflow-x-auto max-md:px-[10vw]",
        )}
      >
        {items.map(({ key, card }, index) => (
          <li
            key={key}
            data-picker-item
            data-centred={index === centred || undefined}
            className="max-md:h-[70svh] max-md:w-[80vw] max-md:shrink-0 max-md:snap-center"
          >
            {card}
          </li>
        ))}
      </ul>
      {/* Where you are in the carousel; the list itself tells screen readers how many there are. */}
      <div aria-hidden className="flex justify-center gap-2 md:hidden">
        {items.map(({ key }, index) => (
          <span
            key={key}
            data-dot
            data-active={index === centred || undefined}
            className={cn(
              "h-2 rounded-full motion-safe:transition-[width,background-color]",
              index === centred ? "w-6 bg-ink" : "w-2 bg-ink-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}
