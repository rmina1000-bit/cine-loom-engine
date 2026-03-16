import React, { useCallback, useRef, useEffect, useState } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { motion, AnimatePresence } from "framer-motion";
import { SyntheticCollapsedSeam } from "@/types/boundaryTypes";

interface BoundaryPrecisionOverlayProps {
  seam: SyntheticCollapsedSeam;
  /** All fragments in the chain (left visible + excluded... + right visible) */
  chainFragments: Fragment[];
  /** The full fragments array indices corresponding to chainFragments */
  chainRealIndices: number[];
  anchorRect: DOMRect;
  onBoundaryDrag: (leftRealIndex: number, rightRealIndex: number, deltaFrames: number) => void;
  onDragEnd: () => void;
  onClose: () => void;
}

const MIN_DURATION = 15;

const BoundaryPrecisionOverlay: React.FC<BoundaryPrecisionOverlayProps> = ({
  seam,
  chainFragments,
  chainRealIndices,
  anchorRect,
  onBoundaryDrag,
  onDragEnd,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const dragOrigLeft = useRef(0);
  const dragOrigRight = useRef(0);
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
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, chainIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIndex(chainIdx);
    dragStartX.current = e.clientX;
    dragOrigLeft.current = chainFragments[chainIdx].duration;
    dragOrigRight.current = chainFragments[chainIdx + 1].duration;
    pendingDelta.current = 0;
  }, [chainFragments]);

  useEffect(() => {
    if (dragIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      pendingDelta.current = e.clientX - dragStartX.current;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        // Shift-key: 5x precision, normal: 1 frame per ~1.2px
        const multiplier = 1;
        const deltaFrames = Math.round((pendingDelta.current / 1.2) * multiplier);
        const newLeft = dragOrigLeft.current + deltaFrames;
        const newRight = dragOrigRight.current - deltaFrames;
        if (newLeft < MIN_DURATION || newRight < MIN_DURATION) return;
        onBoundaryDrag(chainRealIndices[dragIndex!], chainRealIndices[dragIndex! + 1], deltaFrames);
      });
    };

    const handleMouseUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setDragIndex(null);
      onDragEnd();
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
  }, [dragIndex, chainFragments, chainRealIndices, onBoundaryDrag, onDragEnd]);

  if (chainFragments.length === 0) return null;

  const totalDuration = chainFragments.reduce((s, f) => s + f.duration, 0);
  const overlayWidth = Math.min(520, Math.max(240, totalDuration * 0.8));

  // Position: centered on anchor, above it
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
        {/* Label */}
        <div className="text-[8px] text-muted-foreground/50 mb-0.5 tracking-widest font-medium px-1 uppercase">
          Precision
        </div>

        {/* Overlay card */}
        <div
          className="rounded-md border border-border/30 bg-card/96 backdrop-blur-sm"
          style={{
            boxShadow: "0 6px 24px -6px hsl(var(--background) / 0.6), 0 1px 4px -1px hsl(var(--primary) / 0.06)",
            width: overlayWidth,
          }}
        >
          {/* Fragment chain strip */}
          <div className="flex items-stretch p-1.5 gap-0">
            {chainFragments.map((f, i) => {
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const widthPct = (f.duration / totalDuration) * 100;

              return (
                <React.Fragment key={f.fragment_id}>
                  {/* Fragment cell */}
                  <div
                    className={`relative rounded-sm overflow-hidden flex-shrink-0 ${
                      f.excluded ? "opacity-35" : ""
                    }`}
                    style={{ width: `${widthPct}%`, minWidth: 32, height: 44 }}
                  >
                    <img
                      src={thumbUrl}
                      alt={f.fragment_id}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

                    {/* Labels */}
                    <div className="relative z-10 flex flex-col justify-between h-full p-1">
                      <div className="flex items-center gap-0.5">
                        <span className="text-[8px] font-semibold text-foreground/85 leading-none">
                          {f.fragment_id}
                        </span>
                        {f.excluded && (
                          <span className="text-[6px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                            excl
                          </span>
                        )}
                      </div>
                      <span className="text-[7px] text-foreground/45 leading-none">
                        {formatDuration(f.duration)}
                      </span>
                    </div>

                    {/* Excluded stripe pattern */}
                    {f.excluded && (
                      <div
                        className="absolute inset-0 pointer-events-none z-20"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            -45deg,
                            transparent,
                            transparent 2px,
                            hsl(var(--background) / 0.12) 2px,
                            hsl(var(--background) / 0.12) 3px
                          )`,
                        }}
                      />
                    )}
                  </div>

                  {/* Internal boundary handle */}
                  {i < chainFragments.length - 1 && (
                    <div
                      className="flex-shrink-0 cursor-col-resize flex items-center justify-center group relative"
                      style={{ width: 14 }}
                      onMouseDown={(e) => handleBoundaryMouseDown(e, i)}
                      onMouseEnter={() => setHoveredBoundary(i)}
                      onMouseLeave={() => setHoveredBoundary(null)}
                    >
                      {/* Visible line */}
                      <div
                        className={`h-full rounded-full transition-colors duration-75 ${
                          dragIndex === i
                            ? "w-[2.5px] bg-primary"
                            : hoveredBoundary === i
                            ? "w-[2px] bg-primary/50"
                            : "w-px bg-border/40"
                        }`}
                      />
                      {/* Label below */}
                      <div className={`absolute -bottom-3.5 text-[6px] font-medium tracking-wide whitespace-nowrap transition-colors duration-75 ${
                        dragIndex === i || hoveredBoundary === i
                          ? "text-primary/70"
                          : "text-muted-foreground/30"
                      }`}>
                        {chainFragments[i].fragment_id}↔{chainFragments[i + 1].fragment_id}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Thin frame ruler */}
          <div className="flex items-center px-1.5 pb-1 pt-2.5">
            {chainFragments.map((f, i) => {
              const widthPct = (f.duration / totalDuration) * 100;
              return (
                <div
                  key={f.fragment_id}
                  className={`text-[6px] border-t ${
                    f.excluded
                      ? "text-muted-foreground/20 border-border/10"
                      : "text-muted-foreground/35 border-border/20"
                  }`}
                  style={{ width: `${widthPct}%`, minWidth: 24 }}
                >
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
