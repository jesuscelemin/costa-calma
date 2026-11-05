import { notFound } from "next/navigation";

import { getHouseType, listHouseTypes } from "@/features/houses/catalog";
import { hasModel } from "@/features/houses/media";

import { sheetPosterSvg } from "../../_lib/sheet-poster";
import { isPosterVersion, posterVersions } from "../../_lib/poster-versions";

// The sheet's poster as an SVG file, built with the site: one for each house with a model, theme
// and screen held across or upright.

export async function generateStaticParams() {
  const houseTypes = await listHouseTypes();
  return houseTypes
    .filter(({ slug }) => hasModel(slug))
    .flatMap(({ slug }) => posterVersions.map((version) => ({ slug, version })));
}

export async function GET(_: Request, { params }: RouteContext<"/casas/[slug]/hoja/[version]">) {
  const { slug, version } = await params;
  const houseType = await getHouseType(slug);
  if (!houseType || !hasModel(slug) || !isPosterVersion(version)) notFound();
  const svg = sheetPosterSvg(houseType.plan, houseType.name, version);
  if (!svg) notFound();
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
}
