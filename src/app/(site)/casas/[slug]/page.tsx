import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getHouseType, offerLabel } from "@/features/houses/catalog";
import { hasModel } from "@/features/houses/media";

import { FloorPlans } from "./_components/FloorPlans";
import { HouseModel } from "./_components/house-model/HouseModel";
import { HouseFloors } from "./_components/HouseFloors";
import { HouseOutro, OUTRO_ID } from "./_components/HouseOutro";
import { HousePresentation } from "./_components/HousePresentation";
import { PageTop } from "./_components/PageTop";
import { floorViews } from "./_lib/floor-views";
import { describeSection, houseSection } from "./_lib/house-section";

export async function generateMetadata({ params }: PageProps<"/casas/[slug]">): Promise<Metadata> {
  const houseType = await getHouseType((await params).slug);
  if (!houseType) return {};
  const { name, kind, description, availability } = houseType;
  const offer = offerLabel(availability);
  const title = `${name} · ${kind}`;
  return {
    title,
    description: `${description} ${offer}.`,
    openGraph: { title: `${title} · Costa Calma`, description: `${description} ${offer}.` },
  };
}

export default async function HousePage({ params }: PageProps<"/casas/[slug]">) {
  // The layout has already answered 404 for an unknown slug, and shows the hero.
  const houseType = await getHouseType((await params).slug);
  if (!houseType) notFound();
  const { slug, name, plan } = houseType;
  const views = floorViews(plan);
  const section = houseSection(plan);

  return (
    <>
      <PageTop />
      <HousePresentation houseType={houseType} />
      {/* A house with its model is walked through there; one without, plan by plan and floor by
          floor. */}
      {hasModel(slug) && section ? (
        <HouseModel
          name={name}
          plan={plan}
          section={{ drawing: section, description: describeSection(name, section) }}
          floors={views.floors}
          firstStorey={views.firstStorey}
          bounds={views.bounds}
          skipHref={`#${OUTRO_ID}`}
        />
      ) : (
        <>
          <FloorPlans houseType={houseType} />
          <HouseFloors houseType={houseType} />
        </>
      )}
      <HouseOutro slug={houseType.slug} />
    </>
  );
}
