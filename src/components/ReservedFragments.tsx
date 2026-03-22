import React, { useState, useRef, useCallback } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import FragmentTile from "./FragmentTile";
import { Trash2, RotateCcw, X, Eraser } from "lucide-react";

interface Position {
  x: number;
  y: number;
}

interface ReservedFragmentsProps {
  fragments: Fragment[];
  selectedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  onRestoreFragment: (f: Fragment) => void;
  onDeleteFragment?: (f: Fragment) => void;
}

const ReservedFragments: React.FC<ReservedFragmentsProps> = ({
  fragments,
  selectedFragmentId,
  onFragmentClick,
  onRestoreFragment,
  onDeleteFragment,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [deletedFragments, setDeletedFragments] = useState<Fragment[]>([]);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const trashRef = useRef<HTMLDivElement>(null);

  const getPosition = (fragId: string, index: number): Position => {
    if (positions[fragId]) return positions[fragId];
    return { x: 12 + (index % 5) * 80, y: 8 + Math.floor(index / 5) * 68 };
  };

  const isOverTrashZone = useCallback((clientX: number, clientY: number) => {
    if (!trashRef.current) return false;
    const rect = trashRef.current.getBoundingClientRect();
    const pad = 14;
    return (
      clientX >= rect.left - pad &&
      clientX <= rect.right + pad &&
      clientY >= rect.top - pad &&
      clientY <= rect.bottom + pad
    );
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, fragId: string) => {
    e.preventDefault();
    const boardRect = boardRef.current?.getBoundingClientRect();
    if (!boardRect) return;
    const idx = fragments.findIndex(f => f.fragment_id === fragId);
    const pos = positions[fragId] || getPosition(fragId, idx);
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
    setTrashHover(isOverTrashZone(e.clientX, e.clientY));
  }, [dragging, isOverTrashZone]);

  const handleMouseUp = useCallback(() => {
    if (dragging && trashHover) {
      const frag = fragments.find(f => f.fragment_id === dragging);
      if (frag) {
        // Move to deleted list instead of permanent delete
        setDeletedFragments(prev => [...prev, frag]);
        onDeleteFragment?.(frag);
        setPositions(prev => {
          const next = { ...prev };
          delete next[dragging];
          return next;
        });
      }
    }
    setDragging(null);
    setTrashHover(false);
  }, [dragging, trashHover, onDeleteFragment, fragments]);

  const handleRestoreFromTrash = useCallback((frag: Fragment) => {
    setDeletedFragments(prev => prev.filter(f => f.fragment_id !== frag.fragment_id));
    onRestoreFragment(frag);
  }, [onRestoreFragment]);

  const handleEmptyTrash = useCallback(() => {
    setDeletedFragments([]);
  }, []);

  const sourceColors: Record<string, string> = {
    A: "bg-orange-500/20 text-orange-400",
    B: "bg-blue-500/20 text-blue-400",
    C: "bg-emerald-500/20 text-emerald-400",
    D: "bg-purple-500/20 text-purple-400",
    E: "bg-pink-500/20 text-pink-400",
    F: "bg-yellow-500/20 text-yellow-400",
    G: "bg-cyan-500/20 text-cyan-400",
  };

  return (
    <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden relative">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">보류맵</h3>
          <span className="text-[10px] text-muted-foreground">({fragments.length})</span>
        </div>
      </div>

      <div
        ref={boardRef}
        className="relative min-h-[120px] select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setTrashHover(false); }}
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

        {/* Trash icon */}
        <div
          ref={trashRef}
          className="absolute bottom-2 right-2 z-40 cursor-pointer"
          onClick={() => setTrashOpen(prev => !prev)}
        >
          <Trash2
            size={16}
            className={`transition-all duration-150 ${
              trashHover
                ? "text-red-500"
                : deletedFragments.length > 0
                  ? "text-muted-foreground/70"
                  : "text-muted-foreground/40"
            }`}
            strokeWidth={1.5}
            style={{ transform: trashHover ? "scale(1.15)" : "scale(1)" }}
          />
          {deletedFragments.length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500/80 text-[8px] text-foreground flex items-center justify-center font-medium">
              {deletedFragments.length}
            </span>
          )}
        </div>
      </div>

      {/* Trash popup */}
      {trashOpen && (
        <div className="absolute bottom-10 right-2 z-50 w-56 bg-[hsl(228_14%_12%)] border border-border/30 rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
            <span className="text-[11px] font-medium text-foreground">삭제된 조각</span>
            <button
              onClick={() => setTrashOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          <div className="max-h-[180px] overflow-y-auto">
            {deletedFragments.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic px-3 py-4 text-center">
                비어 있음
              </p>
            ) : (
              deletedFragments.map((f) => (
                <div
                  key={f.fragment_id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/30 transition-colors"
                >
                  {/* Mini thumbnail */}
                  <div
                    className="w-8 h-5 rounded-[3px] flex-shrink-0 bg-secondary"
                    style={{
                      backgroundImage: `url(${getFragmentThumbnail(f.fragment_id, f.source_video)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${sourceColors[f.source_video] || "text-foreground"}`}>
                      {f.fragment_id}
                    </span>
                    <span className="text-[9px] text-muted-foreground ml-1">
                      {f.duration.toFixed(1)}s
                    </span>
                  </div>
                  <button
                    onClick={() => handleRestoreFromTrash(f)}
                    className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
                    title="복원"
                  >
                    <RotateCcw size={11} />
                  </button>
                </div>
              ))
            )}
          </div>

          {deletedFragments.length > 0 && (
            <div className="px-3 py-2 border-t border-border/20">
              <button
                onClick={handleEmptyTrash}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] text-red-400 hover:text-red-300 transition-colors py-1"
              >
                <Eraser size={10} />
                비우기
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReservedFragments;