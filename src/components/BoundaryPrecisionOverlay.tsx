import React, { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { motion, AnimatePresence } from "framer-motion";
import { SyntheticCollapsedSeam } from "@/types/boundaryTypes";

interface BoundaryPrecisionOverlayProps {
  seam: SyntheticCollapsedSeam;
  chainFragments: Fragment[];
  chainRealIndices: number[];
  anchorRect: DOMRect;
  /** Called once on mouseUp with the final committed delta */
  onBoundaryCommit: (leftRealIndex: number, rightRealIndex: number, deltaFrames: number) => void;
  /** Called during drag for source recall (lightweight, no board mutation) */
  onSourceRecall?: (leftFrag: Fragment | null, rightFrag: Fragment | null) => void;
  onClose: () => void;
}

const MIN_DURATION = 15;

const BoundaryPrecisionOverlay: React.FC<BoundaryPrecisionOverlayProps> = ({
  seam,
  chainFragments,
  chainRealIndices,
  anchorRect,
  onBoundaryCommit,
  onSourceRecall,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);

  // Local preview overrides: only the overlay sees these during drag
  const [localOverrides, setLocalOverrides] = useState<Map<number, { duration: number; start_frame: number; end_frame: number }>>(new Map());

  const dragStartX = useRef(0);
  const dragOrigLeft = useRef(0);
  const dragOrigRight = useRef(0);
  const lastCommittedDelta = useRef(0);
  const rafId = useRef<number | null>(null);
  const pendingDelta = useRef(0);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 60);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setLocalOverrides(new Map()); onClose(); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Merge chainFragments with local overrides for display
  const displayFragments = useMemo(() => {
    if (localOverrides.size === 0) return chainFragments;
    return chainFragments.map((f, i) => {
      const override = localOverrides.get(i);
      if (!override) return f;
      return { ...f, duration: override.duration, start_frame: override.start_frame, end_frame: override.end_frame };
    });
  }, [chainFragments, localOverrides]);

  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, chainIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIndex(chainIdx);
    dragStartX.current = e.clientX;
    dragOrigLeft.current = chainFragments[chainIdx].duration;
    dragOrigRight.current = chainFragments[chainIdx + 1].duration;
    pendingDelta.current = 0;
    lastCommittedDelta.current = 0;
    setLocalOverrides(new Map());

    // Trigger source recall for the affected pair
    onSourceRecall?.(chainFragments[chainIdx], chainFragments[chainIdx + 1]);
  }, [chainFragments, onSourceRecall]);

  useEffect(() => {
    if (dragIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      pendingDelta.current = e.clientX - dragStartX.current;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const deltaFrames = Math.round(pendingDelta.current / 1.2);
        const newLeft = dragOrigLeft.current + deltaFrames;
        const newRight = dragOrigRight.current - deltaFrames;
        if (newLeft < MIN_DURATION || newRight < MIN_DURATION) return;

        lastCommittedDelta.current = deltaFrames;

        // Update local preview only — no board mutation
        const leftFrag = chainFragments[dragIndex!];
        const rightFrag = chainFragments[dragIndex! + 1];
        setLocalOverrides(new Map([
          [dragIndex!, {
            duration: newLeft,
            start_frame: leftFrag.start_frame,
            end_frame: leftFrag.start_frame + newLeft,
          }],
          [dragIndex! + 1, {
            duration: newRight,
            start_frame: rightFrag.end_frame - newRight,
            end_frame: rightFrag.end_frame,
          }],
        ]));
      });
    };

    const handleMouseUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }

      // Commit the final delta to the main board
      if (lastCommittedDelta.current !== 0) {
        onBoundaryCommit(
          chainRealIndices[dragIndex!],
          chainRealIndices[dragIndex! + 1],
          lastCommittedDelta.current,
        );
      }

      setDragIndex(null);
      setLocalOverrides(new Map());
      onSourceRecall?.(null, null);
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
  }, [dragIndex, chainFragments, chainRealIndices, onBoundaryCommit, onSourceRecall]);

  if (displayFragments.length === 0) return null;

  const totalDuration = displayFragments.reduce((s, f) => s + f.duration, 0);
  const overlayWidth = Math.min(520, Math.max(240, totalDuration * 0.8));
  const left = anchorRect.left + anchorRect.width / 2 - overlayWidth / 2;
  const top = anchorRect.top - 88;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 3 }}
        transition={{ type: "tween", duration: 0.1, ease: "easeOut" }}
        className="fixed z-[100]"
        style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      >
        <div className="text-[8px] text-muted-foreground/50 mb-0.5 tracking-widest font-medium px-1 uppercase">
          Precision
        </div>

        <div
          className="rounded-md border border-border/30 bg-card/96 backdrop-blur-sm"
          style={{
            boxShadow: "0 6px 24px -6px hsl(var(--background) / 0.6), 0 1px 4px -1px hsl(var(--primary) / 0.06)",
            width: overlayWidth,
          }}
        >
          <div className="flex items-stretch p-1.5 gap-0">
            {displayFragments.map((f, i) => {
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const widthPct = (f.duration / totalDuration) * 100;
              const isBeingDragged = dragIndex !== null && (i === dragIndex || i === dragIndex + 1);

              return (
                <React.Fragment key={f.fragment_id}>
                  <div
                    className={`relative rounded-sm overflow-hidden flex-shrink-0 ${
                      f.excluded ? "opacity-35" : ""
                    }`}
                    style={{ width: `${widthPct}%`, minWidth: 32, height: 44 }}
                  >
                    <img src={thumbUrl} alt={f.fragment_id} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

                    <div className="relative z-10 flex flex-col justify-between h-full p-1">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[8px] font-semibold text-foreground/85 leading-none">
                          {f.fragment_id}
                        </span>
                        {f.excluded && (
                          <span className="text-[6px] text-muted-foreground/60 uppercase tracking-wider font-medium">excl</span>
                        )}
                      </div>
                      <span className={`text-[7px] leading-none ${isBeingDragged ? "text-primary/70 font-medium" : "text-foreground/45"}`}>
                        {formatDuration(f.duration)}
                      </span>
                    </div>

                    {f.excluded && (
                      <div className="absolute inset-0 pointer-events-none z-20" style={{
                        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 2px, hsl(var(--background) / 0.12) 2px, hsl(var(--background) / 0.12) 3px)`,
                      }} />
                    )}
                  </div>

                  {i < displayFragments.length - 1 && (
                    <div
                      className="flex-shrink-0 cursor-col-resize flex items-center justify-center group relative"
                      style={{ width: 14 }}
                      onMouseDown={(e) => handleBoundaryMouseDown(e, i)}
                      onMouseEnter={() => setHoveredBoundary(i)}
                      onMouseLeave={() => setHoveredBoundary(null)}
                    >
                      <div className={`h-full rounded-full transition-colors duration-75 ${
                        dragIndex === i ? "w-[2.5px] bg-primary" : hoveredBoundary === i ? "w-[2px] bg-primary/50" : "w-px bg-border/40"
                      }`} />
                      <div className={`absolute -bottom-3.5 text-[6px] font-medium tracking-wide whitespace-nowrap transition-colors duration-75 ${
                        dragIndex === i || hoveredBoundary === i ? "text-primary/70" : "text-muted-foreground/30"
                      }`}>
                        {displayFragments[i].fragment_id}↔{displayFragments[i + 1].fragment_id}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center px-1.5 pb-1 pt-2.5">
            {displayFragments.map((f) => {
              const widthPct = (f.duration / totalDuration) * 100;
              return (
                <div key={f.fragment_id} className={`text-[6px] border-t ${f.excluded ? "text-muted-foreground/20 border-border/10" : "text-muted-foreground/35 border-border/20"}`} style={{ width: `${widthPct}%`, minWidth: 24 }}>
                  <span className="pl-0.5">F{f.start_frame}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BoundaryPrecisionOverlay;
