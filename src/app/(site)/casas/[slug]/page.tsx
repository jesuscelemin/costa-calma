import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getHouseType, offerLabel } from "@/features/houses/catalog";

import { FloorPlans } from "./_components/FloorPlans";
import { HouseFloors } from "./_components/HouseFloors";
import { HouseOutro } from "./_components/HouseOutro";
import { HousePresentation } from "./_components/HousePresentation";
import { PageTop } from "./_components/PageTop";

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

  return (
    <>
      <PageTop />
      <HousePresentation houseType={houseType} />
      <FloorPlans houseType={houseType} />
      <HouseFloors houseType={houseType} />
      <HouseOutro slug={houseType.slug} />
    </>
  );
}
