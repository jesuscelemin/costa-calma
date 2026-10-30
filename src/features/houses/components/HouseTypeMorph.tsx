import { ViewTransition } from "react";

import { houseTypeTransitionClass, houseTypeTransitionName } from "../transition";

type HouseTypeMorphProps = {
  slug: string;
  children: React.ReactNode;
};

/**
 * One end of a house type's morph (ADR 0005): its card on the landing and its page's hero carry
 * the same name, so choosing the card grows it into the hero, and Back shrinks it again. Only this
 * morph: no crossfade of its own on unrelated transitions.
 */
export function HouseTypeMorph({ slug, children }: HouseTypeMorphProps) {
  return (
    <ViewTransition
      name={houseTypeTransitionName(slug)}
      share={houseTypeTransitionClass}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
