// Builds a scroll-scrubbed sequence (the flight, and later each tour) into public/media/<id>/:
// an all-keyframe H.264 MP4 and a VP9 WebM per format, a poster, a still per chapter and the
// manifest that the scrub engine reads. Usage and the Google Flow side: docs/media/flight.md.
//
//   npm run media:flight                       placeholder clips drawn from brand gradients
//   npm run media:flight -- --from <dir>       real clips: <dir>/{desktop,mobile}/<chapter>.<ext>
//
// Both paths go through the same encoding, so swapping the placeholders for the Flow clips
// only changes the files in public/media/, never the code.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import sharp from "sharp";

import { type SequenceManifest, sequenceManifestSchema } from "../../src/lib/sequence-manifest.ts";

type FormatId = keyof SequenceManifest["sources"];

type Format = {
  width: number;
  height: number;
  /** What a visitor downloads: one of the two videos, in bytes. */
  budget: number;
};

type ChapterSpec = {
  id: string;
  /** Placeholder label, e.g. "Capítulo 1 · El mar". */
  label: string;
  /** Placeholder gradient, brand palette hex colours. */
  colors: [string, string, string];
};

const FPS = 24;
const PLACEHOLDER_CHAPTER_SECONDS = 4;

const formats: Record<FormatId, Format> = {
  desktop: { width: 1600, height: 900, budget: 4_000_000 },
  mobile: { width: 720, height: 1280, budget: 2_500_000 },
};

const sequences: Record<string, ChapterSpec[]> = {
  flight: [
    // mar, mar (Noche), mar-soft
    { id: "sea", label: "Capítulo 1 · El mar", colors: ["#1F5F6B", "#7CC0C9", "#D7E8E9"] },
    // arena, sol, surface
    { id: "beach", label: "Capítulo 2 · La playa", colors: ["#E6D6BC", "#E9B45C", "#F6F1E8"] },
    // terracota, arena, olivo
    {
      id: "development",
      label: "Capítulo 3 · La urbanización",
      colors: ["#C2683F", "#E6D6BC", "#5F6E3F"],
    },
  ],
};

// Constant quality first; if a file is over budget, step the CRF up until it fits.
const codecs = {
  mp4: {
    crf: { from: 23, to: 41, step: 2, softLimit: 31 },
    args: (crf: number) => [
      ...["-c:v", "libx264", "-preset", "slow", "-crf", `${crf}`],
      // Every frame a keyframe, so seeking to any currentTime is instant while scrubbing.
      ...["-g", "1", "-keyint_min", "1", "-sc_threshold", "0"],
      ...["-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart"],
    ],
  },
  webm: {
    crf: { from: 31, to: 63, step: 4, softLimit: 47 },
    args: (crf: number) => [
      ...["-c:v", "libvpx-vp9", "-crf", `${crf}`, "-b:v", "0", "-g", "1"],
      ...["-deadline", "good", "-cpu-used", "2", "-row-mt", "1", "-pix_fmt", "yuv420p"],
    ],
  },
} as const;

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function ffmpeg(args: string[]) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

function frameCount(file: string): number {
  const out = run("ffprobe", [
    ...["-v", "error", "-select_streams", "v:0", "-count_packets"],
    ...["-show_entries", "stream=nb_read_packets", "-of", "csv=p=0", file],
  ]);
  return Number.parseInt(out.trim(), 10);
}

const seconds = (frames: number) => Math.round((frames / FPS) * 1000) / 1000;
const megabytes = (bytes: number) => `${(bytes / 1_000_000).toFixed(2)} MB`;

