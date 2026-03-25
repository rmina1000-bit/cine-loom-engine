import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, ArrowLeftRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface BoundaryEditorTarget {
  /** The boundary is between these two fragments (by real index in editFragments) */
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

const PrecisionBoundaryEditor: React.FC<PrecisionBoundaryEditorProps> = ({
  open,
  onOpenChange,
  fragments,
  target,
  onApply,
}) => {
  // Local editable copy of relevant fragments
  const [localFragments, setLocalFragments] = useState<Fragment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState<number | null>(null);

  const dragStartX = useRef(0);
  const dragOrigLeft = useRef(0);
  const dragOrigRight = useRef(0);
  const rafId = useRef<number | null>(null);

  // Build the local scope: up to 4 fragments around the target boundary
  const scopeIndices = useMemo(() => {
    if (!target) return [];
    const { leftRealIndex, rightRealIndex } = target;
    const indices: number[] = [];
    // One before left (context)
    if (leftRealIndex > 0) indices.push(leftRealIndex - 1);
    indices.push(leftRealIndex);
    indices.push(rightRealIndex);
    // One after right (context)
    if (rightRealIndex < fragments.length - 1) indices.push(rightRealIndex + 1);
    return indices;
  }, [target, fragments.length]);

  // The index within scopeIndices that corresponds to the primary boundary
  const primaryBoundaryLocalIdx = useMemo(() => {
    if (!target) return 0;
    return scopeIndices.indexOf(target.leftRealIndex);
  }, [target, scopeIndices]);

  // Initialize local fragments when target changes
  useEffect(() => {
    if (!target || !open) return;
    setLocalFragments(scopeIndices.map(i => ({ ...fragments[i] })));
    setActiveBoundary(null);
  }, [target, open, fragments, scopeIndices]);

  const totalDuration = localFragments.reduce((s, f) => s + f.duration, 0);

  // Boundary drag handlers
  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, localIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setActiveBoundary(localIdx);
    dragStartX.current = e.clientX;
    dragOrigLeft.current = localFragments[localIdx].duration;
    dragOrigRight.current = localFragments[localIdx + 1].duration;
  }, [localFragments]);

  useEffect(() => {
    if (!isDragging || activeBoundary === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const deltaFrames = Math.round(delta / 1.5);
        const newLeft = dragOrigLeft.current + deltaFrames;
        const newRight = dragOrigRight.current - deltaFrames;
        if (newLeft < MIN_DURATION || newRight < MIN_DURATION) return;

        setLocalFragments(prev => {
          const updated = [...prev];
          const leftFrag = { ...updated[activeBoundary!] };
          const rightFrag = { ...updated[activeBoundary! + 1] };
          leftFrag.duration = newLeft;
          leftFrag.end_frame = leftFrag.start_frame + newLeft;
          rightFrag.duration = newRight;
          rightFrag.start_frame = rightFrag.end_frame - newRight;
          updated[activeBoundary!] = leftFrag;
          updated[activeBoundary! + 1] = rightFrag;
          return updated;
        });
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
  }, [isDragging, activeBoundary]);

  const handleApply = useCallback(() => {
    if (!target) return;
    const updated = [...fragments];
    scopeIndices.forEach((realIdx, localIdx) => {
      updated[realIdx] = { ...localFragments[localIdx] };
    });
    onApply(updated);
    onOpenChange(false);
  }, [target, fragments, scopeIndices, localFragments, onApply, onOpenChange]);

  const handleReset = useCallback(() => {
    if (!target) return;
    setLocalFragments(scopeIndices.map(i => ({ ...fragments[i] })));
  }, [target, fragments, scopeIndices]);

  const hasChanges = useMemo(() => {
    return localFragments.some((lf, i) => {
      const original = fragments[scopeIndices[i]];
      return original && lf.duration !== original.duration;
    });
  }, [localFragments, fragments, scopeIndices]);

  if (!target) return null;

  const leftFrag = fragments[target.leftRealIndex];
  const rightFrag = fragments[target.rightRealIndex];
  const isCrossSource = leftFrag.source_video !== rightFrag.source_video;

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
              {isCrossSource && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] bg-ccut-amber/10 text-[hsl(var(--ccut-amber))] font-medium">
                  cross-source
                </span>
              )}
              {!isCrossSource && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[8px] bg-primary/10 text-primary/70 font-medium">
                  Source {leftFrag.source_video}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Fragment visualization */}
        <div className="px-5 py-4">
          {/* Fragment thumbnails with boundaries */}
          <div className="flex items-stretch gap-0 rounded-lg overflow-hidden border border-border/20 bg-background/50" style={{ height: 100 }}>
            {localFragments.map((f, i) => {
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const widthPct = totalDuration > 0 ? (f.duration / totalDuration) * 100 : 25;
              const isContext = i < primaryBoundaryLocalIdx || i > primaryBoundaryLocalIdx + 1;
              const isBeingDragged = activeBoundary !== null && (i === activeBoundary || i === activeBoundary + 1);

              return (
                <React.Fragment key={f.fragment_id}>
                  <div
                    className={`relative flex-shrink-0 overflow-hidden transition-opacity duration-150 ${isContext ? "opacity-50" : ""}`}
                    style={{ width: `${widthPct}%`, minWidth: 48 }}
                  >
                    <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 pointer-events-none" />

                    {/* Fragment info */}
                    <div className="relative z-10 flex flex-col justify-between h-full p-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-foreground/90">{f.fragment_id}</span>
                        {isContext && (
                          <span className="text-[7px] text-muted-foreground/50 uppercase tracking-wider">ctx</span>
                        )}
                        {f.excluded && (
                          <span className="text-[7px] text-[hsl(var(--ccut-amber))] uppercase tracking-wider font-medium">excl</span>
                        )}
                      </div>
                      <div className="flex items-end justify-between">
                        <span className={`text-[10px] leading-none ${isBeingDragged ? "text-primary font-medium" : "text-foreground/50"}`}>
                          {formatDuration(f.duration)}
                        </span>
                        <span className="text-[8px] text-foreground/30">
                          F{f.start_frame}–F{f.end_frame}
                        </span>
                      </div>
                    </div>

                    {/* Excluded overlay */}
                    {f.excluded && (
                      <div className="absolute inset-0 pointer-events-none z-20" style={{
                        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 3px, hsl(var(--background) / 0.15) 3px, hsl(var(--background) / 0.15) 4px)`,
                      }} />
                    )}
                  </div>

                  {/* Boundary handle */}
                  {i < localFragments.length - 1 && (
                    <div
                      className="flex-shrink-0 flex items-center justify-center cursor-col-resize group relative"
                      style={{ width: 16 }}
                      onMouseDown={(e) => handleBoundaryMouseDown(e, i)}
                    >
                      <div className={`h-full rounded-full transition-all duration-100 ${
                        activeBoundary === i
                          ? "w-[3px] bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.3)]"
                          : "w-[2px] bg-border/50 group-hover:bg-primary/60 group-hover:w-[3px]"
                      }`} />
                      {/* Boundary label */}
                      <div className={`absolute -bottom-5 text-[7px] font-medium whitespace-nowrap transition-colors ${
                        activeBoundary === i ? "text-primary" : "text-muted-foreground/30 group-hover:text-muted-foreground/60"
                      }`}>
                        {localFragments[i].fragment_id}↔{localFragments[i + 1].fragment_id}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Precision rail */}
          <div className="mt-8 px-1">
            <div className="text-[8px] text-muted-foreground/40 uppercase tracking-widest font-medium mb-2">
              비율 레일
            </div>
            <div className="flex items-center h-6 rounded bg-secondary/30 overflow-hidden border border-border/15">
              {localFragments.map((f, i) => {
                const widthPct = totalDuration > 0 ? (f.duration / totalDuration) * 100 : 25;
                const isContext = i < primaryBoundaryLocalIdx || i > primaryBoundaryLocalIdx + 1;
                const hue = Number({ A: "30", B: "200", C: "120", D: "0", E: "280", F: "50", G: "320" }[f.source_video] ?? f.thumbnail_hue);

                return (
                  <React.Fragment key={f.fragment_id}>
                    <div
                      className={`h-full flex items-center justify-center transition-all duration-150 ${isContext ? "opacity-40" : ""}`}
                      style={{
                        width: `${widthPct}%`,
                        minWidth: 24,
                        background: f.excluded
                          ? `repeating-linear-gradient(-45deg, hsl(${hue} 10% 14%), hsl(${hue} 10% 14%) 2px, hsl(${hue} 10% 17%) 2px, hsl(${hue} 10% 17%) 4px)`
                          : `hsl(${hue} 18% 18%)`,
                      }}
                    >
                      <span className="text-[8px] text-foreground/50 font-medium">{f.fragment_id}</span>
                    </div>
                    {i < localFragments.length - 1 && (
                      <div className={`w-px h-full flex-shrink-0 ${
                        activeBoundary === i ? "bg-primary" : "bg-border/30"
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Frame rulers */}
            <div className="flex items-center mt-1">
              {localFragments.map((f, i) => {
                const widthPct = totalDuration > 0 ? (f.duration / totalDuration) * 100 : 25;
                return (
                  <div
                    key={f.fragment_id}
                    className="text-[7px] text-muted-foreground/30 flex justify-between border-t border-border/10 px-0.5 pt-0.5"
                    style={{ width: `${widthPct}%`, minWidth: 24 }}
                  >
                    <span>F{f.start_frame}</span>
                    {i === localFragments.length - 1 && <span>F{f.end_frame}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info footer */}
        <div className="px-5 py-3 border-t border-border/15 bg-secondary/20">
          <div className="flex items-center justify-between">
            {/* Change summary */}
            <div className="flex items-center gap-3 text-[9px] text-muted-foreground/50">
              {localFragments.map((f, i) => {
                const original = fragments[scopeIndices[i]];
                if (!original) return null;
                const diff = f.duration - original.duration;
                if (diff === 0) return null;
                return (
                  <span key={f.fragment_id} className={diff > 0 ? "text-green-400/70" : "text-red-400/70"}>
                    {f.fragment_id}: {diff > 0 ? "+" : ""}{diff}f
                  </span>
                );
              })}
              {!hasChanges && <span>변경 없음</span>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                disabled={!hasChanges}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <RotateCcw size={10} />
                초기화
              </button>
              <button
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-md text-[10px] font-medium text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/50 border border-border/20 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleApply}
                disabled={!hasChanges}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                <Check size={10} />
                적용
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PrecisionBoundaryEditor;
