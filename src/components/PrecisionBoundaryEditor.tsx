import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Fragment, allFragments, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { X, Check, RotateCcw, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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

/** Get source-based neighbors for a fragment: [prev, self, next] from original source */
function getSourceContext(frag: Fragment): Fragment[] {
  const sourceFrags = allFragments[frag.source_video] || [];
  const idx = sourceFrags.findIndex(f => f.fragment_id === frag.fragment_id);
  if (idx < 0) return [frag];
  const result: Fragment[] = [];
  if (idx > 0) result.push(sourceFrags[idx - 1]);
  result.push(sourceFrags[idx]);
  if (idx < sourceFrags.length - 1) result.push(sourceFrags[idx + 1]);
  return result;
}

/** A single source context rail with draggable boundary on the target fragment */
const SourceRail: React.FC<{
  fragments: Fragment[];
  targetFragId: string;
  side: "left" | "right";
  label: string;
  localDuration: number;
  onDurationChange: (newDuration: number) => void;
  originalDuration: number;
}> = ({ fragments, targetFragId, side, label, localDuration, onDurationChange, originalDuration }) => {
  const dragStartX = useRef(0);
  const dragOrigDur = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const rafId = useRef<number | null>(null);

  // Replace target fragment's duration with local editable version
  const displayFragments = fragments.map(f =>
    f.fragment_id === targetFragId ? { ...f, duration: localDuration } : f
  );
  const totalDuration = displayFragments.reduce((s, f) => s + f.duration, 0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragOrigDur.current = localDuration;
  }, [localDuration]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const delta = e.clientX - dragStartX.current;
        const deltaFrames = Math.round(delta / 1.5);
        const adjust = side === "left" ? deltaFrames : -deltaFrames;
        const newDur = dragOrigDur.current + adjust;
        if (newDur >= MIN_DURATION) onDurationChange(newDur);
      });
    };
    const handleMouseUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setIsDragging(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [isDragging, side, onDurationChange]);

  const diff = localDuration - originalDuration;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-medium">{label}</span>
        <span className="text-[9px] font-medium text-foreground/60">Source {displayFragments[0]?.source_video}</span>
        {diff !== 0 && (
          <span className={`text-[8px] font-medium ml-auto ${diff > 0 ? "text-green-400/70" : "text-red-400/70"}`}>
            {diff > 0 ? "+" : ""}{diff}f
          </span>
        )}
      </div>
      <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-border/20 bg-background/50" style={{ height: 72 }}>
        {displayFragments.map((f, i) => {
          const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
          const widthPct = totalDuration > 0 ? (f.duration / totalDuration) * 100 : 33;
          const isTarget = f.fragment_id === targetFragId;
          const isContext = !isTarget;

          return (
            <React.Fragment key={f.fragment_id}>
              <div
                className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${isContext ? "opacity-40" : ""}`}
                style={{ width: `${widthPct}%`, minWidth: 40 }}
              >
                <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
                <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-semibold ${isTarget ? "text-foreground/90" : "text-foreground/50"}`}>{f.fragment_id}</span>
                    {isContext && <span className="text-[7px] text-muted-foreground/40 uppercase tracking-wider">ctx</span>}
                  </div>
                  <div className="flex items-end justify-between">
                    <span className={`text-[9px] leading-none ${isTarget && isDragging ? "text-primary font-medium" : "text-foreground/50"}`}>
                      {formatDuration(f.duration)}
                    </span>
                    <span className="text-[7px] text-foreground/25">F{f.start_frame}–F{f.start_frame + f.duration}</span>
                  </div>
                </div>
                {isTarget && (
                  <div className="absolute inset-0 border-2 border-primary/30 rounded-lg pointer-events-none z-20" />
                )}
              </div>

              {/* Draggable boundary on the seam-side edge of the target fragment */}
              {i < displayFragments.length - 1 && (
                <div
                  className={`flex-shrink-0 flex items-center justify-center relative ${
                    (side === "left" && f.fragment_id === targetFragId) || (side === "right" && displayFragments[i + 1]?.fragment_id === targetFragId)
                      ? "cursor-col-resize group"
                      : ""
                  }`}
                  style={{ width: 12 }}
                  onMouseDown={
                    (side === "left" && f.fragment_id === targetFragId) || (side === "right" && displayFragments[i + 1]?.fragment_id === targetFragId)
                      ? handleMouseDown
                      : undefined
                  }
                >
                  <div className={`h-full rounded-full transition-all duration-100 ${
                    (side === "left" && f.fragment_id === targetFragId) || (side === "right" && displayFragments[i + 1]?.fragment_id === targetFragId)
                      ? isDragging
                        ? "w-[3px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                        : "w-[2px] bg-border/40 group-hover:bg-primary/60 group-hover:w-[3px]"
                      : "w-px bg-border/20"
                  }`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const PrecisionBoundaryEditor: React.FC<PrecisionBoundaryEditorProps> = ({
  open,
  onOpenChange,
  fragments,
  target,
  onApply,
}) => {
  const [leftDuration, setLeftDuration] = useState(0);
  const [rightDuration, setRightDuration] = useState(0);

  const leftFrag = target ? fragments[target.leftRealIndex] : null;
  const rightFrag = target ? fragments[target.rightRealIndex] : null;
  const isCrossSource = leftFrag && rightFrag ? leftFrag.source_video !== rightFrag.source_video : false;

  const leftSourceContext = useMemo(() => leftFrag ? getSourceContext(leftFrag) : [], [leftFrag]);
  const rightSourceContext = useMemo(() => rightFrag ? getSourceContext(rightFrag) : [], [rightFrag]);

  // For same-source: merge into one rail
  const sameSourceRail = useMemo(() => {
    if (isCrossSource || !leftFrag || !rightFrag) return [];
    const sourceFrags = allFragments[leftFrag.source_video] || [];
    const leftIdx = sourceFrags.findIndex(f => f.fragment_id === leftFrag.fragment_id);
    const rightIdx = sourceFrags.findIndex(f => f.fragment_id === rightFrag.fragment_id);
    if (leftIdx < 0 || rightIdx < 0) return [];
    const start = Math.max(0, Math.min(leftIdx, rightIdx) - 1);
    const end = Math.min(sourceFrags.length - 1, Math.max(leftIdx, rightIdx) + 1);
    const result: Fragment[] = [];
    for (let i = start; i <= end; i++) result.push(sourceFrags[i]);
    return result;
  }, [isCrossSource, leftFrag, rightFrag]);

  // Initialize durations
  useEffect(() => {
    if (!target || !open || !leftFrag || !rightFrag) return;
    setLeftDuration(leftFrag.duration);
    setRightDuration(rightFrag.duration);
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

  if (!target || !leftFrag || !rightFrag) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px] w-[95vw] bg-card border-border/30 p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border/15">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-[13px] font-semibold text-foreground/90 flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-primary/70" />
              비례바 정밀편집
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground/60 flex items-center gap-2">
              <span className="font-medium text-foreground/70">{leftFrag.fragment_id}</span>
              <span className="text-muted-foreground/30">↔</span>
              <span className="font-medium text-foreground/70">{rightFrag.fragment_id}</span>
              {isCrossSource ? (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] bg-ccut-amber/10 text-[hsl(var(--ccut-amber))] font-medium">
                  cross-source · {leftFrag.source_video}↔{rightFrag.source_video}
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] bg-primary/10 text-primary/70 font-medium">
                  same-source · {leftFrag.source_video}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Source context visualization */}
        <div className="px-5 py-4 space-y-4">
          {isCrossSource ? (
            /* Cross-source: two separate source context rails */
            <>
              <SourceRail
                fragments={leftSourceContext}
                targetFragId={leftFrag.fragment_id}
                side="left"
                label="좌측 원본 맥락"
                localDuration={leftDuration}
                onDurationChange={setLeftDuration}
                originalDuration={leftFrag.duration}
              />

              {/* Seam connection indicator */}
              <div className="flex items-center justify-center gap-2 py-1">
                <div className="flex-1 h-px bg-border/15" />
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/30 border border-border/15">
                  <span className="text-[9px] font-medium text-foreground/60">{leftFrag.fragment_id}</span>
                  <ArrowLeftRight size={10} className="text-primary/50" />
                  <span className="text-[9px] font-medium text-foreground/60">{rightFrag.fragment_id}</span>
                  <span className="text-[7px] text-muted-foreground/40 ml-1">seam</span>
                </div>
                <div className="flex-1 h-px bg-border/15" />
              </div>

              <SourceRail
                fragments={rightSourceContext}
                targetFragId={rightFrag.fragment_id}
                side="right"
                label="우측 원본 맥락"
                localDuration={rightDuration}
                onDurationChange={setRightDuration}
                originalDuration={rightFrag.duration}
              />
            </>
          ) : (
            /* Same-source: single continuous rail */
            <>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-medium">원본 맥락</span>
                <span className="text-[9px] font-medium text-foreground/60">Source {leftFrag.source_video}</span>
              </div>
              <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-border/20 bg-background/50" style={{ height: 80 }}>
                {sameSourceRail.map((f, i) => {
                  const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
                  const dur = f.fragment_id === leftFrag.fragment_id ? leftDuration
                    : f.fragment_id === rightFrag.fragment_id ? rightDuration
                    : f.duration;
                  const totalDur = sameSourceRail.reduce((s, sf) => {
                    const d = sf.fragment_id === leftFrag.fragment_id ? leftDuration
                      : sf.fragment_id === rightFrag.fragment_id ? rightDuration
                      : sf.duration;
                    return s + d;
                  }, 0);
                  const widthPct = totalDur > 0 ? (dur / totalDur) * 100 : 25;
                  const isTarget = f.fragment_id === leftFrag.fragment_id || f.fragment_id === rightFrag.fragment_id;
                  const isPrimary = f.fragment_id === leftFrag.fragment_id && sameSourceRail[i + 1]?.fragment_id === rightFrag.fragment_id;

                  return (
                    <React.Fragment key={f.fragment_id}>
                      <div
                        className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${!isTarget ? "opacity-40" : ""}`}
                        style={{ width: `${widthPct}%`, minWidth: 40 }}
                      >
                        <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />
                        <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
                          <span className={`text-[10px] font-semibold ${isTarget ? "text-foreground/90" : "text-foreground/50"}`}>{f.fragment_id}</span>
                          <span className="text-[9px] text-foreground/50">{formatDuration(dur)}</span>
                        </div>
                        {isTarget && <div className="absolute inset-0 border-2 border-primary/30 rounded-lg pointer-events-none z-20" />}
                      </div>
                      {/* Primary boundary handle between the two target fragments */}
                      {i < sameSourceRail.length - 1 && (
                        <SameSourceBoundaryHandle
                          isPrimary={isPrimary}
                          leftDuration={leftDuration}
                          rightDuration={rightDuration}
                          onLeftChange={setLeftDuration}
                          onRightChange={setRightDuration}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/15 bg-secondary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50">
              {leftDuration !== leftFrag.duration && (
                <span className={leftDuration > leftFrag.duration ? "text-green-400/70" : "text-red-400/70"}>
                  {leftFrag.fragment_id}: {leftDuration > leftFrag.duration ? "+" : ""}{leftDuration - leftFrag.duration}f
                </span>
              )}
              {rightDuration !== rightFrag.duration && (
                <span className={rightDuration > rightFrag.duration ? "text-green-400/70" : "text-red-400/70"}>
                  {rightFrag.fragment_id}: {rightDuration > rightFrag.duration ? "+" : ""}{rightDuration - rightFrag.duration}f
                </span>
              )}
              {!hasChanges && <span>변경 없음</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} disabled={!hasChanges}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 transition-all disabled:opacity-30 disabled:pointer-events-none">
                <RotateCcw size={10} /> 초기화
              </button>
              <button onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 border border-border/20 transition-all">
                취소
              </button>
              <button onClick={handleApply} disabled={!hasChanges}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 transition-all disabled:opacity-30 disabled:pointer-events-none">
                <Check size={10} /> 적용
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Boundary handle for same-source rail — only the primary one is draggable */
const SameSourceBoundaryHandle: React.FC<{
  isPrimary: boolean;
  leftDuration: number;
  rightDuration: number;
  onLeftChange: (d: number) => void;
  onRightChange: (d: number) => void;
}> = ({ isPrimary, leftDuration, rightDuration, onLeftChange, onRightChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragOrigLeft = useRef(0);
  const dragOrigRight = useRef(0);
  const rafId = useRef<number | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isPrimary) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragOrigLeft.current = leftDuration;
    dragOrigRight.current = rightDuration;
  }, [isPrimary, leftDuration, rightDuration]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const delta = Math.round((e.clientX - dragStartX.current) / 1.5);
        const newLeft = dragOrigLeft.current + delta;
        const newRight = dragOrigRight.current - delta;
        if (newLeft >= MIN_DURATION && newRight >= MIN_DURATION) {
          onLeftChange(newLeft);
          onRightChange(newRight);
        }
      });
    };
    const handleMouseUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setIsDragging(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, [isDragging, onLeftChange, onRightChange]);

  return (
    <div
      className={`flex-shrink-0 flex items-center justify-center ${isPrimary ? "cursor-col-resize group" : ""}`}
      style={{ width: isPrimary ? 14 : 6 }}
      onMouseDown={handleMouseDown}
    >
      <div className={`h-full rounded-full transition-all duration-100 ${
        isPrimary
          ? isDragging
            ? "w-[3px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
            : "w-[2px] bg-border/40 group-hover:bg-primary/60 group-hover:w-[3px]"
          : "w-px bg-border/20"
      }`} />
    </div>
  );
};

export default PrecisionBoundaryEditor;
