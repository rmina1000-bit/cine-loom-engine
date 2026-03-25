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
const MAX_VISIBLE = 4;
const DEFAULT_VISIBLE = 3;

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

function selectContextFragments(L: Fragment, R: Fragment, expanded = false): Fragment[] {
  const visibleCount = expanded ? MAX_VISIBLE : DEFAULT_VISIBLE;
  const isSameSource = L.source_video === R.source_video;

  if (isSameSource) {
    // Build ordered window from source: [prev(L), L, R, next(R)]
    const candidates = [prev(L), L, R, next(R)].filter(Boolean) as Fragment[];
    candidates.sort((a, b) => originalIndex(a) - originalIndex(b));
    const result: Fragment[] = [];
    for (const item of candidates) {
      uniquePush(result, item);
      if (result.length >= visibleCount) break;
    }
    return result;
  } else {
    // Cross-source: start with L, R then add direct candidates by priority
    const result: Fragment[] = [];
    uniquePush(result, L);
    uniquePush(result, R);
    const directCandidates = [next(L), prev(R), prev(L), next(R)];
    for (const item of directCandidates) {
      if (result.length >= visibleCount) break;
      uniquePush(result, item);
    }
    return result;
  }
}

const PrecisionBoundaryEditor: React.FC<PrecisionBoundaryEditorProps> = ({
  open,
  onOpenChange,
  fragments,
  target,
  onApply,
}) => {
  const [leftDuration, setLeftDuration] = useState(0);
  const [rightDuration, setRightDuration] = useState(0);
  // Draggable window position
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Boundary drag
  const [isDragging, setIsDragging] = useState(false);
  const boundaryDragRef = useRef({ startX: 0, origLeft: 0, origRight: 0 });
  const rafId = useRef<number | null>(null);

  const leftFrag = target ? fragments[target.leftRealIndex] : null;
  const rightFrag = target ? fragments[target.rightRealIndex] : null;
  const isCrossSource = leftFrag && rightFrag ? leftFrag.source_video !== rightFrag.source_video : false;

  // Build panorama rail: max 4 fragments from source context
  const railFragments = useMemo(() => {
    if (!leftFrag || !rightFrag) return [];
    const leftSlice = getSourceSlice(leftFrag, "left");
    const rightSlice = getSourceSlice(rightFrag, "right");
    // Deduplicate (same-source adjacent might overlap)
    const seen = new Set<string>();
    const result: Fragment[] = [];
    for (const f of [...leftSlice, ...rightSlice]) {
      if (!seen.has(f.fragment_id)) {
        seen.add(f.fragment_id);
        result.push(f);
      }
    }
    return result.slice(0, 4);
  }, [leftFrag, rightFrag]);

  // Initialize durations
  useEffect(() => {
    if (!target || !open || !leftFrag || !rightFrag) return;
    setLeftDuration(leftFrag.duration);
    setRightDuration(rightFrag.duration);
    setPos(null); // reset position on open
  }, [target, open, leftFrag, rightFrag]);

  const hasChanges = leftFrag && rightFrag
    ? leftDuration !== leftFrag.duration || rightDuration !== rightFrag.duration
    : false;

  const handleReset = useCallback(() => {
    if (leftFrag) setLeftDuration(leftFrag.duration);
    if (rightFrag) setRightDuration(rightFrag.duration);
  }, [leftFrag, rightFrag]);

  const handleApply = useCallback(() => {
    if (!target || !leftFrag || !rightFrag) return;
    const updated = [...fragments];
    updated[target.leftRealIndex] = {
      ...leftFrag,
      duration: leftDuration,
      end_frame: leftFrag.start_frame + leftDuration,
    };
    updated[target.rightRealIndex] = {
      ...rightFrag,
      duration: rightDuration,
      start_frame: rightFrag.end_frame - rightDuration,
    };
    onApply(updated);
    onOpenChange(false);
  }, [target, fragments, leftFrag, rightFrag, leftDuration, rightDuration, onApply, onOpenChange]);

  // Frame step controls
  const adjustBoundary = useCallback((delta: number) => {
    const newLeft = leftDuration + delta;
    const newRight = rightDuration - delta;
    if (newLeft >= MIN_DURATION && newRight >= MIN_DURATION) {
      setLeftDuration(newLeft);
      setRightDuration(newRight);
    }
  }, [leftDuration, rightDuration]);

  // --- Window drag ---
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't drag on buttons
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    const currentX = pos?.x ?? 0;
    const currentY = pos?.y ?? 0;
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: currentX, origY: currentY };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [pos]);

  // --- Boundary drag on rail ---
  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    boundaryDragRef.current = { startX: e.clientX, origLeft: leftDuration, origRight: rightDuration };
  }, [leftDuration, rightDuration]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const delta = Math.round((e.clientX - boundaryDragRef.current.startX) / 1.5);
        const newL = boundaryDragRef.current.origLeft + delta;
        const newR = boundaryDragRef.current.origRight - delta;
        if (newL >= MIN_DURATION && newR >= MIN_DURATION) {
          setLeftDuration(newL);
          setRightDuration(newR);
        }
      });
    };
    const onUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setIsDragging(false);
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
  }, [isDragging]);

  if (!open || !target || !leftFrag || !rightFrag) return null;

  // Compute display durations for rail
  const getDur = (f: Fragment) =>
    f.fragment_id === leftFrag.fragment_id ? leftDuration
    : f.fragment_id === rightFrag.fragment_id ? rightDuration
    : f.duration;
  const totalDur = railFragments.reduce((s, f) => s + getDur(f), 0);

  const leftDiff = leftDuration - leftFrag.duration;
  const rightDiff = rightDuration - rightFrag.duration;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60" onClick={() => onOpenChange(false)} />

      {/* Draggable panel */}
      <div
        ref={panelRef}
        className="fixed z-50 w-[580px] max-w-[95vw] rounded-xl border border-border/30 bg-card shadow-2xl overflow-hidden"
        style={{
          left: `calc(50% + ${pos?.x ?? 0}px)`,
          top: `calc(50% + ${pos?.y ?? 0}px)`,
          transform: "translate(-50%, -50%)",
        }}
      >
        {/* Header — draggable */}
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
            {/* Seam info */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/30 border border-border/15">
              <span className="text-[10px] font-medium text-foreground/70">{leftFrag.fragment_id}</span>
              {isCrossSource && (
                <span className="text-[7px] px-1 py-px rounded bg-muted/40 text-muted-foreground/50 font-medium">
                  {leftFrag.source_video}
                </span>
              )}
              <span className="text-muted-foreground/30 text-[10px]">↔</span>
              <span className="text-[10px] font-medium text-foreground/70">{rightFrag.fragment_id}</span>
              {isCrossSource && (
                <span className="text-[7px] px-1 py-px rounded bg-muted/40 text-muted-foreground/50 font-medium">
                  {rightFrag.source_video}
                </span>
              )}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground/50 hover:text-foreground/70 transition-colors"
            >
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
              const isSeamBoundary =
                f.fragment_id === leftFrag.fragment_id &&
                i < railFragments.length - 1 &&
                railFragments[i + 1].fragment_id === rightFrag.fragment_id;

              return (
                <React.Fragment key={f.fragment_id}>
                  {/* Fragment strip */}
                  <div
                    className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${!isTarget ? "opacity-35" : ""}`}
                    style={{ width: `${widthPct}%`, minWidth: 36 }}
                  >
                    <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />
                    <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold ${isTarget ? "text-foreground/95" : "text-foreground/40"}`}>
                          {f.fragment_id}
                        </span>
                        {isCrossSource && isTarget && (
                          <span className="text-[7px] px-1 py-px rounded bg-black/40 text-foreground/50 font-medium">
                            {f.source_video}
                          </span>
                        )}
                        {!isTarget && (
                          <span className="text-[6px] text-muted-foreground/30 uppercase tracking-wider">ctx</span>
                        )}
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={`text-[9px] ${isTarget ? "text-foreground/70 font-medium" : "text-foreground/35"}`}>
                          {formatDuration(dur)}
                        </span>
                        <span className="text-[7px] text-foreground/20">
                          F{f.start_frame}
                        </span>
                      </div>
                    </div>
                    {isTarget && (
                      <div className="absolute inset-0 border border-primary/25 pointer-events-none z-20" />
                    )}
                  </div>

                  {/* Boundary between strips */}
                  {i < railFragments.length - 1 && (
                    <div
                      className={`flex-shrink-0 flex items-center justify-center ${
                        isSeamBoundary ? "cursor-col-resize group" : ""
                      }`}
                      style={{ width: isSeamBoundary ? 14 : 4 }}
                      onMouseDown={isSeamBoundary ? handleBoundaryMouseDown : undefined}
                    >
                      <div className={`h-full rounded-full transition-all duration-100 ${
                        isSeamBoundary
                          ? isDragging
                            ? "w-[3px] bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
                            : "w-[2px] bg-primary/40 group-hover:bg-primary/70 group-hover:w-[3px] group-hover:shadow-[0_0_6px_hsl(var(--primary)/0.2)]"
                          : "w-px bg-border/15"
                      }`} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Frame-level controls */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => adjustBoundary(-5)}
              className="px-2 py-1 rounded text-[9px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
              <ChevronLeft size={10} className="inline -mt-px" />5f
            </button>
            <button onClick={() => adjustBoundary(-1)}
              className="px-2 py-1 rounded text-[9px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
              <ChevronLeft size={10} className="inline -mt-px" />1f
            </button>

            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-secondary/20 border border-border/15 mx-1">
              <div className="text-center">
                <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">경계</div>
                <div className="text-[11px] font-mono font-semibold text-foreground/80">
                  F{leftFrag.start_frame + leftDuration}
                </div>
              </div>
            </div>

            <button onClick={() => adjustBoundary(1)}
              className="px-2 py-1 rounded text-[9px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
              1f<ChevronRight size={10} className="inline -mt-px" />
            </button>
            <button onClick={() => adjustBoundary(5)}
              className="px-2 py-1 rounded text-[9px] font-mono font-medium text-muted-foreground/60 hover:text-foreground/80 hover:bg-secondary/50 border border-border/15 transition-all">
              5f<ChevronRight size={10} className="inline -mt-px" />
            </button>
          </div>
        </div>

        {/* Change summary + actions */}
        <div className="px-4 py-2.5 border-t border-border/15 bg-secondary/15">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50">
              {leftDiff !== 0 && (
                <span className={leftDiff > 0 ? "text-green-400/70" : "text-red-400/70"}>
                  {leftFrag.fragment_id}: {leftDiff > 0 ? "+" : ""}{leftDiff}f ({formatDuration(leftDuration)})
                </span>
              )}
              {rightDiff !== 0 && (
                <span className={rightDiff > 0 ? "text-green-400/70" : "text-red-400/70"}>
                  {rightFrag.fragment_id}: {rightDiff > 0 ? "+" : ""}{rightDiff}f ({formatDuration(rightDuration)})
                </span>
              )}
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
