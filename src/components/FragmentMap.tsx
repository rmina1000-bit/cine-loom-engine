import React, { useState, useCallback } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { motion } from "framer-motion";

interface FragmentMapProps {
  fragments: Fragment[];
  onFragmentsChange: (frags: Fragment[]) => void;
  selectedFragmentId: string | null;
  expandedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  onFragmentDoubleClick: (f: Fragment) => void;
  onRemoveFragment: (f: Fragment) => void;
}

const FragmentMap: React.FC<FragmentMapProps> = ({
  fragments,
  onFragmentsChange,
  selectedFragmentId,
  expandedFragmentId,
  onFragmentClick,
  onFragmentDoubleClick,
  onRemoveFragment,
}) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  return (
    <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">Fragment Map</h3>
          <span className="text-[10px] text-muted-foreground">({fragments.length} fragments)</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Click to select · Double-click for Time Lens · Drag to reorder</span>
      </div>

      {/* Fragment grid - wrapping flow */}
      <div className="flex flex-wrap items-start content-start gap-0 px-2 py-2 min-h-[160px]">
        {fragments.map((f, index) => (
          <React.Fragment key={f.fragment_id}>
            {/* Drop indicator before */}
            {dragOverIndex === index && draggedId !== f.fragment_id && (
              <div className="w-0.5 h-[72px] bg-primary rounded-full mx-0.5 flex-shrink-0 self-stretch" />
            )}
            <div
              draggable
              onDragStart={(e) => handleDragStart(e, f.fragment_id)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className="flex items-stretch"
              style={{ opacity: draggedId === f.fragment_id ? 0.4 : 1 }}
            >
              <div onDoubleClick={() => onFragmentDoubleClick(f)}>
                <FragmentTile
                  fragment={f}
                  isSelected={selectedFragmentId === f.fragment_id}
                  isHighlighted={false}
                  isExpanded={expandedFragmentId === f.fragment_id}
                  onClick={() => onFragmentClick(f)}
                  widthScale={0.7}
                  variant="edit"
                />
              </div>
              {/* Boundary handle */}
              {index < fragments.length - 1 && (
                <div className="boundary-handle self-stretch" title="Drag to redistribute" />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default FragmentMap;
