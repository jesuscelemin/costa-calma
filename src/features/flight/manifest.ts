import { sequenceManifestSchema } from "@/lib/sequence-manifest";

// Written by `npm run media:flight`; replacing the videos only rewrites this JSON.
import manifest from "../../../public/media/flight/manifest.json";

export const flightManifest = sequenceManifestSchema.parse(manifest);
