import React, { useRef, useEffect, useMemo } from "react";
import { Fragment, allFragments } from "@/data/fragmentData";
import FragmentTile from "./FragmentTile";
import { Eye, EyeOff } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  onBoundaryClick?: (leftIndex: number, rightIndex: number) => void;
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
  onBoundaryClick,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedFragmentId && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-fid="${highlightedFragmentId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [highlightedFragmentId]);

  useEffect(() => {
    if (boundaryHighlightIds && boundaryHighlightIds.length > 0 && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-fid="${boundaryHighlightIds[0]}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [boundaryHighlightIds]);

  const baseFragments = allFragments[activeSource] || [];

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
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col bg-card/50 rounded-lg overflow-hidden border border-border/20">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2.5">
            <h3 className="text-[11px] font-semibold text-foreground/80 uppercase tracking-widest">원본맵</h3>
            <div className="flex gap-px">
              {sources.map((s) => (
                <button
                  key={s}
                  onClick={() => onSourceChange(s)}
                  className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-medium transition-all
                    ${s === activeSource
                      ? "bg-primary/15 text-primary/90"
                      : "text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/40"
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
                  highlightedFragmentId === f.fragment_id
                    ? "ring-1 ring-primary/40 rounded-sm"
                    : isBoundaryHighlighted(f.fragment_id)
                      ? "ring-1 ring-primary/30 rounded-sm"
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
              {/* Boundary divider — click to open precision editor */}
              {i < fragments.length - 1 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="boundary-link w-px h-8 bg-border/30 flex-shrink-0 mx-0.5 cursor-pointer hover:bg-primary/50 hover:w-[2px] transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Note: panorama boundaries use source-local indices, not edit indices.
                        // For now, this is a visual affordance. In production it would resolve to edit indices.
                        onBoundaryClick?.(i, i + 1);
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[9px]">
                    경계 편집 열기
                  </TooltipContent>
                </Tooltip>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
};

export default OriginalPanorama;
