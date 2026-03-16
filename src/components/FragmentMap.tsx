import React, { useState, useCallback, useRef, useEffect } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import BoundaryPrecisionOverlay from "./BoundaryPrecisionOverlay";
import { EyeOff, Eye } from "lucide-react";

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
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Boundary drag state
  const [boundaryDragIndex, setBoundaryDragIndex] = useState<number | null>(null);
  const boundaryStartX = useRef(0);
  const boundaryOrigLeft = useRef(0);
  const boundaryOrigRight = useRef(0);

  // Precision overlay state
  const [precisionOverlay, setPrecisionOverlay] = useState<{
    chainIndices: number[];        // indices into fragments[] for the revealed chain
    activeBoundaryInChain: number; // which boundary within the chain was clicked
    anchorRect: DOMRect;
  } | null>(null);

  // Reorder drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, fragId: string) => {
    e.dataTransfer.setData("text/plain", fragId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(fragId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    setDraggedId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId) return;
    const fromIdx = fragments.findIndex((fr) => fr.fragment_id === sourceId);
    if (fromIdx === -1 || fromIdx === index) return;
    const newFrags = [...fragments];
    const [moved] = newFrags.splice(fromIdx, 1);
    newFrags.splice(index, 0, moved);
    onFragmentsChange(newFrags);
  }, [fragments, onFragmentsChange]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverIndex(null);
  }, []);

  // Check if a boundary at `index` (between fragments[index] and fragments[index+1])
  // involves any excluded fragments nearby. If so, return the chain of indices to reveal.
  const getExcludedChain = useCallback((boundaryIndex: number): number[] | null => {
    const left = fragments[boundaryIndex];
    const right = fragments[boundaryIndex + 1];
    if (!left || !right) return null;

    // If neither side is excluded and no excluded neighbors, no overlay needed
    const hasExcluded = left.excluded || right.excluded;
    if (!hasExcluded) {
      // Check if there's an excluded fragment just outside
      const farLeft = boundaryIndex > 0 ? fragments[boundaryIndex - 1] : null;
      const farRight = boundaryIndex + 2 < fragments.length ? fragments[boundaryIndex + 2] : null;
      if (!farLeft?.excluded && !farRight?.excluded) return null;
    }

    // Expand outward to collect the contiguous chain involving excluded fragments
    let startIdx = boundaryIndex;
    let endIdx = boundaryIndex + 1;

    // Expand left while excluded
    while (startIdx > 0 && fragments[startIdx].excluded) startIdx--;
    // Also include one more non-excluded for context if we moved
    if (startIdx > 0 && fragments[startIdx - 1] && !fragments[startIdx].excluded && fragments[startIdx + 1]?.excluded) {
      // already at a non-excluded, good
    }

    // Expand right while excluded
    while (endIdx < fragments.length - 1 && fragments[endIdx].excluded) endIdx++;

    // Ensure we have at least one non-excluded on each side for context
    if (startIdx > 0 && fragments[startIdx].excluded) startIdx--;
    if (endIdx < fragments.length - 1 && fragments[endIdx].excluded) endIdx++;

    const indices: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) indices.push(i);

    return indices.length > 2 ? indices : (hasExcluded ? indices : null);
  }, [fragments]);

  // Boundary handle click: check for precision overlay or direct drag
  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    const chain = getExcludedChain(index);
    if (chain && chain.length >= 2) {
      // Show precision overlay instead of direct drag
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const activeBoundaryInChain = chain.indexOf(index);
      setPrecisionOverlay({
        chainIndices: chain,
        activeBoundaryInChain,
        anchorRect: rect,
      });
      return;
    }

    // Normal boundary drag (no excluded fragments nearby)
    setBoundaryDragIndex(index);
    boundaryStartX.current = e.clientX;
    boundaryOrigLeft.current = fragments[index].duration;
    boundaryOrigRight.current = fragments[index + 1].duration;
    onBoundaryDragChange?.(fragments[index], fragments[index + 1]);
  }, [fragments, onBoundaryDragChange, getExcludedChain]);

  const rafId = useRef<number | null>(null);
  const pendingDelta = useRef<number>(0);

  useEffect(() => {
    if (boundaryDragIndex === null) return;

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
        const rightFrag = { ...newFrags[boundaryDragIndex! + 1] };

        leftFrag.duration = newLeftDur;
        leftFrag.end_frame = leftFrag.start_frame + newLeftDur;
        rightFrag.duration = newRightDur;
        rightFrag.start_frame = rightFrag.end_frame - newRightDur;

        newFrags[boundaryDragIndex!] = leftFrag;
        newFrags[boundaryDragIndex! + 1] = rightFrag;
        onFragmentsChange(newFrags);
      });
    };

    const handleMouseUp = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
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
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [boundaryDragIndex, fragments, onFragmentsChange]);

  // Precision overlay boundary drag handler
  const handleOverlayBoundaryDrag = useCallback((chainBoundaryIndex: number, deltaFrames: number) => {
    if (!precisionOverlay) return;
    const realIndex = precisionOverlay.chainIndices[chainBoundaryIndex];
    const realNextIndex = precisionOverlay.chainIndices[chainBoundaryIndex + 1];
    if (realIndex === undefined || realNextIndex === undefined) return;

    const left = fragments[realIndex];
    const right = fragments[realNextIndex];
    const newLeftDur = left.duration + deltaFrames;
    const newRightDur = right.duration - deltaFrames;
    if (newLeftDur < MIN_FRAGMENT_DURATION || newRightDur < MIN_FRAGMENT_DURATION) return;

    const newFrags = [...fragments];
    newFrags[realIndex] = { ...left, duration: newLeftDur, end_frame: left.start_frame + newLeftDur };
    newFrags[realNextIndex] = { ...right, duration: newRightDur, start_frame: right.end_frame - newRightDur };
    onFragmentsChange(newFrags);

    // Also trigger source recall
    onBoundaryDragChange?.(newFrags[realIndex], newFrags[realNextIndex]);
  }, [precisionOverlay, fragments, onFragmentsChange, onBoundaryDragChange]);

  const handleOverlayDragEnd = useCallback(() => {
    onBoundaryDragChange?.(null, null);
  }, [onBoundaryDragChange]);

  const handleOverlayClose = useCallback(() => {
    setPrecisionOverlay(null);
    onBoundaryDragChange?.(null, null);
  }, [onBoundaryDragChange]);

  // Compute continuous boundary positions for display
  const boundaries: number[] = [];
  let runningFrame = 0;
  for (const f of fragments) {
    boundaries.push(runningFrame);
    runningFrame += f.duration;
  }
  boundaries.push(runningFrame);

  const activeFragments = fragments.filter(f => !f.excluded);
  const excludedCount = fragments.length - activeFragments.length;

  // Get the chain fragments for the overlay
  const overlayChainFragments = precisionOverlay
    ? precisionOverlay.chainIndices.map(i => fragments[i])
    : [];

  return (
    <div className="flex flex-col bg-card/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">Edit Structure</h3>
          <span className="text-[10px] text-muted-foreground">
            ({activeFragments.length} active{excludedCount > 0 ? ` · ${excludedCount} excluded` : ""})
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">
          Drag boundaries to redistribute · Drag fragments to reorder
        </span>
      </div>

      {/* Fragment structure - wrapping flow with shared boundaries */}
      <div className="flex flex-wrap items-start content-start gap-0 px-2 py-2 min-h-[160px]">
        {fragments.map((f, index) => (
          <React.Fragment key={f.fragment_id}>
            {/* Drop indicator before */}
            {dragOverIndex === index && draggedId !== f.fragment_id && (
              <div className="w-0.5 h-[72px] bg-primary rounded-full mx-0.5 flex-shrink-0 self-stretch" />
            )}
            <div
              draggable={boundaryDragIndex === null && !f.excluded}
              onDragStart={(e) => handleDragStart(e, f.fragment_id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-stretch relative ${f.excluded ? "excluded-fragment" : ""}`}
              style={{ opacity: draggedId === f.fragment_id ? 0.4 : f.excluded ? 0.35 : 1 }}
            >
              <div>
                <FragmentTile
                  fragment={f}
                  isSelected={selectedFragmentId === f.fragment_id}
                  isHighlighted={false}
                  isExpanded={expandedFragmentId === f.fragment_id}
                  hasActiveSelection={!!selectedFragmentId}
                  onClick={() => f.excluded ? onRestoreFragment(f) : onFragmentClick(f)}
                  onDoubleClick={() => !f.excluded && onFragmentDoubleClick(f)}
                  widthScale={0.7}
                  variant="edit"
                />
              </div>
              {/* Excluded overlay indicator */}
              {f.excluded && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="bg-background/70 rounded px-1.5 py-0.5 text-[8px] text-muted-foreground font-medium tracking-wide uppercase">
                    excluded
                  </div>
                </div>
              )}
              {/* Exclude/Restore toggle button on selected fragment */}
              {selectedFragmentId === f.fragment_id && (
                <button
                  className="fragment-tile absolute top-1 right-1 z-30 p-1 rounded-full bg-card border border-border/50 hover:bg-destructive/20 hover:border-destructive/40 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
                  title={f.excluded ? "Restore to render" : "Exclude from render"}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    f.excluded ? onRestoreFragment(f) : onExcludeFragment(f);
                  }}
                >
                  {f.excluded ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
              )}
              {/* Shared boundary handle */}
              {index < fragments.length - 1 && (
                <div
                  className={`boundary-handle self-stretch ${boundaryDragIndex === index ? "boundary-handle-active" : ""} ${
                    // Visual hint: if excluded fragment is adjacent, show subtle indicator
                    (f.excluded || fragments[index + 1]?.excluded) ? "boundary-handle-precision" : ""
                  }`}
                  title={
                    (f.excluded || fragments[index + 1]?.excluded)
                      ? `Boundary F${boundaries[index + 1]} · Click for precision mode`
                      : `Boundary F${boundaries[index + 1]} · Drag to redistribute`
                  }
                  onMouseDown={(e) => handleBoundaryMouseDown(e, index)}
                />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Boundary ruler */}
      <div className="px-2 pb-1.5">
        <div className="flex items-center h-3">
          {fragments.map((f, i) => (
            <div
              key={f.fragment_id}
              className={`flex items-center justify-between h-full text-[7px] border-t ${
                f.excluded
                  ? "text-muted-foreground/20 border-border/10"
                  : "text-muted-foreground/40 border-border/20"
              }`}
              style={{ width: Math.max(48, f.duration * 0.7) }}
            >
              <span className="pl-0.5">F{boundaries[i]}</span>
              {i === fragments.length - 1 && (
                <span className="pr-0.5">F{boundaries[i + 1]}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Precision overlay for excluded-boundary disambiguation */}
      {precisionOverlay && (
        <BoundaryPrecisionOverlay
          fragments={overlayChainFragments}
          activeBoundaryIndex={precisionOverlay.activeBoundaryInChain}
          anchorRect={precisionOverlay.anchorRect}
          onBoundaryDrag={handleOverlayBoundaryDrag}
          onDragEnd={handleOverlayDragEnd}
          onClose={handleOverlayClose}
        />
      )}
    </div>
  );
};

export default FragmentMap;
