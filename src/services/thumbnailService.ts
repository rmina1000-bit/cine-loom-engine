/**
 * CCUT Thumbnail Extraction Service
 * 
 * Extracts representative thumbnails from real uploaded video fragments.
 * Uses canvas-based frame capture with quality validation and intelligent
 * fallback positioning.
 */

import { Fragment } from "@/data/fragmentData";

// ── Types ──────────────────────────────────────────────────────────────

export interface ThumbnailMeta {
  fragment_id: string;
  source_video_id: string;
  thumbnail_time: number;       // seconds
  thumbnail_url: string;        // blob URL or object URL
  extraction_version: number;
  last_updated: number;         // timestamp
  candidates?: string[];        // additional candidate blob URLs for long fragments
}

interface ExtractionOptions {
  width?: number;
  height?: number;
  format?: "image/jpeg" | "image/png";
  quality?: number;
}

const DEFAULT_OPTIONS: Required<ExtractionOptions> = {
  width: 320,
  height: 180,
  format: "image/jpeg",
  quality: 0.85,
};

// ── Cache ──────────────────────────────────────────────────────────────

const thumbnailCache = new Map<string, ThumbnailMeta>();
let extractionVersion = 1;

/** Get cached thumbnail for a fragment (by id). */
export function getCachedThumbnail(fragmentId: string): ThumbnailMeta | undefined {
  return thumbnailCache.get(fragmentId);
}

/** Clear cache for a specific fragment or all. */
export function clearThumbnailCache(fragmentId?: string) {
  if (fragmentId) {
    const meta = thumbnailCache.get(fragmentId);
    if (meta?.thumbnail_url) URL.revokeObjectURL(meta.thumbnail_url);
    meta?.candidates?.forEach((c) => URL.revokeObjectURL(c));
    thumbnailCache.delete(fragmentId);
  } else {
    thumbnailCache.forEach((meta) => {
      if (meta.thumbnail_url) URL.revokeObjectURL(meta.thumbnail_url);
      meta.candidates?.forEach((c) => URL.revokeObjectURL(c));
    });
    thumbnailCache.clear();
  }
}

// ── Frame quality check ────────────────────────────────────────────────

/**
 * Checks if a captured frame is "good enough" by analyzing pixel data.
 * Rejects fully black, fully white, and very low-variance (blurry/blank) frames.
 */
function isFrameAcceptable(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): boolean {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const sampleStep = Math.max(1, Math.floor(data.length / (4 * 500))); // sample ~500 pixels

  let totalR = 0, totalG = 0, totalB = 0;
  let count = 0;
  let varSum = 0;

  // First pass: gather mean
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    count++;
  }

  if (count === 0) return false;

  const meanR = totalR / count;
  const meanG = totalG / count;
  const meanB = totalB / count;
  const meanLum = (meanR + meanG + meanB) / 3;

  // Reject near-black or near-white
  if (meanLum < 10 || meanLum > 245) return false;

  // Second pass: variance (visual complexity)
  for (let i = 0; i < data.length; i += 4 * sampleStep) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    varSum += (lum - meanLum) ** 2;
  }
  const variance = varSum / count;

  // Very low variance = blank/fade frame
  if (variance < 30) return false;

  return true;
}

// ── Core extraction ────────────────────────────────────────────────────

/**
 * Seek a <video> to a specific time and capture the frame to canvas.
 * Returns a blob URL or null if the frame is unacceptable.
 */
function captureFrameAtTime(
  video: HTMLVideoElement,
  timeSec: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  opts: Required<ExtractionOptions>,
  checkQuality = true
): Promise<string | null> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      try {
        ctx.drawImage(video, 0, 0, opts.width, opts.height);

        if (checkQuality && !isFrameAcceptable(ctx, opts.width, opts.height)) {
          resolve(null);
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(null);
            }
          },
          opts.format,
          opts.quality
        );
      } catch {
        resolve(null);
      }
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = timeSec;
  });
}

// Fallback search positions (relative to fragment duration)
const FALLBACK_POSITIONS = [0.5, 0.45, 0.55, 0.35, 0.65, 0.25, 0.75];

