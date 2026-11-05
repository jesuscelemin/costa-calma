// The shared transition from a house type's card to its page's hero (ADR 0005): both carry the
// same view transition name, so the browser morphs one into the other, and back.

/** View transition name of a house type's card and of its page's hero. */
export function houseTypeTransitionName(slug: string) {
  return `house-type-${slug}`;
}

/** Class of that morph's pseudo-elements, for its CSS (`::view-transition-group(.house-type)`). */
export const houseTypeTransitionClass = "house-type";
