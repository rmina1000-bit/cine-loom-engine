import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Fragment, allFragments, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { X, GripHorizontal } from "lucide-react";

export interface BoundaryEditorTarget {
  leftRealIndex: number;
  rightRealIndex: number;
}

interface PrecisionBoundaryEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fragments: Fragment[];
  target: BoundaryEditorTarget | null;
  onApply: (updatedFragments: Fragment[]) => void;
}

const MIN_DURATION = 15;

function prev(frag: Fragment): Fragment | null {
  const sourceFrags = allFragments[frag.source_video] || [];
  const idx = sourceFrags.findIndex(f => f.fragment_id === frag.fragment_id);
  return idx > 0 ? sourceFrags[idx - 1] : null;
}

function next(frag: Fragment): Fragment | null {
  const sourceFrags = allFragments[frag.source_video] || [];
  const idx = sourceFrags.findIndex(f => f.fragment_id === frag.fragment_id);
  return idx >= 0 && idx < sourceFrags.length - 1 ? sourceFrags[idx + 1] : null;
}

function originalIndex(frag: Fragment): number {
  const sourceFrags = allFragments[frag.source_video] || [];
  return sourceFrags.findIndex(f => f.fragment_id === frag.fragment_id);
}

function uniquePush(list: Fragment[], item: Fragment | null) {
  if (!item) return;
  if (!list.find(f => f.fragment_id === item.fragment_id)) {
    list.push(item);
  }
}

function selectContextFragments(L: Fragment, R: Fragment): Fragment[] {
  const isSameSource = L.source_video === R.source_video;
  if (isSameSource) {
    const selected = [prev(L), L, R, next(R)].filter(Boolean) as Fragment[];
    const result: Fragment[] = [];
    selected
      .sort((a, b) => originalIndex(a) - originalIndex(b))
      .forEach(item => uniquePush(result, item));
    return result;
  } else {
    const leftBlock = [L, next(L)].filter(Boolean) as Fragment[];
    leftBlock.sort((a, b) => originalIndex(a) - originalIndex(b));
    const rightBlock = [prev(R), R].filter(Boolean) as Fragment[];
    rightBlock.sort((a, b) => originalIndex(a) - originalIndex(b));
    const result: Fragment[] = [];
    leftBlock.forEach(item => uniquePush(result, item));
    rightBlock.forEach(item => uniquePush(result, item));
    return result;
  }
}

interface DurationMap {
  [fragmentId: string]: number;
}