/** Draws a placeholder chapter: a slowly turning brand gradient, its label and a progress bar. */
async function placeholderClip(work: string, format: Format, chapter: ChapterSpec, index: number) {
  const { width, height } = format;
  const label = join(work, `${chapter.id}-${width}-label.png`);
  const fontSize = Math.round(Math.min(width, height) * 0.06);
  // on-media text on a translucent surface-sunken (Noche) panel, legible on every gradient.
  const text = await sharp({
    text: {
      text: `<span foreground="#F2ECE1">${chapter.label}</span>\n<span foreground="#A9B4B2" size="60%">Marcador · se sustituye por el clip de Google Flow</span>`,
      font: `sans ${fontSize}`,
      align: "center",
      rgba: true,
      dpi: 72,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  await sharp({
    create: {
      width: text.info.width + fontSize * 2,
      height: text.info.height + fontSize * 2,
      channels: 4,
      background: { r: 12, g: 19, b: 20, alpha: 0.7 },
    },
  })
    .composite([{ input: text.data, left: fontSize, top: fontSize }])
    .png()
    .toFile(label);

  const [c0, c1, c2] = chapter.colors.map((hex) => hex.replace("#", "0x"));
  const duration = PLACEHOLDER_CHAPTER_SECONDS;
  const out = join(work, `${chapter.id}-${width}-source.mp4`);
  ffmpeg([
    ...["-f", "lavfi", "-i"],
    `gradients=s=${width}x${height}:r=${FPS}:d=${duration}:n=3:c0=${c0}:c1=${c1}:c2=${c2}:x0=0:y0=0:x1=${width}:y1=${height}:speed=0.03:seed=${index + 1}`,
    ...["-loop", "1", "-i", label],
    ...["-f", "lavfi", "-i", `color=c=0xF2ECE1:s=${width}x${Math.round(height / 90)}:r=${FPS}`],
    "-filter_complex",
    // The bar fills with the chapter, so scrubbing back and forth is visible frame by frame.
    `[0][1]overlay=(W-w)/2:(H-h)/2:shortest=1[labelled];[labelled][2]overlay=x=W*(t/${duration}-1):y=H-h:shortest=1`,
    ...["-frames:v", `${duration * FPS}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "12"],
    out,
  ]);
  return out;
}

function realClip(from: string, formatId: FormatId, chapter: ChapterSpec): string {
  const dir = join(from, formatId);
  const file = readdirSync(dir).find((name) => name.replace(/\.[^.]+$/, "") === chapter.id);
  if (!file) throw new Error(`Missing clip ${join(dir, chapter.id)}.<mp4|mov|webm>`);
  return join(dir, file);
}

/**
 * Scales and crops a clip to the format, at the sequence frame rate, without audio. Flow clips are
 * chained (the last frame of one is the first of the next), so every clip after the first drops
 * its first frame to avoid a held frame at the join.
 */
function normalize(work: string, input: string, format: Format, name: string, dropFirst: boolean) {
  const { width, height } = format;
  const out = join(work, `${name}-normalized.mp4`);
  const filters = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    `fps=${FPS}`,
    "setsar=1",
    "format=yuv420p",
    ...(dropFirst ? ["trim=start_frame=1", "setpts=PTS-STARTPTS"] : []),
  ];
  ffmpeg(["-i", input, "-vf", filters.join(","), "-an", "-c:v", "libx264", "-crf", "12", out]);
  return out;
}

function concat(work: string, clips: string[], name: string) {
  const list = join(work, `${name}-list.txt`);
  writeFileSync(list, clips.map((clip) => `file '${clip}'`).join("\n"));
  const out = join(work, `${name}-master.mp4`);
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out]);
  return out;
}

function encode(master: string, out: string, codec: keyof typeof codecs, budget: number) {
  const { crf, args } = codecs[codec];
  for (let value = crf.from; value <= crf.to; value += crf.step) {
    ffmpeg(["-i", master, "-an", ...args(value), out]);
    const size = statSync(out).size;
    if (size < budget) {
      console.log(`  ${codec} crf ${value}: ${megabytes(size)}`);
      if (value > crf.softLimit) {
        console.warn(
          `  Warning: ${codec} needed crf ${value} to fit; check it for blocking or shorten the clips`,
        );
      }
      return;
    }
  }
  throw new Error(
    `The ${codec} is over ${megabytes(budget)} even at crf ${crf.to}; shorten the clips`,
  );
}

async function frame(master: string, index: number, out: string) {
  const png = `${master}-${index}.png`;
  ffmpeg(["-i", master, "-vf", `select=eq(n\\,${index})`, "-frames:v", "1", png]);
  await sharp(png).webp({ quality: 80 }).toFile(out);
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { from: { type: "string" } },
  });
  const [id] = positionals;
  const chapters = id ? sequences[id] : undefined;
  if (!id || !chapters) {
    throw new Error(`Usage: build-sequence <${Object.keys(sequences).join("|")}> [--from <dir>]`);
  }
  const from = values.from ? resolve(values.from) : undefined;

  const target = resolve("public/media", id);
  const publicUrl = (...parts: string[]) => ["/media", id, ...parts].join("/");
  const work = mkdtempSync(join(tmpdir(), `costa-calma-${id}-`));
  // Built aside and swapped in at the end, so a failed run keeps the current videos.
  const outDir = join(work, "out");

  // Validated as a whole by the manifest schema once both formats are in.
  const sources: Partial<SequenceManifest["sources"]> = {};
  // Chapter spans in frames; desktop and mobile must agree, as they share one manifest.
  let spans: { start: number; end: number }[] = [];

  try {
    for (const formatId of Object.keys(formats) as FormatId[]) {
      const format = formats[formatId];
      console.log(`${id} · ${formatId} ${format.width}×${format.height}`);
      mkdirSync(join(outDir, formatId), { recursive: true });

      const clips: string[] = [];
      for (const [index, chapter] of chapters.entries()) {
        const input = from
          ? realClip(from, formatId, chapter)
          : await placeholderClip(work, format, chapter, index);
        // Only Flow clips are chained; the placeholders start on a frame of their own.
        const chained = from !== undefined && index > 0;
        clips.push(normalize(work, input, format, `${formatId}-${chapter.id}`, chained));
      }

      let frames = 0;
      const formatSpans = clips.map((clip) => {
        const start = frames;
        frames += frameCount(clip);
        return { start, end: frames };
      });
      if (spans.length && JSON.stringify(formatSpans) !== JSON.stringify(spans)) {
        throw new Error(`Desktop and mobile clips differ in length (${formatId})`);
      }
      spans = formatSpans;

      const master = concat(work, clips, formatId);
      encode(master, join(outDir, formatId, `${id}.mp4`), "mp4", format.budget);
      encode(master, join(outDir, formatId, `${id}.webm`), "webm", format.budget);
      await frame(master, 0, join(outDir, formatId, "poster.webp"));

      for (const [index, chapter] of chapters.entries()) {
        const middle = Math.floor((spans[index].start + spans[index].end) / 2);
        await frame(master, middle, join(outDir, formatId, `${chapter.id}.webp`));
      }

      sources[formatId] = {
        mp4: publicUrl(formatId, `${id}.mp4`),
        webm: publicUrl(formatId, `${id}.webm`),
        poster: publicUrl(formatId, "poster.webp"),
        width: format.width,
        height: format.height,
      };
    }

    const manifest = sequenceManifestSchema.parse({
      id,
      sources,
      duration: seconds(spans.at(-1)?.end ?? 0),
      chapters: chapters.map((chapter, index) => ({
        id: chapter.id,
        start: seconds(spans[index].start),
        end: seconds(spans[index].end),
        still: {
          desktop: publicUrl("desktop", `${chapter.id}.webp`),
          mobile: publicUrl("mobile", `${chapter.id}.webp`),
        },
      })),
    });
    writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    rmSync(target, { recursive: true, force: true });
    cpSync(outDir, target, { recursive: true });
    console.log(`Wrote ${publicUrl("manifest.json")} (${manifest.duration} s)`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

await main();
