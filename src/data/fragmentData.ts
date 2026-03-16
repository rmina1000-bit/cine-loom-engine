export interface Fragment {
  fragment_id: string;
  source_video: string;
  start_frame: number;
  end_frame: number;
  duration: number;
  thumbnail_hue: number; // hue for generated thumbnail color
  intelligence?: {
    narrative: number;    // 0-1
    emotional: number;
    action: number;
    dialogue: number;
    hook: number;
    callback: number;
    confidence: number;
  };
}

export interface SourceVideo {
  id: string;
  label: string;
  totalFrames: number;
  fps: number;
  description: string;
}

export const sourceVideos: SourceVideo[] = [
  { id: "A", label: "Interview – Main", totalFrames: 7200, fps: 30, description: "Primary interview footage with subject discussing their journey." },
  { id: "B", label: "B-Roll – City", totalFrames: 5400, fps: 30, description: "Urban establishing shots, street scenes, architecture details." },
  { id: "C", label: "B-Roll – Nature", totalFrames: 4800, fps: 30, description: "Landscape footage, forests, rivers, and golden hour shots." },
  { id: "D", label: "Interview – Guest", totalFrames: 6000, fps: 30, description: "Guest speaker segment covering industry insights." },
  { id: "E", label: "Product Demo", totalFrames: 3600, fps: 30, description: "Product walkthrough and feature demonstrations." },
  { id: "F", label: "Archive – Historical", totalFrames: 4200, fps: 24, description: "Historical archive footage and photographs." },
  { id: "G", label: "Outro – Credits", totalFrames: 2400, fps: 30, description: "End credits sequence and closing statements." },
];

function makeIntel(): Fragment["intelligence"] {
  return {
    narrative: Math.random(),
    emotional: Math.random(),
    action: Math.random(),
    dialogue: Math.random(),
    hook: Math.random(),
    callback: Math.random(),
    confidence: 0.5 + Math.random() * 0.5,
  };
}

function makeFragments(src: string, count: number, baseHue: number): Fragment[] {
  const frags: Fragment[] = [];
  let frame = 0;
  for (let i = 1; i <= count; i++) {
    const dur = 30 + Math.floor(Math.random() * 180); // 30-210 frames
    frags.push({
      fragment_id: `${src}${i}`,
      source_video: src,
      start_frame: frame,
      end_frame: frame + dur,
      duration: dur,
      thumbnail_hue: baseHue + (i * 15) % 60,
      intelligence: makeIntel(),
    });
    frame += dur;
  }
  return frags;
}

export const allFragments: Record<string, Fragment[]> = {
  A: makeFragments("A", 12, 30),
  B: makeFragments("B", 9, 200),
  C: makeFragments("C", 8, 120),
  D: makeFragments("D", 10, 0),
  E: makeFragments("E", 7, 280),
  F: makeFragments("F", 6, 50),
  G: makeFragments("G", 5, 320),
};

// Edit structure – the current video assembly
export const initialEditFragments: Fragment[] = [
  allFragments.A[0], allFragments.A[2], allFragments.B[1],
  allFragments.A[4], allFragments.C[0], allFragments.C[2],
  allFragments.D[1], allFragments.A[6], allFragments.B[3],
  allFragments.E[0], allFragments.D[3], allFragments.A[8],
  allFragments.C[4], allFragments.B[5], allFragments.G[0],
];

// Reserved fragments
export const initialReservedFragments: Fragment[] = [
  allFragments.F[2], allFragments.D[5], allFragments.B[7],
  allFragments.A[10],
];

export function formatDuration(frames: number, fps: number = 30): string {
  const seconds = frames / fps;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(0);
  return `${m}:${s.padStart(2, "0")}`;
}
