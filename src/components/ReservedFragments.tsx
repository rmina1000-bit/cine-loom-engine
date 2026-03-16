import React from "react";
import { Fragment } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { Trash2 } from "lucide-react";

interface ReservedFragmentsProps {
  fragments: Fragment[];
  selectedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  onDeleteFragment: (f: Fragment) => void;
}

const ReservedFragments: React.FC<ReservedFragmentsProps> = ({
  fragments,
  selectedFragmentId,
  onFragmentClick,
  onDeleteFragment,
}) => {
  return (
    <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground tracking-wide">Reserved Fragments</h3>
          <span className="text-[10px] text-muted-foreground">({fragments.length})</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Holding area for unused fragments</span>
      </div>

      {/* Free-form board */}
      <div className="relative min-h-[100px] px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {fragments.map((f) => (
            <FragmentTile
              key={f.fragment_id}
              fragment={f}
              isSelected={selectedFragmentId === f.fragment_id}
              isHighlighted={false}
              onClick={() => onFragmentClick(f)}
              widthScale={0.5}
              variant="reserved"
            />
          ))}
          {fragments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Drop fragments here to reserve them.</p>
          )}
        </div>

        {/* Trash icon */}
        <button
          onClick={() => {
            const selected = fragments.find((f) => f.fragment_id === selectedFragmentId);
            if (selected) onDeleteFragment(selected);
          }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-md bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-all"
          title="Delete selected fragment pointer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default ReservedFragments;
