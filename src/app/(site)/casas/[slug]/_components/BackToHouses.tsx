"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cameFromPicker } from "@/features/houses/picker-return";
import { isPlainClick } from "@/lib/events";

import { landingSections, sectionHref } from "../../../_lib/sections";

/** How long to wait for the landing to show the selection after following the link, in ms. */
const ARRIVAL_TIMEOUT = 5000;

/**
 * Scrolls to the selection once the landing shows it. The router scrolls to the link's anchor as
 * the landing commits, but if the landing was not prefetched it commits its loading screen first,
 * with no anchor to scroll to.
 */
function scrollToSelectionOnArrival() {
  const deadline = performance.now() + ARRIVAL_TIMEOUT;
  const step = () => {
    const selection = document.getElementById(landingSections.houseTypes);
    if (location.pathname === "/" && selection?.checkVisibility()) {
      selection.scrollIntoView({ behavior: "instant" });
    } else if (performance.now() < deadline) {
      requestAnimationFrame(step);
    }
  };
  requestAnimationFrame(step);
}

type BackToHousesProps = {
  slug: string;
};

/**
 * «Volver a las casas»: back to the landing's selection of house types. Whoever chose this house
 * there goes back through the history, where the browser restores the landing just as they left
 * it; whoever arrived otherwise follows the link to the selection, which is all there is without
 * JavaScript. Neither replays the loading intro, which only opens a session.
 */
export function BackToHouses({ slug }: BackToHousesProps) {
  const router = useRouter();

  return (
    <Button asChild variant="secondary" size="lg">
      <Link
        href={sectionHref(landingSections.houseTypes)}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          if (!cameFromPicker(slug)) return scrollToSelectionOnArrival();
          event.preventDefault();
          router.back();
        }}
      >
        <ArrowLeftIcon aria-hidden />
        Volver a las casas
      </Link>
    </Button>
  );
}