/**
 * Extract a thumbnail for a given fragment from a video element.
 * Implements the CCUT thumbnail extraction rules:
 * - Default: temporal center (50%)
 * - Fallback: 45%, 55%, 35%, 65%, 25%, 75%
 * - Quality gate rejects black/white/blank frames
 */
export async function extractThumbnail(
  fragment: Fragment,
  videoElement: HTMLVideoElement,
  fps: number = 30,
  options?: ExtractionOptions
): Promise<ThumbnailMeta | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const startSec = fragment.start_frame / fps;
  const endSec = fragment.end_frame / fps;
  const durSec = endSec - startSec;

  let selectedUrl: string | null = null;
  let selectedTime = startSec + durSec * 0.5;

  // Try each fallback position
  for (const pos of FALLBACK_POSITIONS) {
    const timeSec = startSec + durSec * pos;
    const url = await captureFrameAtTime(videoElement, timeSec, canvas, ctx, opts);
    if (url) {
      selectedUrl = url;
      selectedTime = timeSec;
      break;
    }
  }

  // Last resort: grab center without quality check
  if (!selectedUrl) {
    const centerTime = startSec + durSec * 0.5;
    selectedUrl = await captureFrameAtTime(videoElement, centerTime, canvas, ctx, opts, false);
    selectedTime = centerTime;
  }

  if (!selectedUrl) return null;

  // For long fragments (>5s), extract additional candidate frames
  let candidates: string[] | undefined;
  if (durSec > 5) {
    candidates = [];
    const candidatePositions = [0.2, 0.4, 0.6, 0.8];
    for (const pos of candidatePositions) {
      const t = startSec + durSec * pos;
      const url = await captureFrameAtTime(videoElement, t, canvas, ctx, opts, false);
      if (url) candidates.push(url);
    }
  }

  const meta: ThumbnailMeta = {
    fragment_id: fragment.fragment_id,
    source_video_id: fragment.source_video,
    thumbnail_time: selectedTime,
    thumbnail_url: selectedUrl,
    extraction_version: extractionVersion,
    last_updated: Date.now(),
    candidates,
  };

  // Cache it
  clearThumbnailCache(fragment.fragment_id); // revoke old
  thumbnailCache.set(fragment.fragment_id, meta);

  return meta;
}

// ── Batch extraction ───────────────────────────────────────────────────

/**
 * Extract thumbnails for all fragments from a given source video.
 * Creates a hidden <video> element, processes sequentially.
 */
export async function extractThumbnailsForSource(
  fragments: Fragment[],
  videoUrl: string,
  fps: number = 30,
  options?: ExtractionOptions
): Promise<ThumbnailMeta[]> {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "auto";
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Video load failed")), { once: true });
  });

  const results: ThumbnailMeta[] = [];
  for (const frag of fragments) {
    const meta = await extractThumbnail(frag, video, fps, options);
    if (meta) results.push(meta);
  }

  // Cleanup
  video.src = "";
  video.load();

  return results;
}

// ── Boundary change detection ──────────────────────────────────────────

const REGEN_THRESHOLD = 0.15; // 15% of duration

/**
 * Determine if a fragment's thumbnail needs regeneration after boundary change.
 */
export function needsThumbnailRegeneration(
  fragment: Fragment,
  fps: number = 30
): boolean {
  const cached = thumbnailCache.get(fragment.fragment_id);
  if (!cached) return true;

  const startSec = fragment.start_frame / fps;
  const endSec = fragment.end_frame / fps;
  const durSec = endSec - startSec;
  const newCenter = startSec + durSec * 0.5;

  // If the cached thumbnail time is now outside the fragment range, regen
  if (cached.thumbnail_time < startSec || cached.thumbnail_time > endSec) {
    return true;
  }

  // If center shifted more than threshold
  const shift = Math.abs(cached.thumbnail_time - newCenter);
  if (shift > durSec * REGEN_THRESHOLD) {
    return true;
  }

  return false;
}

// ── Version bump (for forced refresh) ──────────────────────────────────

export function bumpExtractionVersion() {
  extractionVersion++;
}
