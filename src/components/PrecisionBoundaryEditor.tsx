import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Fragment, allFragments, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { X, Check, RotateCcw, ArrowLeftRight, ChevronLeft, ChevronRight, GripHorizontal } from "lucide-react";

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

// Duration state for up to 4 fragments
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
  // Which bar is being dragged: 'left' | 'right' | 'single' | null
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

  // For cross-source, identify the 4 fragments
  const nextL = leftFrag ? next(leftFrag) : null;
  const prevR = rightFrag ? prev(rightFrag) : null;

  // Initialize durations for all rail fragments
  useEffect(() => {
    if (!target || !open || !leftFrag || !rightFrag) return;
    const map: DurationMap = {};
    railFragments.forEach(f => { map[f.fragment_id] = f.duration; });
    setDurations(map);
    setPos(null);
  }, [target, open, leftFrag, rightFrag, railFragments]);

  const getDur = useCallback((f: Fragment) => durations[f.fragment_id] ?? f.duration, [durations]);

  const setDur = useCallback((fragId: string, val: number) => {
    setDurations(prev => ({ ...prev, [fragId]: val }));
  }, []);

  const hasChanges = useMemo(() => {
    return railFragments.some(f => (durations[f.fragment_id] ?? f.duration) !== f.duration);
  }, [railFragments, durations]);

  const handleReset = useCallback(() => {
    const map: DurationMap = {};
    railFragments.forEach(f => { map[f.fragment_id] = f.duration; });
    setDurations(map);
  }, [railFragments]);

  const handleApply = useCallback(() => {
    if (!target || !leftFrag || !rightFrag) return;
    const updated = [...fragments];
    // Apply all changed durations
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
    onOpenChange(false);
  }, [target, fragments, railFragments, durations, leftFrag, rightFrag, onApply, onOpenChange]);

  // Adjust a specific pair boundary
  const adjustPairBoundary = useCallback((fragAId: string, fragBId: string, delta: number) => {
    const curA = durations[fragAId] ?? 0;
    const curB = durations[fragBId] ?? 0;
    const newA = curA + delta;
    const newB = curB - delta;
    if (newA >= MIN_DURATION && newB >= MIN_DURATION) {
      setDurations(prev => ({ ...prev, [fragAId]: newA, [fragBId]: newB }));
    }
  }, [durations]);

  // --- Window drag ---
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

  // --- Proportion bar drag ---
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
          // Find fragA and fragB ids from the bar context
          // We stored origA/origB but need the fragment ids — they're encoded in the handler closure
          // We'll use a different approach: store ids in ref
          setDurations(prev => {
            // We need to know which fragments. Let's use the barId to determine.
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

  // Determine which pairs exist for proportion bars
  // same-source: single bar between L and R
  // cross-source: bar1 = L|next(L), bar2 = prev(R)|R, seam marker between blocks
  const leftBlockFrags = isCrossSource
    ? railFragments.filter(f => f.source_video === leftFrag.source_video)
    : [];
  const rightBlockFrags = isCrossSource
    ? railFragments.filter(f => f.source_video === rightFrag.source_video)
    : [];

  // Render a proportion bar for a pair of fragments
  const renderProportionBar = (fragA: Fragment, fragB: Fragment, barId: string, label: string) => {
    const durA = getDur(fragA);
    const durB = getDur(fragB);
    const total = durA + durB;
    const pctA = total > 0 ? (durA / total) * 100 : 50;
    const diffA = durA - fragA.duration;
    const diffB = durB - fragB.duration;
    const isDraggingThis = draggingBar === barId;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">{label}</span>
          <span className="text-[8px] text-muted-foreground/30 font-mono">
            {fragA.fragment_id} {formatDuration(durA)} : {fragB.fragment_id} {formatDuration(durB)}
          </span>
          {(diffA !== 0 || diffB !== 0) && (
            <span className="text-[8px] ml-auto">
              {diffA !== 0 && (
                <span className={diffA > 0 ? "text-green-400/70" : "text-red-400/70"}>
                  {fragA.fragment_id} {diffA > 0 ? "+" : ""}{diffA}f
                </span>
              )}
              {diffA !== 0 && diffB !== 0 && <span className="text-muted-foreground/20 mx-1">·</span>}
              {diffB !== 0 && (
                <span className={diffB > 0 ? "text-green-400/70" : "text-red-400/70"}>
                  {fragB.fragment_id} {diffB > 0 ? "+" : ""}{diffB}f
                </span>
              )}
            </span>
          )}
        </div>
        {/* Bar */}
        <div className="relative w-full rounded-md overflow-hidden border border-border/20 bg-background/30" style={{ height: 24 }}>
          <div className="absolute top-0 left-0 h-full bg-primary/20 transition-[width] duration-75" style={{ width: `${pctA}%` }}>
            <div className="flex items-center justify-center h-full">
              <span className="text-[9px] font-mono font-semibold text-primary/80">{durA}f</span>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-full bg-accent/30 transition-[width] duration-75" style={{ width: `${100 - pctA}%` }}>
            <div className="flex items-center justify-center h-full">
              <span className="text-[9px] font-mono font-semibold text-foreground/50">{durB}f</span>
            </div>
          </div>
          {/* Draggable handle */}
          <div
            className={`absolute top-0 h-full cursor-col-resize z-10 flex items-center justify-center group ${isDraggingThis ? '' : 'hover:scale-x-110'}`}
            style={{ left: `calc(${pctA}% - 8px)`, width: 16 }}
            onMouseDown={(e) => handleBarMouseDown(e, fragA.fragment_id, fragB.fragment_id, barId)}
          >
            <div className={`w-[3px] h-[16px] rounded-full transition-all duration-100 ${
              isDraggingThis
                ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
                : "bg-primary/50 group-hover:bg-primary group-hover:shadow-[0_0_6px_hsl(var(--primary)/0.3)]"
            }`} />
          </div>
          {/* Min markers */}
          <div className="absolute top-0 h-full border-l border-dashed border-destructive/20 pointer-events-none" style={{ left: `${(MIN_DURATION / total) * 100}%` }} />
          <div className="absolute top-0 h-full border-r border-dashed border-destructive/20 pointer-events-none" style={{ right: `${(MIN_DURATION / total) * 100}%` }} />
        </div>
        {/* Frame controls for this pair */}
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => adjustPairBoundary(fragA.fragment_id, fragB.fragment_id, -5)}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
            <ChevronLeft size={9} className="inline -mt-px" />5f
          </button>
          <button onClick={() => adjustPairBoundary(fragA.fragment_id, fragB.fragment_id, -1)}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
            <ChevronLeft size={9} className="inline -mt-px" />1f
          </button>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/20 border border-border/15 mx-0.5">
            <span className="text-[8px] text-muted-foreground/40">경계</span>
            <span className="text-[10px] font-mono font-semibold text-foreground/80">F{fragA.start_frame + getDur(fragA)}</span>
          </div>
          <button onClick={() => adjustPairBoundary(fragA.fragment_id, fragB.fragment_id, 1)}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
            1f<ChevronRight size={9} className="inline -mt-px" />
          </button>
          <button onClick={() => adjustPairBoundary(fragA.fragment_id, fragB.fragment_id, 5)}
            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
            5f<ChevronRight size={9} className="inline -mt-px" />
          </button>
        </div>
      </div>
    );
  };

  // Find the seam boundary index in railFragments (where left block ends and right block starts)
  const seamIndex = isCrossSource ? leftBlockFrags.length - 1 : -1;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => onOpenChange(false)} />
      <div
        ref={panelRef}
        className="fixed z-50 w-[580px] max-w-[95vw] rounded-xl border border-border/30 bg-card shadow-2xl overflow-hidden"
        style={{
          left: `calc(50% + ${pos?.x ?? 0}px)`,
          top: `calc(50% + ${pos?.y ?? 0}px)`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-border/15 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center gap-2.5">
            <GripHorizontal size={12} className="text-muted-foreground/30" />
            <ArrowLeftRight size={13} className="text-primary/70" />
            <span className="text-[12px] font-semibold text-foreground/90">비례바 정밀편집</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/30 border border-border/15">
              <span className="text-[10px] font-medium text-foreground/70">{leftFrag.fragment_id}</span>
              {isCrossSource && (
                <span className="text-[7px] px-1 py-px rounded bg-muted/40 text-muted-foreground/50 font-medium">{leftFrag.source_video}</span>
              )}
              <span className="text-muted-foreground/30 text-[10px]">↔</span>
              <span className="text-[10px] font-medium text-foreground/70">{rightFrag.fragment_id}</span>
              {isCrossSource && (
                <span className="text-[7px] px-1 py-px rounded bg-muted/40 text-muted-foreground/50 font-medium">{rightFrag.source_video}</span>
              )}
            </div>
            <button onClick={() => onOpenChange(false)} className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground/50 hover:text-foreground/70 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Panorama Rail */}
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-stretch rounded-lg overflow-hidden border border-border/20 bg-background/40" style={{ height: 88 }}>
            {railFragments.map((f, i) => {
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const dur = getDur(f);
              const widthPct = totalDur > 0 ? (dur / totalDur) * 100 : 25;
              const isTarget = f.fragment_id === leftFrag.fragment_id || f.fragment_id === rightFrag.fragment_id;

              // Determine boundary type between this fragment and the next
              let boundaryType: 'seam' | 'source-internal' | 'none' = 'none';
              if (i < railFragments.length - 1) {
                const cur = f;
                const nxt = railFragments[i + 1];
                if (isCrossSource && i === seamIndex) {
                  boundaryType = 'seam'; // cross-source seam — non-draggable marker
                } else {
                  boundaryType = 'source-internal';
                }
              }

              return (
                <React.Fragment key={f.fragment_id}>
                  <div
                    className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${!isTarget ? "opacity-35" : ""}`}
                    style={{ width: `${widthPct}%`, minWidth: 36 }}
                  >
                    <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />
                    <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold ${isTarget ? "text-foreground/95" : "text-foreground/40"}`}>{f.fragment_id}</span>
                        {isCrossSource && (
                          <span className="text-[7px] px-1 py-px rounded bg-black/40 text-foreground/50 font-medium">{f.source_video}</span>
                        )}
                        {!isTarget && <span className="text-[6px] text-muted-foreground/30 uppercase tracking-wider">ctx</span>}
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={`text-[9px] ${isTarget ? "text-foreground/70 font-medium" : "text-foreground/35"}`}>{formatDuration(dur)}</span>
                        <span className="text-[7px] text-foreground/20">F{f.start_frame}</span>
                      </div>
                    </div>
                    {isTarget && <div className="absolute inset-0 border border-primary/25 pointer-events-none z-20" />}
                  </div>

                  {/* Boundary between strips */}
                  {i < railFragments.length - 1 && (
                    boundaryType === 'seam' ? (
                      // Cross-source seam marker — NOT draggable
                      <div className="flex-shrink-0 flex flex-col items-center justify-center relative" style={{ width: 20 }}>
                        <div className="h-full w-[2px] bg-[hsl(var(--ccut-amber)/0.5)] rounded-full" />
                        <div className="absolute top-1/2 -translate-y-1/2 px-1 py-px rounded bg-[hsl(var(--ccut-amber)/0.15)] border border-[hsl(var(--ccut-amber)/0.25)]">
                          <span className="text-[6px] font-bold text-[hsl(var(--ccut-amber))] uppercase tracking-wider">seam</span>
                        </div>
                      </div>
                    ) : (
                      // Source-internal boundary — thin divider (no drag on rail, drag is on proportion bar)
                      <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 4 }}>
                        <div className="h-full w-px bg-border/20 rounded-full" />
                      </div>
                    )
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Proportion Bars */}
        <div className="px-4 pt-1 pb-2 space-y-3">
          {isCrossSource && nextL && prevR ? (
            <>
              {/* Left source bar: L | next(L) */}
              {renderProportionBar(leftFrag, nextL, 'left', `${leftFrag.source_video} 경계`)}
              
              {/* Seam marker between the two bars */}
              <div className="flex items-center gap-2 py-0.5">
                <div className="flex-1 h-px bg-[hsl(var(--ccut-amber)/0.15)]" />
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[hsl(var(--ccut-amber)/0.08)] border border-[hsl(var(--ccut-amber)/0.2)]">
                  <span className="text-[8px] font-semibold text-[hsl(var(--ccut-amber)/0.7)] uppercase tracking-wider">
                    cross-source seam
                  </span>
                  <span className="text-[9px] font-mono text-[hsl(var(--ccut-amber)/0.5)]">
                    {nextL.fragment_id} ↔ {prevR.fragment_id}
                  </span>
                </div>
                <div className="flex-1 h-px bg-[hsl(var(--ccut-amber)/0.15)]" />
              </div>

              {/* Right source bar: prev(R) | R */}
              {renderProportionBar(prevR, rightFrag, 'right', `${rightFrag.source_video} 경계`)}
            </>
          ) : (
            /* Same-source: single bar L | R */
            renderProportionBar(leftFrag, rightFrag, 'single', '비례바')
          )}
        </div>

        {/* Change summary + actions */}
        <div className="px-4 py-2.5 border-t border-border/15 bg-secondary/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50 flex-wrap">
              {railFragments.map(f => {
                const diff = getDur(f) - f.duration;
                if (diff === 0) return null;
                return (
                  <span key={f.fragment_id} className={diff > 0 ? "text-green-400/70" : "text-red-400/70"}>
                    {f.fragment_id}: {diff > 0 ? "+" : ""}{diff}f ({formatDuration(getDur(f))})
                  </span>
                );
              })}
              {!hasChanges && <span>변경 없음</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleReset} disabled={!hasChanges}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 transition-all disabled:opacity-30 disabled:pointer-events-none">
                <RotateCcw size={10} /> 초기화
              </button>
              <button onClick={() => onOpenChange(false)}
                className="px-2.5 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 border border-border/20 transition-all">
                취소
              </button>
              <button onClick={handleApply} disabled={!hasChanges}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 transition-all disabled:opacity-30 disabled:pointer-events-none">
                <Check size={10} /> 적용
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrecisionBoundaryEditor;
