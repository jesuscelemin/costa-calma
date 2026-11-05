import { notFound } from "next/navigation";

import { getHouseType, listHouseTypes } from "@/features/houses/catalog";

import { HouseHero } from "./_components/HouseHero";

// An unknown slug is expected to block on its 404, not to render an instant shell.
export const instant = false;

// The whole house page is static, so a slug not prerendered waits for its own render instead of
// getting the route's shared shell with a 200: the layout's notFound() then answers 404 from the
// first request.
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const houseTypes = await listHouseTypes();
  return houseTypes.map(({ slug }) => ({ slug }));
}

/**
 * Checks the slug above the page's loading boundary: notFound() inside it would come after
 * streaming had started, and the unknown house would answer 200 instead of 404.
 *
 * The hero lives here too, above that boundary, so it commits with the navigation: the card the
 * visitor chose morphs into it (ADR 0005), which a hero behind the loading screen would miss.
 */
export default async function HouseLayout({ children, params }: LayoutProps<"/casas/[slug]">) {
  const houseType = await getHouseType((await params).slug);
  if (!houseType) notFound();
  return (
    <>
      <HouseHero houseType={houseType} />
      {children}
    </>
  );
}
