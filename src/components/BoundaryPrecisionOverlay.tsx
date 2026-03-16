import React, { useCallback, useRef, useEffect, useState } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { motion, AnimatePresence } from "framer-motion";

interface BoundaryPrecisionOverlayProps {
  fragments: Fragment[];           // the contiguous chain to reveal
  activeBoundaryIndex: number;     // which boundary within the chain is active (0-based between fragments)
  anchorRect: DOMRect | null;      // position anchor from the clicked boundary handle
  onBoundaryDrag: (chainIndex: number, deltaFrames: number) => void;
  onDragEnd: () => void;
  onClose: () => void;
}

const MIN_DURATION = 15;

const BoundaryPrecisionOverlay: React.FC<BoundaryPrecisionOverlayProps> = ({
  fragments,
  activeBoundaryIndex,
  anchorRect,
  onBoundaryDrag,
  onDragEnd,
  onClose,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragStartX = useRef(0);
  const dragOrigLeft = useRef(0);
  const dragOrigRight = useRef(0);
  const rafId = useRef<number | null>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the opening click triggering close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragIndex(index);
    dragStartX.current = e.clientX;
    dragOrigLeft.current = fragments[index].duration;
    dragOrigRight.current = fragments[index + 1].duration;
  }, [fragments]);

  useEffect(() => {
    if (dragIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rawDelta = e.clientX - dragStartX.current;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const deltaFrames = Math.round(rawDelta / 1.2);
        const newLeft = dragOrigLeft.current + deltaFrames;
        const newRight = dragOrigRight.current - deltaFrames;
        if (newLeft < MIN_DURATION || newRight < MIN_DURATION) return;
        onBoundaryDrag(dragIndex!, deltaFrames);
      });
    };

    const handleMouseUp = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
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
  }, [dragIndex, fragments, onBoundaryDrag, onDragEnd]);

  if (!anchorRect || fragments.length === 0) return null;

  const totalDuration = fragments.reduce((s, f) => s + f.duration, 0);
  const overlayWidth = Math.min(480, Math.max(280, totalDuration * 0.9));

  // Center overlay horizontally on the anchor
  const left = anchorRect.left + anchorRect.width / 2 - overlayWidth / 2;
  const top = anchorRect.top - 80;

  const sourceColors: Record<string, string> = {
    A: "30", B: "200", C: "120", D: "0", E: "280", F: "50", G: "320",
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0, y: 6, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}
        className="fixed z-[100]"
        style={{ left: Math.max(8, left), top: Math.max(8, top) }}
      >
        {/* Subtle backdrop label */}
        <div className="text-[9px] text-muted-foreground/60 mb-1 tracking-wide font-medium px-1">
          BOUNDARY PRECISION
        </div>

        {/* Main overlay card */}
        <div
          className="rounded-lg border border-border/40 bg-card/95 backdrop-blur-sm"
          style={{
            boxShadow: "0 8px 32px -8px hsl(var(--background) / 0.7), 0 2px 8px -2px hsl(var(--primary) / 0.08)",
            width: overlayWidth,
          }}
        >
          {/* Fragment chain */}
          <div className="flex items-stretch p-2 gap-0">
            {fragments.map((f, i) => {
              const hue = Number(sourceColors[f.source_video] ?? f.thumbnail_hue);
              const thumbUrl = getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url);
              const widthPct = (f.duration / totalDuration) * 100;

              return (
                <React.Fragment key={f.fragment_id}>
                  <div
                    className={`relative rounded-sm overflow-hidden flex-shrink-0 ${
                      f.excluded ? "opacity-40" : ""
                    }`}
                    style={{
                      width: `${widthPct}%`,
                      minWidth: 36,
                      height: 52,
                    }}
                  >
                    {/* Thumbnail */}
                    <img
                      src={thumbUrl}
                      alt={f.fragment_id}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

                    {/* Labels */}
                    <div className="relative z-10 flex flex-col justify-between h-full p-1">
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-semibold text-foreground/90 leading-none">
                          {f.fragment_id}
                        </span>
                        {f.excluded && (
                          <span className="text-[7px] text-muted-foreground/70 uppercase tracking-wider font-medium">
                            excl
                          </span>
                        )}
                      </div>
                      <span className="text-[8px] text-foreground/50 leading-none">
                        {formatDuration(f.duration)}
                      </span>
                    </div>

                    {/* Excluded pattern overlay */}
                    {f.excluded && (
                      <div className="absolute inset-0 pointer-events-none z-20"
                        style={{
                          backgroundImage: `repeating-linear-gradient(
                            -45deg,
                            transparent,
                            transparent 3px,
                            hsl(var(--background) / 0.15) 3px,
                            hsl(var(--background) / 0.15) 4px
                          )`,
                        }}
                      />
                    )}
                  </div>

                  {/* Boundary handle between fragments */}
                  {i < fragments.length - 1 && (
                    <div
                      className={`flex-shrink-0 cursor-col-resize flex items-center justify-center group relative ${
                        dragIndex === i ? "" : ""
                      }`}
                      style={{ width: 12 }}
                      onMouseDown={(e) => handleBoundaryMouseDown(e, i)}
                    >
                      {/* The actual line */}
                      <div
                        className={`h-full transition-all duration-100 rounded-full ${
                          dragIndex === i
                            ? "w-[3px] bg-primary"
                            : i === activeBoundaryIndex
                            ? "w-[2px] bg-primary/60"
                            : "w-[1px] bg-border/50 group-hover:bg-primary/40 group-hover:w-[2px]"
                        }`}
                      />
                      {/* Boundary label */}
                      <div className={`absolute -bottom-4 text-[7px] font-medium tracking-wide whitespace-nowrap ${
                        i === activeBoundaryIndex || dragIndex === i
                          ? "text-primary/80"
                          : "text-muted-foreground/40"
                      }`}>
                        {fragments[i].fragment_id}↔{fragments[i + 1].fragment_id}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Frame ruler */}
          <div className="flex items-center px-2 pb-1.5 pt-3">
            {fragments.map((f, i) => {
              const widthPct = (f.duration / totalDuration) * 100;
              let runningFrame = 0;
              for (let j = 0; j < i; j++) runningFrame += fragments[j].duration;
              return (
                <div
                  key={f.fragment_id}
                  className={`text-[7px] border-t ${
                    f.excluded
                      ? "text-muted-foreground/25 border-border/15"
                      : "text-muted-foreground/45 border-border/25"
                  }`}
                  style={{ width: `${widthPct}%`, minWidth: 28 }}
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
