import React, { useRef, useEffect, useMemo } from "react";
import { Fragment, allFragments } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { Eye, EyeOff } from "lucide-react";

interface OriginalPanoramaProps {
  activeSource: string;
  onSourceChange: (src: string) => void;
  highlightedFragmentId: string | null;
  selectedFragmentId: string | null;
  onFragmentClick: (f: Fragment) => void;
  intelligenceOn: boolean;
  onToggleIntelligence: () => void;
  fragmentOverrides?: Map<string, Fragment>;
  boundaryHighlightIds?: string[];
}

const sources = ["A", "B", "C", "D", "E", "F", "G"];

const OriginalPanorama: React.FC<OriginalPanoramaProps> = ({
  activeSource,
  onSourceChange,
  highlightedFragmentId,
  selectedFragmentId,
  onFragmentClick,
  intelligenceOn,
  onToggleIntelligence,
  fragmentOverrides,
  boundaryHighlightIds,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to highlighted fragment
  useEffect(() => {
    if (highlightedFragmentId && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-fid="${highlightedFragmentId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [highlightedFragmentId]);

  // Scroll to boundary-highlighted fragments during drag
  useEffect(() => {
    if (boundaryHighlightIds && boundaryHighlightIds.length > 0 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-fid="${boundaryHighlightIds[0]}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [boundaryHighlightIds]);

  const baseFragments = allFragments[activeSource] || [];

  // Apply overrides from edit structure boundary changes
  const fragments = useMemo(() => {
    if (!fragmentOverrides || fragmentOverrides.size === 0) return baseFragments;
    return baseFragments.map((f) => {
      const override = fragmentOverrides.get(f.fragment_id);
      if (override) {
        return { ...f, duration: override.duration, start_frame: override.start_frame, end_frame: override.end_frame };
      }
      return f;
    });
  }, [baseFragments, fragmentOverrides]);

  const isBoundaryHighlighted = (fid: string) =>
    boundaryHighlightIds ? boundaryHighlightIds.includes(fid) : false;

  return (
    <div className="flex flex-col bg-card/30 rounded-lg overflow-hidden border border-border/10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[10px] font-medium text-foreground/50 uppercase tracking-widest">원본맵</h3>
          <div className="flex gap-px">
            {sources.map((s) => (
              <button
                key={s}
                onClick={() => onSourceChange(s)}
                className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-medium transition-all
                  ${s === activeSource
                    ? "bg-primary/15 text-primary/90"
                    : "text-muted-foreground/50 hover:text-foreground/60 hover:bg-secondary/40"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={onToggleIntelligence}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[9px] font-medium transition-all
            ${intelligenceOn
              ? "bg-ccut-indigo/15 text-ccut-amber/80"
              : "text-muted-foreground/40 hover:text-foreground/50"
            }`}
        >
          {intelligenceOn ? <Eye size={10} /> : <EyeOff size={10} />}
          정보
        </button>
      </div>

      {/* Scrollable panorama strip */}
      <div
        ref={scrollRef}
        className="flex items-center gap-0 px-2 py-2 overflow-x-auto panorama-scroll"
      >
        {fragments.map((f, i) => (
          <React.Fragment key={f.fragment_id}>
            <div
              data-fid={f.fragment_id}
              className={`relative transition-all duration-150 ${
                isBoundaryHighlighted(f.fragment_id)
                  ? "ring-1 ring-primary/60 rounded-sm"
                  : ""
              }`}
            >
              <FragmentTile
                fragment={f}
                isSelected={selectedFragmentId === f.fragment_id}
                isHighlighted={highlightedFragmentId === f.fragment_id || isBoundaryHighlighted(f.fragment_id)}
                hasActiveSelection={!!selectedFragmentId}
                onClick={() => onFragmentClick(f)}
                widthScale={0.6}
                variant="panorama"
                showIntelligence={intelligenceOn}
              />
            </div>
            {i < fragments.length - 1 && (
              <div className="w-px h-8 bg-border/30 flex-shrink-0 mx-0.5" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default OriginalPanorama;
