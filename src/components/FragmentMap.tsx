import React, { useState, useCallback, useMemo } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { EyeOff } from "lucide-react";
import {
  SyntheticCollapsedSeam,
  detectSyntheticSeams,
} from "@/types/boundaryTypes";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  onBoundaryClick?: (leftRealIndex: number, rightRealIndex: number) => void;
}

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
  onBoundaryClick,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [hoveredBoundary, setHoveredBoundary] = useState<string | null>(null);
  const [hoveredSeamKey, setHoveredSeamKey] = useState<string | null>(null);

  // Detect synthetic collapsed seams
  const syntheticSeams = useMemo(() => detectSyntheticSeams(fragments), [fragments]);

  const seamAfterVisible = useMemo(() => {
    const map = new Map<string, SyntheticCollapsedSeam>();
    for (const seam of syntheticSeams) {
      map.set(seam.leftVisibleFragmentId, seam);
    }
    return map;
  }, [syntheticSeams]);

  const visibleFragments = useMemo(() =>
    fragments
      .map((f, i) => ({ fragment: f, realIndex: i }))
      .filter(({ fragment }) => !fragment.excluded),
    [fragments]
  );

  // Reorder drag handlers
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

  // Boundary click → open Precision Boundary Editor
  const handleBoundaryClick = useCallback((e: React.MouseEvent, leftRealIdx: number, rightRealIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    onBoundaryClick?.(leftRealIdx, rightRealIdx);
  }, [onBoundaryClick]);

  // Seam click → open Precision Boundary Editor for the seam pair
  const handleSeamClick = useCallback((e: React.MouseEvent, seam: SyntheticCollapsedSeam) => {
    e.preventDefault();
    e.stopPropagation();
    onBoundaryClick?.(seam.leftRealIndex, seam.rightRealIndex);
  }, [onBoundaryClick]);

  // Boundary ruler
  const boundaries: number[] = [];
  let runningFrame = 0;
  for (const f of fragments) {
    boundaries.push(runningFrame);
    runningFrame += f.duration;
  }
  boundaries.push(runningFrame);

  const activeCount = visibleFragments.length;
  const excludedCount = fragments.length - activeCount;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col bg-card/50 rounded-lg border border-border/20"
        onDragOver={(e) => {
          const data = e.dataTransfer.types.includes("application/ccut-trash-restore");
          if (data) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
        }}
        onDrop={(e) => {
          const data = e.dataTransfer.getData("application/ccut-trash-restore");
          if (!data) return;
          e.preventDefault();
          const frag = JSON.parse(data) as Fragment;
          onTrashRestore?.(frag);
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[11px] font-semibold text-foreground/80 uppercase tracking-widest">조각맵</h3>
            <span className="text-[9px] text-muted-foreground/40">
              {activeCount}{excludedCount > 0 ? ` · ${excludedCount}` : ""}
            </span>
          </div>
        </div>

        {/* Fragment board */}
        <div className="flex flex-wrap items-start content-start gap-0 px-2 py-1.5 min-h-[160px]">
          {visibleFragments.map(({ fragment: f, realIndex }, visIdx) => {
            const seam = seamAfterVisible.get(f.fragment_id);
            const seamKey = seam ? `${seam.leftVisibleFragmentId}-${seam.rightVisibleFragmentId}` : null;
            const nextVisible = visIdx < visibleFragments.length - 1 ? visibleFragments[visIdx + 1] : null;
            const isDirectlyAdjacent = nextVisible && nextVisible.realIndex === realIndex + 1;
            const boundaryKey = `${realIndex}-${nextVisible?.realIndex}`;

            return (
              <React.Fragment key={f.fragment_id}>
                {dragOverIndex === realIndex && draggedId !== f.fragment_id && (
                  <div className="w-0.5 h-[72px] bg-primary rounded-full mx-0.5 flex-shrink-0 self-stretch" />
                )}

                <div
                  draggable
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

                  {/* Exclude toggle */}
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

                  {/* Boundary / Seam — now click-to-open, NOT drag */}
                  {nextVisible && (
                    seam ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`synthetic-seam self-stretch flex-shrink-0 flex items-center justify-center cursor-pointer group relative ${
                              hoveredSeamKey === seamKey ? "synthetic-seam-hover" : ""
                            }`}
                            style={{ width: 10 }}
                            onMouseEnter={() => setHoveredSeamKey(seamKey)}
                            onMouseLeave={() => setHoveredSeamKey(null)}
                            onClick={(e) => handleSeamClick(e, seam)}
                          >
                            <div className="h-full flex flex-col items-center justify-center gap-[3px] transition-colors duration-75">
                              <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                              <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                              <div className={`w-[3px] h-[3px] rounded-full ${hoveredSeamKey === seamKey ? "bg-[hsl(var(--ccut-amber))]" : "bg-muted-foreground/25"}`} />
                            </div>
                            {hoveredSeamKey === seamKey && (
                              <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[7px] text-[hsl(var(--ccut-amber))] font-medium whitespace-nowrap bg-card/90 px-1 py-0.5 rounded border border-border/20">
                                {seam.hiddenExcludedFragmentIds.length} hidden
                              </div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[9px]">
                          경계 편집 열기
                        </TooltipContent>
                      </Tooltip>
                    ) : isDirectlyAdjacent ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`boundary-link self-stretch flex-shrink-0 cursor-pointer group ${
                              hoveredBoundary === boundaryKey ? "boundary-link-hover" : ""
                            }`}
                            style={{ width: 6 }}
                            onMouseEnter={() => setHoveredBoundary(boundaryKey)}
                            onMouseLeave={() => setHoveredBoundary(null)}
                            onClick={(e) => handleBoundaryClick(e, realIndex, nextVisible.realIndex)}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[9px]">
                          비례바 정밀편집 열기
                        </TooltipContent>
                      </Tooltip>
                    ) : null
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Boundary ruler */}
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
      </div>
    </TooltipProvider>
  );
};

export default FragmentMap;
