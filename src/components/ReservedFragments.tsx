import React, { useState, useRef, useCallback } from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { Trash2 } from "lucide-react";

interface Position {
  x: number;
  y: number;
}

interface ReservedFragmentsProps {
  fragments: Fragment[];
  selectedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  onRestoreFragment: (f: Fragment) => void;
}

const ReservedFragments: React.FC<ReservedFragmentsProps> = ({
  fragments,
  selectedFragmentId,
  onFragmentClick,
  onRestoreFragment,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });

  const getPosition = (fragId: string, index: number): Position => {
    if (positions[fragId]) return positions[fragId];
    return { x: 12 + (index % 5) * 80, y: 8 + Math.floor(index / 5) * 68 };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, fragId: string) => {
    e.preventDefault();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const pos = positions[fragId] || getPosition(fragId, fragments.findIndex(f => f.fragment_id === fragId));
    dragOffset.current = {
      x: e.clientX - boardRect.left - pos.x,
      y: e.clientY - boardRect.top - pos.y,
    };
    setDragging(fragId);
  }, [positions, fragments]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - boardRect.left - dragOffset.current.x;
    const y = e.clientY - boardRect.top - dragOffset.current.y;
    setPositions(prev => ({ ...prev, [dragging]: { x, y } }));
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">보류맵</h3>
          <span className="text-[10px] text-muted-foreground">({fragments.length})</span>
        </div>
      </div>

      {/* Freeform board */}
      <div
        ref={boardRef}
        className="relative min-h-[120px] select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "default" }}
      >
        {fragments.map((f, index) => {
          const pos = getPosition(f.fragment_id, index);
          return (
            <div
              key={f.fragment_id}
              className="absolute"
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: dragging === f.fragment_id ? 50 : selectedFragmentId === f.fragment_id ? 20 : 1,
                cursor: dragging === f.fragment_id ? "grabbing" : "grab",
                transition: dragging === f.fragment_id ? "none" : undefined,
              }}
              onMouseDown={(e) => handleMouseDown(e, f.fragment_id)}
            >
              <FragmentTile
                fragment={f}
                isSelected={selectedFragmentId === f.fragment_id}
                isHighlighted={false}
                hasActiveSelection={!!selectedFragmentId}
                onClick={() => onFragmentClick(f)}
                widthScale={0.5}
                variant="reserved"
              />
            </div>
          );
        })}
        {fragments.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-3 py-4">
            보류된 조각이 여기에 표시됩니다.
          </p>
        )}

        {/* Trash icon — bare, no background */}
        <Trash2
          size={16}
          className="absolute bottom-2 right-2 text-muted-foreground/40 z-40"
          strokeWidth={1.5}
        />
      </div>
    </div>
  );
};

export default ReservedFragments;
