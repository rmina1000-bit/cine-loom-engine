import React, { useState, useCallback, useRef } from "react";
import { Fragment } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { Trash2, X, Eraser, GripVertical } from "lucide-react";

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
  const [draggedFrag, setDraggedFrag] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<"hold" | "edit" | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((e: React.DragEvent, frag: Fragment) => {
    e.dataTransfer.setData("text/plain", frag.fragment_id);
    e.dataTransfer.setData("application/ccut-trash-restore", JSON.stringify(frag));
    e.dataTransfer.effectAllowed = "move";
    setDraggedFrag(frag.fragment_id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedFrag(null);
    setDropTarget(null);
  }, []);

  const handleDropOnZone = useCallback((zone: "hold" | "edit", e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/ccut-trash-restore");
    if (!data) return;
    const frag = JSON.parse(data) as Fragment;
    if (zone === "hold") {
      onRestoreToHold(frag);
    } else {
      onRestoreToEdit(frag);
    }
    setDropTarget(null);
    setDraggedFrag(null);
  }, [onRestoreToHold, onRestoreToEdit]);

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

      {/* Trash window — floating dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-[100]" onClick={() => setIsOpen(false)}>
          <div
            ref={windowRef}
            className="absolute bg-[hsl(228,14%,10%)] border border-border/40 rounded-xl shadow-2xl overflow-hidden"
            style={{
              width: 320,
              right: 24,
              bottom: 24,
              maxHeight: "60vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Title bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-[hsl(228,14%,8%)]">
              <div className="flex items-center gap-2">
                <Trash2 size={13} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[12px] font-medium text-foreground">휴지통</span>
                <span className="text-[10px] text-muted-foreground">({deletedFragments.length})</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-secondary/50"
              >
                <X size={13} />
              </button>
            </div>

            {/* Drop zones hint */}
            {draggedFrag && (
              <div className="flex gap-2 px-3 py-2 bg-secondary/20 border-b border-border/10">
                <div
                  className={`flex-1 text-center py-2 rounded-lg border border-dashed text-[10px] font-medium transition-colors ${
                    dropTarget === "hold"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget("hold"); }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDropOnZone("hold", e)}
                >
                  → 보류맵
                </div>
                <div
                  className={`flex-1 text-center py-2 rounded-lg border border-dashed text-[10px] font-medium transition-colors ${
                    dropTarget === "edit"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/40 text-muted-foreground"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDropTarget("edit"); }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => handleDropOnZone("edit", e)}
                >
                  → 조각맵
                </div>
              </div>
            )}

            {/* Fragment list */}
            <div className="overflow-y-auto" style={{ maxHeight: "calc(60vh - 100px)" }}>
              {deletedFragments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Trash2 size={24} className="text-muted-foreground/20" strokeWidth={1} />
                  <p className="text-[11px] text-muted-foreground/50">비어 있음</p>
                </div>
              ) : (
                deletedFragments.map((f) => (
                  <div
                    key={f.fragment_id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, f)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2.5 px-3 py-2 hover:bg-secondary/30 transition-colors cursor-grab active:cursor-grabbing group ${
                      draggedFrag === f.fragment_id ? "opacity-40" : ""
                    }`}
                  >
                    <GripVertical size={10} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 flex-shrink-0" />
                    {/* Thumbnail */}
                    <div
                      className="w-10 h-6 rounded flex-shrink-0 bg-secondary"
                      style={{
                        backgroundImage: `url(${getFragmentThumbnail(f.fragment_id, f.source_video)})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-[11px] font-medium ${sourceColors[f.source_video] || "text-foreground"}`}>
                        {f.fragment_id}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        {f.duration.toFixed(1)}s
                      </span>
                    </div>
                    <span className="text-[9px] text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
                      드래그로 복원
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {deletedFragments.length > 0 && (
              <div className="px-3 py-2 border-t border-border/20 bg-[hsl(228,14%,8%)]">
                <button
                  onClick={onEmptyTrash}
                  className="w-full flex items-center justify-center gap-1.5 text-[10px] text-destructive hover:text-destructive/80 transition-colors py-1.5 rounded-lg hover:bg-destructive/5"
                >
                  <Eraser size={10} />
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