const PrecisionBoundaryEditor: React.FC<PrecisionBoundaryEditorProps> = ({
  open,
  onOpenChange,
  fragments,
  target,
  onApply,
}) => {
  const [durations, setDurations] = useState<DurationMap>({});
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [draggingBar, setDraggingBar] = useState<string | null>(null);
  const boundaryDragRef = useRef<{ startX: number; origA: number; origB: number; barId: string }>({ startX: 0, origA: 0, origB: 0, barId: '' });
  const rafId = useRef<number | null>(null);

  const leftFrag = target ? fragments[target.leftRealIndex] : null;
  const rightFrag = target ? fragments[target.rightRealIndex] : null;
  const isCrossSource = leftFrag && rightFrag ? leftFrag.source_video !== rightFrag.source_video : false;

  const railFragments = useMemo(() => {
    if (!leftFrag || !rightFrag) return [];
    return selectContextFragments(leftFrag, rightFrag);
  }, [leftFrag, rightFrag]);

  const nextL = leftFrag ? next(leftFrag) : null;
  const prevR = rightFrag ? prev(rightFrag) : null;

  useEffect(() => {
    if (!target || !open || !leftFrag || !rightFrag) return;
    const map: DurationMap = {};
    railFragments.forEach(f => { map[f.fragment_id] = f.duration; });
    setDurations(map);
    setPos(null);
  }, [target, open, leftFrag, rightFrag, railFragments]);

  const getDur = useCallback((f: Fragment) => durations[f.fragment_id] ?? f.duration, [durations]);

  const hasChanges = useMemo(() => {
    return railFragments.some(f => (durations[f.fragment_id] ?? f.duration) !== f.duration);
  }, [railFragments, durations]);

  const handleApply = useCallback(() => {
    if (!target || !leftFrag || !rightFrag) return;
    const updated = [...fragments];
    railFragments.forEach(rf => {
      const newDur = durations[rf.fragment_id] ?? rf.duration;
      const idx = updated.findIndex(f => f.fragment_id === rf.fragment_id);
      if (idx >= 0 && newDur !== rf.duration) {
        updated[idx] = {
          ...updated[idx],
          duration: newDur,
          end_frame: updated[idx].start_frame + newDur,
        };
      }
    });
    onApply(updated);
  }, [target, fragments, railFragments, durations, leftFrag, rightFrag, onApply]);

  // Window drag
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const currentX = pos?.x ?? 0;
    const currentY = pos?.y ?? 0;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: dragRef.current.origX + ev.clientX - dragRef.current.startX, y: dragRef.current.origY + ev.clientY - dragRef.current.startY });
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos]);

  // Proportion bar drag
  const handleBarMouseDown = useCallback((e: React.MouseEvent, fragAId: string, fragBId: string, barId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBar(barId);
    boundaryDragRef.current = { startX: e.clientX, origA: durations[fragAId] ?? 0, origB: durations[fragBId] ?? 0, barId };
  }, [durations]);

  useEffect(() => {
    if (!draggingBar) return;
    const onMove = (e: MouseEvent) => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const delta = Math.round((e.clientX - boundaryDragRef.current.startX) / 1.5);
        const newA = boundaryDragRef.current.origA + delta;
        const newB = boundaryDragRef.current.origB - delta;
        if (newA >= MIN_DURATION && newB >= MIN_DURATION) {
          setDurations(prev => {
            if (boundaryDragRef.current.barId === 'left' && leftFrag && nextL) {
              return { ...prev, [leftFrag.fragment_id]: newA, [nextL.fragment_id]: newB };
            } else if (boundaryDragRef.current.barId === 'right' && prevR && rightFrag) {
              return { ...prev, [prevR.fragment_id]: newA, [rightFrag.fragment_id]: newB };
            } else if (boundaryDragRef.current.barId === 'single' && leftFrag && rightFrag) {
              return { ...prev, [leftFrag.fragment_id]: newA, [rightFrag.fragment_id]: newB };
            }
            return prev;
          });
        }
      });
    };
    const onUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setDraggingBar(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [draggingBar, leftFrag, rightFrag, nextL, prevR]);

  if (!open || !target || !leftFrag || !rightFrag) return null;

  const totalDur = railFragments.reduce((s, f) => s + getDur(f), 0);

  // Determine boundary info for each gap
  const leftBlockFrags = isCrossSource
    ? railFragments.filter(f => f.source_video === leftFrag.source_video)
    : [];
  const seamIdx = isCrossSource ? leftBlockFrags.length - 1 : -1;

  type BoundaryInfo = { type: 'bar'; barId: string; fragA: Fragment; fragB: Fragment } | { type: 'seam' };
  const boundaries: BoundaryInfo[] = [];
  for (let i = 0; i < railFragments.length - 1; i++) {
    if (isCrossSource && i === seamIdx) {
      boundaries.push({ type: 'seam' });
    } else if (!isCrossSource) {
      boundaries.push({ type: 'bar', barId: 'single', fragA: leftFrag, fragB: rightFrag });
    } else {
      const cur = railFragments[i];
      const nxt = railFragments[i + 1];
      const barId = i < seamIdx ? 'left' : 'right';
      boundaries.push({ type: 'bar', barId, fragA: cur, fragB: nxt });
    }
  }

  const handleClose = () => {
    if (hasChanges) handleApply();
    onOpenChange(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={handleClose} />
      <div
        ref={panelRef}
        className="fixed z-50 rounded-lg border border-border/20 bg-card/95 shadow-2xl overflow-hidden backdrop-blur-sm"
        style={{
          left: `calc(50% + ${pos?.x ?? 0}px)`,
          top: `calc(50% + ${pos?.y ?? 0}px)`,
          transform: "translate(-50%, -50%)",
          width: 520,
          maxWidth: '95vw',
        }}
      >
        {/* Minimal drag grip + close */}
        <div
          className="flex items-center justify-between px-2 py-1 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <GripHorizontal size={10} className="text-muted-foreground/15" />
          <button
            onClick={handleClose}
            className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
          >
            <X size={12} />
          </button>
        </div>

        {/* Panorama strip with inline proportion handles */}
        <div className="px-2 pb-2">
          <div className="flex items-stretch rounded-md overflow-hidden border border-border/12 bg-background/30" style={{ height: 76 }}>
            {railFragments.map((f, i) => {
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const dur = getDur(f);
              const widthPct = totalDur > 0 ? (dur / totalDur) * 100 : 25;
              const isTarget = f.fragment_id === leftFrag.fragment_id || f.fragment_id === rightFrag.fragment_id;
              const boundary = i < railFragments.length - 1 ? boundaries[i] : null;

              return (
                <React.Fragment key={f.fragment_id}>
                  {/* Fragment strip segment */}
                  <div
                    className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${!isTarget ? "opacity-25" : ""}`}
                    style={{ width: `${widthPct}%`, minWidth: 28 }}
                  >
                    <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25 pointer-events-none" />
                    <div className="relative z-10 flex flex-col justify-between h-full p-1">
                      <span className={`text-[8px] font-bold ${isTarget ? "text-foreground/90" : "text-foreground/30"}`}>{f.fragment_id}</span>
                      <div className="flex items-end justify-between">
                        <span className={`text-[7px] font-mono ${isTarget ? "text-foreground/55" : "text-foreground/20"}`}>{dur}f</span>
                        {isCrossSource && (
                          <span className="text-[5px] px-0.5 rounded bg-black/40 text-foreground/35">{f.source_video}</span>
                        )}
                      </div>
                    </div>
                    {isTarget && <div className="absolute inset-0 border border-primary/15 pointer-events-none z-20" />}
                  </div>

                  {/* Inline boundary handle or seam marker */}
                  {boundary && boundary.type === 'bar' && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center cursor-col-resize group relative"
                      style={{ width: 10 }}
                      onMouseDown={(e) => handleBarMouseDown(e, boundary.fragA.fragment_id, boundary.fragB.fragment_id, boundary.barId)}
                    >
                      <div className={`w-[2px] h-[55%] rounded-full transition-all duration-100 ${
                        draggingBar === boundary.barId
                          ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
                          : "bg-primary/35 group-hover:bg-primary group-hover:shadow-[0_0_5px_hsl(var(--primary)/0.3)]"
                      }`} />
                    </div>
                  )}
                  {boundary && boundary.type === 'seam' && (
                    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 12 }}>
                      <div className="h-full w-[2px] bg-[hsl(var(--ccut-amber)/0.35)]" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default PrecisionBoundaryEditor;
