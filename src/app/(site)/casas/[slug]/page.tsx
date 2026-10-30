import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getHouseType, offerLabel } from "@/features/houses/catalog";

import { HouseFloors } from "./_components/HouseFloors";
import { HouseOutro } from "./_components/HouseOutro";
import { HousePresentation } from "./_components/HousePresentation";

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
      {/*
        After a navigation Next scrolls the page into view when its start is not: with the hero in
        the layout, above it, that would skip the hero. The page starts at the top of the document.
      */}
      <div aria-hidden className="absolute top-0" />
      <HousePresentation houseType={houseType} />
      <HouseFloors houseType={houseType} />
      <HouseOutro slug={houseType.slug} />
    </>
  );
}
