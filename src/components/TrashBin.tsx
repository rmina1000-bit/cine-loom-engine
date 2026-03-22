import React, { useState, useCallback, useRef, useEffect } from "react";
import { Fragment } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { Trash2, X, GripVertical } from "lucide-react";

interface TrashBinProps {
  deletedFragments: Fragment[];
  onRestoreToHold: (f: Fragment) => void;
  onRestoreToEdit: (f: Fragment) => void;
  onEmptyTrash: () => void;
  onTrashDrop: (f: Fragment) => void;
}

const sourceColors: Record<string, string> = {
  A: "text-orange-400",
  B: "text-blue-400",
  C: "text-emerald-400",
  D: "text-purple-400",
  E: "text-pink-400",
  F: "text-yellow-400",
  G: "text-cyan-400",
};

const TrashBin: React.FC<TrashBinProps> = ({
  deletedFragments,
  onRestoreToHold,
  onRestoreToEdit,
  onEmptyTrash,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  // Draggable window state
  const [windowPos, setWindowPos] = useState<{ x: number; y: number } | null>(null);
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const windowDragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen && !windowPos) {
      setWindowPos({
        x: window.innerWidth - 344,
        y: window.innerHeight - 400,
      });
    }
  }, [isOpen]);

  const handleTitleBarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    windowDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsWindowDragging(true);
  }, []);

  useEffect(() => {
    if (!isWindowDragging) return;
    const handleMove = (e: MouseEvent) => {
      setWindowPos({
        x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - windowDragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - windowDragOffset.current.y)),
      });
    };
    const handleUp = () => setIsWindowDragging(false);
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [isWindowDragging]);

  // Handle restoring a fragment via context menu on right-click or double-click
  const handleRestoreToHoldClick = useCallback((f: Fragment) => {
    onRestoreToHold(f);
  }, [onRestoreToHold]);

  const handleRestoreToEditClick = useCallback((f: Fragment) => {
    onRestoreToEdit(f);
  }, [onRestoreToEdit]);

  // Drag from trash - set data for external drop targets
  const handleDragStart = useCallback((e: React.DragEvent, frag: Fragment) => {
    e.dataTransfer.setData("text/plain", frag.fragment_id);
    e.dataTransfer.setData("application/ccut-trash-restore", JSON.stringify(frag));
    e.dataTransfer.effectAllowed = "move";
  }, []);

  return (
    <>
      {/* Trash icon button */}
      <div
        className="cursor-pointer relative"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <Trash2
          size={16}
          className={`transition-all duration-150 ${
            deletedFragments.length > 0
              ? "text-muted-foreground/70"
              : "text-muted-foreground/40"
          }`}
          strokeWidth={1.5}
        />
        {deletedFragments.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-destructive/80 text-[8px] text-foreground flex items-center justify-center font-medium">
            {deletedFragments.length}
          </span>
        )}
      </div>

      {/* Trash window */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100]"
          onClick={() => setIsOpen(false)}
          style={{ pointerEvents: isWindowDragging ? "none" : "auto" }}
        >
          <div
            ref={windowRef}
            className="absolute bg-[hsl(228,14%,10%)] border border-border/40 rounded-xl shadow-2xl overflow-hidden"
            style={{
              width: 300,
              left: windowPos?.x ?? "auto",
              top: windowPos?.y ?? "auto",
              maxHeight: "55vh",
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div
              className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-[hsl(228,14%,8%)] cursor-move select-none"
              onMouseDown={handleTitleBarMouseDown}
            >
              <div className="flex items-center gap-2">
                <Trash2 size={12} className="text-muted-foreground/60" strokeWidth={1.5} />
                <span className="text-[11px] font-medium text-foreground/80">휴지통</span>
                <span className="text-[10px] text-muted-foreground/50">({deletedFragments.length})</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 rounded hover:bg-secondary/50"
              >
                <X size={12} />
              </button>
            </div>

            {/* Fragment list */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(55vh - 80px)" }}>
              {deletedFragments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-1.5">
                  <Trash2 size={20} className="text-muted-foreground/15" strokeWidth={1} />
                  <p className="text-[10px] text-muted-foreground/40">비어 있음</p>
                </div>
              ) : (
                deletedFragments.map((f) => (
                  <div
                    key={f.fragment_id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, f)}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/30 transition-colors cursor-grab active:cursor-grabbing group"
                  >
                    <GripVertical size={9} className="text-muted-foreground/20 group-hover:text-muted-foreground/50 flex-shrink-0" />
                    <div
                      className="w-9 h-5.5 rounded flex-shrink-0 bg-secondary"
                      style={{
                        width: 36, height: 22,
                        backgroundImage: `url(${getFragmentThumbnail(f.fragment_id, f.source_video)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        borderRadius: 3,
                      }}
                    />
                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className={`text-[10px] font-medium ${sourceColors[f.source_video] || "text-foreground"}`}>
                        {f.fragment_id}
                      </span>
                      <span className="text-[9px] text-muted-foreground/50">
                        {f.duration.toFixed(1)}s
                      </span>
                    </div>
                    {/* Restore buttons */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestoreToHoldClick(f); }}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="보류맵으로 복원"
                      >
                        보류
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestoreToEditClick(f); }}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="조각맵으로 복원"
                      >
                        편집
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {deletedFragments.length > 0 && (
              <div className="px-3 py-2 border-t border-border/15 bg-[hsl(228,14%,8%)]">
                <button
                  onClick={onEmptyTrash}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground/70 transition-colors py-1 rounded-lg hover:bg-secondary/30"
                >
                  <Trash2 size={9} strokeWidth={1.5} />
                  휴지통 비우기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TrashBin;