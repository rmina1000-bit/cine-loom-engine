import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import BoundaryPrecisionOverlay from "./BoundaryPrecisionOverlay";
import { EyeOff, Eye } from "lucide-react";
import {
  SyntheticCollapsedSeam,
  PrecisionOverlayState,
  detectSyntheticSeams,
} from "@/types/boundaryTypes";

interface FragmentMapProps {
  fragments: Fragment[];
  onFragmentsChange: (frags: Fragment[]) => void;
  selectedFragmentId: string | null;
  expandedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  onFragmentDoubleClick: (f: Fragment) => void;
  onExcludeFragment: (f: Fragment) => void;
  onRestoreFragment: (f: Fragment) => void;
  onMoveToHold: (f: Fragment) => void;
  onBoundaryDragChange?: (leftFrag: Fragment | null, rightFrag: Fragment | null) => void;
  onTrashRestore?: (f: Fragment) => void;
}

const MIN_FRAGMENT_DURATION = 15;

const FragmentMap: React.FC<FragmentMapProps> = ({
  fragments,
  onFragmentsChange,
  selectedFragmentId,
  expandedFragmentId,
  onFragmentClick,
  onFragmentDoubleClick,
  onExcludeFragment,
  onRestoreFragment,
  onMoveToHold,
  onBoundaryDragChange,
  onTrashRestore,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Boundary drag state (for normal non-seam boundaries)
  const [boundaryDragIndex, setBoundaryDragIndex] = useState<number | null>(null);
  const boundaryStartX = useRef(0);
  const boundaryOrigLeft = useRef(0);
  const boundaryOrigRight = useRef(0);

  // Precision overlay state
  const [precisionOverlay, setPrecisionOverlay] = useState<PrecisionOverlayState | null>(null);

  // Synthetic seam hover state
  const [hoveredSeamKey, setHoveredSeamKey] = useState<string | null>(null);

  // Detect synthetic collapsed seams
  const syntheticSeams = useMemo(() => detectSyntheticSeams(fragments), [fragments]);

  // Build a map: for each visible fragment, find if a seam exists to its right
  const seamAfterVisible = useMemo(() => {
    const map = new Map<string, SyntheticCollapsedSeam>();
    for (const seam of syntheticSeams) {
      map.set(seam.leftVisibleFragmentId, seam);
    }
    return map;
  }, [syntheticSeams]);

  // Visible fragments (non-excluded) for board rendering
  const visibleFragments = useMemo(() =>
    fragments
      .map((f, i) => ({ fragment: f, realIndex: i }))
      .filter(({ fragment }) => !fragment.excluded),
    [fragments]
  );

  // Reorder drag handlers (operate on full fragment array)
  const handleDragStart = useCallback((e: React.DragEvent, fragId: string) => {
    e.dataTransfer.setData("text/plain", fragId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(fragId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, realIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(realIndex);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetRealIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggedId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId) return;
    const fromIdx = fragments.findIndex((fr) => fr.fragment_id === sourceId);
    if (fromIdx === -1 || fromIdx === targetRealIndex) return;
    const newFrags = [...fragments];
    const [moved] = newFrags.splice(fromIdx, 1);
    newFrags.splice(targetRealIndex, 0, moved);
    onFragmentsChange(newFrags);
  }, [fragments, onFragmentsChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverIndex(null);
  }, []);

  // Normal boundary drag (between two adjacent visible non-excluded fragments, no seam)
  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, leftRealIdx: number, rightRealIdx: number) => {
    e.preventDefault();
    e.stopPropagation();

    setBoundaryDragIndex(leftRealIdx);
    boundaryStartX.current = e.clientX;
    boundaryOrigLeft.current = fragments[leftRealIdx].duration;
    boundaryOrigRight.current = fragments[rightRealIdx].duration;
    onBoundaryDragChange?.(fragments[leftRealIdx], fragments[rightRealIdx]);
  }, [fragments, onBoundaryDragChange]);

  // Synthetic seam click → open precision overlay
  const handleSeamClick = useCallback((e: React.MouseEvent, seam: SyntheticCollapsedSeam) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const chainIndices: number[] = [];
    for (let i = seam.leftRealIndex; i <= seam.rightRealIndex; i++) {
      chainIndices.push(i);
    }
    setPrecisionOverlay({ seam, chainRealIndices: chainIndices, anchorRect: rect });
  }, []);

  // RAF-throttled boundary drag
  const rafId = useRef<number | null>(null);
  const pendingDelta = useRef<number>(0);

  useEffect(() => {
    if (boundaryDragIndex === null) return;

    // Find the right fragment index (next non-excluded after boundaryDragIndex)
    let rightIdx = boundaryDragIndex + 1;
    // In normal drag mode, we're dragging between two directly adjacent visible fragments
    // so rightIdx should be the fragment right after

    const handleMouseMove = (e: MouseEvent) => {
      pendingDelta.current = e.clientX - boundaryStartX.current;
      if (rafId.current !== null) return;
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const deltaFrames = Math.round(pendingDelta.current / 0.7);
        const newLeftDur = boundaryOrigLeft.current + deltaFrames;
        const newRightDur = boundaryOrigRight.current - deltaFrames;
        if (newLeftDur < MIN_FRAGMENT_DURATION || newRightDur < MIN_FRAGMENT_DURATION) return;

        const newFrags = [...fragments];
        const leftFrag = { ...newFrags[boundaryDragIndex!] };
        const rightFrag = { ...newFrags[rightIdx] };

        leftFrag.duration = newLeftDur;
        leftFrag.end_frame = leftFrag.start_frame + newLeftDur;
        rightFrag.duration = newRightDur;
        rightFrag.start_frame = rightFrag.end_frame - newRightDur;

        newFrags[boundaryDragIndex!] = leftFrag;
        newFrags[rightIdx] = rightFrag;
        onFragmentsChange(newFrags);
      });
    };

    const handleMouseUp = () => {
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
      setBoundaryDragIndex(null);
      onBoundaryDragChange?.(null, null);
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
      if (rafId.current !== null) { cancelAnimationFrame(rafId.current); rafId.current = null; }
    };
  }, [boundaryDragIndex, fragments, onFragmentsChange, onBoundaryDragChange]);

  // Precision overlay: commit on mouseUp only (board stays stable during drag)
  const handleOverlayCommit = useCallback((leftRealIdx: number, rightRealIdx: number, deltaFrames: number) => {
    const left = fragments[leftRealIdx];
    const right = fragments[rightRealIdx];
    if (!left || !right) return;

    const newLeftDur = left.duration + deltaFrames;
    const newRightDur = right.duration - deltaFrames;
    if (newLeftDur < MIN_FRAGMENT_DURATION || newRightDur < MIN_FRAGMENT_DURATION) return;

    const newFrags = [...fragments];
    newFrags[leftRealIdx] = { ...left, duration: newLeftDur, end_frame: left.start_frame + newLeftDur };
    newFrags[rightRealIdx] = { ...right, duration: newRightDur, start_frame: right.end_frame - newRightDur };
    onFragmentsChange(newFrags);
  }, [fragments, onFragmentsChange]);

  // Source recall during overlay drag (lightweight, no board mutation)
  const handleOverlaySourceRecall = useCallback((leftFrag: Fragment | null, rightFrag: Fragment | null) => {
    onBoundaryDragChange?.(leftFrag, rightFrag);
  }, [onBoundaryDragChange]);

  const handleOverlayClose = useCallback(() => {
    setPrecisionOverlay(null);
    onBoundaryDragChange?.(null, null);
  }, [onBoundaryDragChange]);

  // Compute boundary positions for ruler
  const boundaries: number[] = [];
  let runningFrame = 0;
  for (const f of fragments) {
    boundaries.push(runningFrame);
    runningFrame += f.duration;
  }
  boundaries.push(runningFrame);

  const activeCount = visibleFragments.length;
  const excludedCount = fragments.length - activeCount;

  // Chain fragments for overlay
  const overlayChainFragments = precisionOverlay
    ? precisionOverlay.chainRealIndices.map(i => fragments[i])
    : [];

  return (
    <div className="flex flex-col bg-card/30 rounded-lg border border-border/10"
      onDragOver={(e) => {
        const data = e.dataTransfer.types.includes("application/ccut-trash-restore");
        if (data) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
      }}
      onDrop={(e) => {
        const data = e.dataTransfer.getData("application/ccut-trash-restore");
        if (!data) return;
        e.preventDefault();
        // Trash restore is handled by parent via onFragmentsChange — we need to bubble up
        // Actually handled in Index.tsx via the dedicated handler
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-[10px] font-medium text-foreground/50 uppercase tracking-widest">조각맵</h3>
          <span className="text-[9px] text-muted-foreground/35">
            {activeCount}{excludedCount > 0 ? ` · ${excludedCount}` : ""}
          </span>
        </div>
      </div>

      {/* Fragment board */}
      <div className="flex flex-wrap items-start content-start gap-0 px-2 py-1.5 min-h-[160px]">
        {visibleFragments.map(({ fragment: f, realIndex }, visIdx) => {
          const seam = seamAfterVisible.get(f.fragment_id);
          const seamKey = seam ? `${seam.leftVisibleFragmentId}-${seam.rightVisibleFragmentId}` : null;

          // Next visible fragment (for normal boundary)
          const nextVisible = visIdx < visibleFragments.length - 1 ? visibleFragments[visIdx + 1] : null;
          // Is the next visible fragment directly adjacent (no excluded in between)?
          const isDirectlyAdjacent = nextVisible && nextVisible.realIndex === realIndex + 1;

          return (
            <React.Fragment key={f.fragment_id}>
              {/* Drop indicator */}
              {dragOverIndex === realIndex && draggedId !== f.fragment_id && (
                <div className="w-0.5 h-[72px] bg-primary rounded-full mx-0.5 flex-shrink-0 self-stretch" />
              )}

              <div
                draggable={boundaryDragIndex === null}
                onDragStart={(e) => handleDragStart(e, f.fragment_id)}
                onDragOver={(e) => handleDragOver(e, realIndex)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, realIndex)}
                onDragEnd={handleDragEnd}
                className="flex items-stretch relative"
                style={{ opacity: draggedId === f.fragment_id ? 0.4 : 1 }}
              >
                <div>
                  <FragmentTile
                    fragment={f}
                    isSelected={selectedFragmentId === f.fragment_id}
                    isHighlighted={false}
                    isExpanded={expandedFragmentId === f.fragment_id}
                    hasActiveSelection={!!selectedFragmentId}
                    onClick={() => onFragmentClick(f)}
                    onDoubleClick={() => onFragmentDoubleClick(f)}
                    widthScale={0.7}
                    variant="edit"
                  />
                </div>

                {/* Exclude/Restore toggle on selected */}
                {selectedFragmentId === f.fragment_id && (
                  <button
                    className="fragment-tile absolute top-1 right-1 z-30 p-1 rounded-full bg-card border border-border/50 hover:bg-destructive/20 hover:border-destructive/40 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                    title="Exclude from render"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onExcludeFragment(f);
                    }}
                  >
                    <EyeOff size={12} />
                  </button>
                )}

                {/* After this fragment: either a normal boundary or a synthetic seam */}
                {nextVisible && (
                  seam ? (
                    // Synthetic collapsed seam indicator
                    <div
                      className={`synthetic-seam self-stretch flex-shrink-0 flex items-center justify-center cursor-pointer group relative ${
                        hoveredSeamKey === seamKey ? "synthetic-seam-hover" : ""
                      }`}
                      style={{ width: 10 }}
                      title={`${seam.hiddenExcludedFragmentIds.length} excluded fragment${seam.hiddenExcludedFragmentIds.length > 1 ? "s" : ""} · Click for precision`}
                      onMouseEnter={() => setHoveredSeamKey(seamKey)}
                      onMouseLeave={() => setHoveredSeamKey(null)}
                      onClick={(e) => handleSeamClick(e, seam)}
                    >
                      {/* Seam visual: dotted line indicating hidden structure */}
                      <div className={`h-full flex flex-col items-center justify-center gap-[3px] transition-colors duration-75`}>
                        <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                        <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                        <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                      </div>
                      {/* Hover tooltip count */}
                      {hoveredSeamKey === seamKey && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[7px] text-[hsl(var(--ccut-amber))] font-medium whitespace-nowrap bg-card/90 px-1 py-0.5 rounded border border-border/20">
                          {seam.hiddenExcludedFragmentIds.length} hidden
                        </div>
                      )}
                    </div>
                  ) : isDirectlyAdjacent ? (
                    // Normal boundary handle (directly adjacent, no excluded between)
                    <div
                      className={`boundary-handle self-stretch ${boundaryDragIndex === realIndex ? "boundary-handle-active" : ""}`}
                      title={`Boundary F${boundaries[realIndex + 1]} · Drag to redistribute`}
                      onMouseDown={(e) => handleBoundaryMouseDown(e, realIndex, nextVisible.realIndex)}
                    />
                  ) : null
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Boundary ruler (visible fragments only) */}
      <div className="px-2 pb-1.5">
        <div className="flex items-center h-3">
          {visibleFragments.map(({ fragment: f, realIndex }, i) => (
            <div
              key={f.fragment_id}
              className="flex items-center justify-between h-full text-[7px] text-muted-foreground/40 border-t border-border/20"
              style={{ width: Math.max(48, f.duration * 0.7) }}
            >
              <span className="pl-0.5">F{boundaries[realIndex]}</span>
              {i === visibleFragments.length - 1 && (
                <span className="pr-0.5">F{boundaries[realIndex + 1]}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Precision overlay */}
      {precisionOverlay && (
        <BoundaryPrecisionOverlay
          seam={precisionOverlay.seam}
          chainFragments={overlayChainFragments}
          chainRealIndices={precisionOverlay.chainRealIndices}
          anchorRect={precisionOverlay.anchorRect}
          onBoundaryCommit={handleOverlayCommit}
          onSourceRecall={handleOverlaySourceRecall}
          onClose={handleOverlayClose}
        />
      )}
    </div>
  );
};

export default FragmentMap;
