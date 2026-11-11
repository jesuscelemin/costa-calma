// Writes what Blender builds the development from (ADR 0015): the site plan, and each house type's
// floors as built geometry (rooms, walls with their openings cut out, openings, shades), straight
// from the plans the web uses, so the renders and the web never disagree.
//
// Run: npm run blender:export   (writes assets-src/blender/scene.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { floorGeometry } from "../../src/features/houses/plan.ts";
import { SITE_CENTRE, sitePlan, sitePlans } from "../../src/features/site/data.ts";

const houses = Object.fromEntries(
  Object.entries(sitePlans).map(([slug, plan]) => [
    slug,
    {
      plot: plan.plot,
      partyWall: plan.partyWall ?? null,
      floors: plan.floors.map((floor) => ({
        id: floor.id,
        kind: floor.kind,
        ...floorGeometry(floor, plan),
        canopies: floor.canopies ?? [],
      })),
    },
  ]),
);

const out = process.argv[2] ?? "assets-src/blender/scene.json";
mkdirSync(dirname(out), { recursive: true });
// The centre the site's arcs turn round: the hill rises towards it.
writeFileSync(out, JSON.stringify({ site: sitePlan, centre: SITE_CENTRE, houses }, null, 1));
console.log(
  "wrote",
  out,
  Object.entries(houses)
    .map(([slug, house]) => `${slug}: ${house.floors.length} floors`)
    .join("; "),
);
