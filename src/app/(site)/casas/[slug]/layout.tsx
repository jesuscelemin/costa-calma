import { notFound } from "next/navigation";

import { getHouseType, listHouseTypes } from "@/features/houses/catalog";

// An unknown slug is expected to block on its 404, not to render an instant shell.
export const instant = false;

export async function generateStaticParams() {
  const houseTypes = await listHouseTypes();
  return houseTypes.map(({ slug }) => ({ slug }));
}

/**
 * Checks the slug above the page's loading boundary: notFound() inside it would come after
 * streaming had started, and the unknown house would answer 200 instead of 404.
 */
export default async function HouseLayout({ children, params }: LayoutProps<"/casas/[slug]">) {
  const { slug } = await params;
  if (!(await getHouseType(slug))) notFound();
  return children;
}
