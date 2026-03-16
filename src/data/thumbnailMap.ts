/**
 * Source thumbnail images for prototype/demo.
 * Each source video maps to a sample cinematic still.
 * When real video is uploaded, these are replaced by extracted thumbnails.
 */
import sourceA from "@/assets/thumbs/source-a.jpg";
import sourceB from "@/assets/thumbs/source-b.jpg";
import sourceC from "@/assets/thumbs/source-c.jpg";
import sourceD from "@/assets/thumbs/source-d.jpg";
import sourceE from "@/assets/thumbs/source-e.jpg";
import sourceF from "@/assets/thumbs/source-f.jpg";
import sourceG from "@/assets/thumbs/source-g.jpg";

export const sourceThumbnails: Record<string, string> = {
  A: sourceA,
  B: sourceB,
  C: sourceC,
  D: sourceD,
  E: sourceE,
  F: sourceF,
  G: sourceG,
};

/**
 * Get the thumbnail image URL for a fragment.
 * Priority: real extracted thumbnail > source-level sample image > undefined
 */
export function getFragmentThumbnail(
  fragmentId: string,
  sourceVideo: string,
  realThumbnailUrl?: string
): string {
  if (realThumbnailUrl) return realThumbnailUrl;
  return sourceThumbnails[sourceVideo] || sourceA;
}
