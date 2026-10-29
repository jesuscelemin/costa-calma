import { z } from "zod";

// The manifest of a scroll-scrubbed sequence, written by
// scripts/media/build-sequence.mts next to its videos in public/media/<id>/. Paths are public URLs.

// Times are written rounded to the millisecond.
const sameTime = (a: number, b: number) => Math.abs(a - b) < 0.001;

const publicPath = z.string().startsWith("/media/");

const sourceSchema = z.object({
  mp4: publicPath,
  webm: publicPath,
  poster: publicPath,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const chapterSchema = z.object({
  id: z.string().min(1),
  /** Seconds in the clip. */
  start: z.number().nonnegative(),
  end: z.number().positive(),
  /** Still for the motionless alternative (reduced motion or the video failing). */
  still: z.object({ desktop: publicPath, mobile: publicPath }),
});

export const sequenceManifestSchema = z
  .object({
    id: z.string().min(1),
    sources: z.object({ desktop: sourceSchema, mobile: sourceSchema }),
    /** Seconds. */
    duration: z.number().positive(),
    chapters: z.array(chapterSchema).min(1),
  })
  .superRefine((manifest, ctx) => {
    manifest.chapters.forEach((chapter, index) => {
      if (manifest.chapters.findIndex(({ id }) => id === chapter.id) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["chapters", index, "id"],
          message: `Chapter id "${chapter.id}" is repeated`,
        });
      }
      // Chapters chain like the Flow clips they come from: each starts where the previous ends.
      const expectedStart = index === 0 ? 0 : manifest.chapters[index - 1].end;
      if (!sameTime(chapter.start, expectedStart)) {
        ctx.addIssue({
          code: "custom",
          path: ["chapters", index, "start"],
          message: `Chapter "${chapter.id}" should start at ${expectedStart} s`,
        });
      }
      if (chapter.end <= chapter.start) {
        ctx.addIssue({
          code: "custom",
          path: ["chapters", index, "end"],
          message: `Chapter "${chapter.id}" should end after it starts`,
        });
      }
    });
    const last = manifest.chapters.at(-1);
    if (last && !sameTime(last.end, manifest.duration)) {
      ctx.addIssue({
        code: "custom",
        path: ["chapters", manifest.chapters.length - 1, "end"],
        message: `The last chapter should end with the clip (${manifest.duration} s)`,
      });
    }
  });

export type SequenceManifest = z.infer<typeof sequenceManifestSchema>;
