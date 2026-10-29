"use client";

import { useEffect, useState, type RefObject } from "react";

import type { SequenceManifest } from "@/lib/sequence-manifest";

import { timelineAt, type TimelineChapter } from "./timeline";

/** Share of the remaining distance to the scroll target covered per 60 fps frame. */
const SMOOTHING = 0.1;
const FRAME_MS = 1000 / 60;
/** Closer than this (in scroll progress) the camera simply lands on the target. */
const SETTLED = 1e-4;
/** Seeking for less than a fraction of a frame is wasted work for the decoder. */
const SEEK_THRESHOLD = 1 / 240;
/**
 * A clip that has not started arriving after this long counts as failed: the motionless
 * alternative is better. Once it arrives, a slow download is left to finish behind the poster.
 */
const LOAD_TIMEOUT_MS = 10_000;

type ScrubSource = Pick<SequenceManifest["sources"]["desktop"], "mp4" | "webm">;

type UseScrubOptions = {
  /**
   * Tall element whose scroll drives the sequence: progress is 0 when its top reaches the top of
   * the viewport and 1 when its bottom reaches the bottom. It gets `--chapter-progress` (0–1).
   */
  trackRef: RefObject<HTMLElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * One format's videos from the manifest (desktop or mobile), or `null` for no video at all (the
   * motionless alternative): the clip is not downloaded, and the chapters still follow the scroll.
   */
  source: ScrubSource | null;
  /** Keep the same array between renders (the manifest's): a new one restarts the loop. */
  chapters: readonly TimelineChapter[];
  /** Share of each chapter's scroll spent on a still frame (see `timelineAt`). */
  hold: number;
};

const clamp = (value: number) => Math.min(Math.max(value, 0), 1);

/** Scroll progress of the track, 0–1. */
function trackProgress(track: HTMLElement) {
  const { top, height } = track.getBoundingClientRect();
  const range = height - window.innerHeight;
  return range > 0 ? clamp(-top / range) : 0;
}

/** The all-keyframe H.264 when the browser plays it, otherwise the VP9 WebM. */
function playableFile(video: HTMLVideoElement, { mp4, webm }: ScrubSource) {
  return video.canPlayType('video/mp4; codecs="avc1.640028"') ? mp4 : webm;
}

/**
 * Scroll-scrubbed video (ADR 0003). Loads the clip whole as a Blob, so seeking never waits on the
 * network, and on every frame eases the scroll progress towards where the page really is, so a
 * jumpy wheel or trackpad still moves the camera smoothly. The eased progress goes through the
 * timeline: the video's `currentTime` follows it, the track gets `--chapter-progress` for the text
 * to style itself with, and the active chapter is returned. The loop runs while the track is on
 * screen (and until it lands after leaving), and everything is released on unmount.
 *
 * If the clip cannot be used (a network error, no answer within `LOAD_TIMEOUT_MS`, or a file the
 * browser cannot decode) it is released and `failed` turns true, for the caller to switch to the
 * motionless alternative. `loaded` turns true once the clip shows its first frame.
 */
export function useScrub({ trackRef, videoRef, source, chapters, hold }: UseScrubOptions) {
  const [chapter, setChapter] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Once failed, the clip is let go for good.
  const clip = failed ? null : source;
  const mp4 = clip?.mp4;
  const webm = clip?.webm;
  const smooth = clip !== null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mp4 || !webm) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LOAD_TIMEOUT_MS);
    let released = false;
    let url: string | undefined;
    const fail = () => setFailed(true);
    const load = () => setLoaded(true);

    fetch(playableFile(video, { mp4, webm }), { signal: controller.signal })
      .then((response) => {
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`The clip answered ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        video.addEventListener("error", fail, { once: true });
        video.addEventListener("loadeddata", load, { once: true });
        video.src = url;
      })
      // Until the clip loads the poster stays. Aborting on unmount is not a failure.
      .catch(() => {
        if (!released) fail();
      });

    return () => {
      released = true;
      clearTimeout(timeout);
      controller.abort();
      video.removeEventListener("error", fail);
      video.removeEventListener("loadeddata", load);
      video.removeAttribute("src");
      video.load();
      if (url) URL.revokeObjectURL(url);
    };
  }, [videoRef, mp4, webm]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let lastTime = 0;
    let eased: number | undefined;
    let active = -1;
    let onScreen = false;

    const tick = (now: number) => {
      const target = trackProgress(track);
      const elapsed = lastTime ? now - lastTime : FRAME_MS;
      lastTime = now;
      // Frame-rate independent easing: the same feel at 60 and 120 Hz. Without a clip there is no
      // camera to smooth (reduced motion among others): the chapters follow the scroll exactly.
      eased =
        eased === undefined || !smooth
          ? target
          : eased + (target - eased) * (1 - (1 - SMOOTHING) ** (elapsed / FRAME_MS));
      if (Math.abs(target - eased) < SETTLED) eased = target;

      const state = timelineAt(eased, chapters, hold);
      track.style.setProperty("--chapter-progress", state.chapterProgress.toFixed(4));
      if (state.chapter !== active) {
        active = state.chapter;
        setChapter(active);
      }
      const video = videoRef.current;
      const canSeek = video !== null && video.readyState >= HTMLMediaElement.HAVE_METADATA;
      const behind = canSeek && Math.abs(video.currentTime - state.time) > SEEK_THRESHOLD;
      if (behind && !video.seeking) video.currentTime = state.time;

      // Off screen, keep going until the camera has landed where the page is (the first or last
      // frame), or coming back would show it catching up from wherever it was left.
      if (onScreen || eased !== target || behind) frame = requestAnimationFrame(tick);
      else stop();
    };

    const start = () => {
      if (frame) return;
      // The page may have moved while the loop slept (an anchor jumping past the flight): land
      // straight on it instead of easing across the whole sequence.
      eased = undefined;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) start();
    });
    observer.observe(track);

    return () => {
      observer.disconnect();
      stop();
      track.style.removeProperty("--chapter-progress");
    };
  }, [trackRef, videoRef, chapters, hold, smooth]);

  return { chapter, failed, loaded };
}
