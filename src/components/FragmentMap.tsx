import React, { useState, useCallback, useRef, useEffect } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";

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
}

const MIN_FRAGMENT_DURATION = 15; // minimum frames a fragment can shrink to

const FragmentMap: React.FC<FragmentMapProps> = ({
  fragments,
  onFragmentsChange,
  selectedFragmentId,
  expandedFragmentId,
  onFragmentClick,
  onFragmentDoubleClick,
  onExcludeFragment,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Boundary drag state
  const [boundaryDragIndex, setBoundaryDragIndex] = useState<number | null>(null);
  const boundaryStartX = useRef(0);
  const boundaryOrigLeft = useRef(0);
  const boundaryOrigRight = useRef(0);

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

  // Boundary drag: redistribute duration between adjacent fragments
  const handleBoundaryMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setBoundaryDragIndex(index);
    boundaryStartX.current = e.clientX;
    boundaryOrigLeft.current = fragments[index].duration;
    boundaryOrigRight.current = fragments[index + 1].duration;
  }, [fragments]);

  useEffect(() => {
    if (boundaryDragIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - boundaryStartX.current;
      // Convert pixels to frames (approx 0.7px per frame based on widthScale)
      const deltaFrames = Math.round(deltaX / 0.7);

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
    };

    const handleMouseUp = () => setBoundaryDragIndex(null);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [boundaryDragIndex, fragments, onFragmentsChange]);

  // Compute continuous boundary positions for display
  const boundaries: number[] = [];
  let runningFrame = 0;
  for (const f of fragments) {
    boundaries.push(runningFrame);
    runningFrame += f.duration;
  }
  boundaries.push(runningFrame);

  return (
    <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">Edit Structure</h3>
          <span className="text-[10px] text-muted-foreground">({fragments.length} fragments)</span>
          <span className="text-[10px] text-muted-foreground/60">·</span>
          <span className="text-[10px] text-muted-foreground/60">
            {fragments.map(f => f.fragment_id).join(" → ")}
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
              draggable={boundaryDragIndex === null}
              onDragStart={(e) => handleDragStart(e, f.fragment_id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className="flex items-stretch"
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
              {/* Shared boundary handle - draggable to redistribute duration */}
              {index < fragments.length - 1 && (
                <div
                  className={`boundary-handle self-stretch ${boundaryDragIndex === index ? "boundary-handle-active" : ""}`}
                  title={`Boundary F${boundaries[index + 1]} · Drag to redistribute`}
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
              className="flex items-center justify-between h-full text-[7px] text-muted-foreground/40 border-t border-border/20"
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
    </div>
  );
};

export default FragmentMap;
