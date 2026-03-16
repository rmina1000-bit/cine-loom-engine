import React from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { motion } from "framer-motion";

interface FragmentTileProps {
  fragment: Fragment;
  isSelected: boolean;
  isHighlighted: boolean;
  isExpanded?: boolean;
  onClick: () => void;
  widthScale?: number;
  variant?: "panorama" | "edit" | "reserved";
  showIntelligence?: boolean;
}

const sourceColors: Record<string, string> = {
  A: "30", B: "200", C: "120", D: "0", E: "280", F: "50", G: "320",
};

const FragmentTile: React.FC<FragmentTileProps> = ({
  fragment,
  isSelected,
  isHighlighted,
  isExpanded = false,
  onClick,
  widthScale = 1,
  variant = "edit",
  showIntelligence = false,
}) => {
  const hue = Number(sourceColors[fragment.source_video] ?? fragment.thumbnail_hue);
  const minW = variant === "panorama" ? 60 : 48;
  const baseWidth = Math.max(minW, fragment.duration * widthScale);
  const width = isExpanded ? baseWidth * 2 : baseWidth;
  const height = variant === "panorama" ? 64 : variant === "reserved" ? 56 : 72;

  return (
    <motion.div
      layout
      layoutId={`${variant}-${fragment.fragment_id}`}
      onClick={onClick}
      className={`fragment-tile relative rounded-md cursor-pointer overflow-hidden flex-shrink-0
        ${isSelected ? "fragment-glow border-primary/60" : isHighlighted ? "border-primary/30" : "border-border/30"}
        border`}
      style={{ width, height }}
      animate={{
        scale: isHighlighted ? 1.04 : 1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      whileHover={{ scale: 1.03 }}
    >
      {/* Background gradient thumbnail */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 25% 18%), hsl(${(hue + 30) % 360} 20% 12%))`,
        }}
      />

      {/* Selection overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary/10" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
        <span className="text-[10px] font-semibold text-foreground/90 leading-none">
          {fragment.fragment_id}
        </span>
        <span className="text-[9px] text-foreground/50 self-end leading-none">
          {formatDuration(fragment.duration)}
        </span>
      </div>

      {/* Intelligence overlay dots */}
      {showIntelligence && fragment.intelligence && (
        <div className="absolute top-0.5 right-0.5 flex gap-0.5 z-20">
          {fragment.intelligence.hook > 0.7 && (
            <span className="intelligence-dot" style={{ background: "hsl(38 92% 50%)" }} title="High Hook" />
          )}
          {fragment.intelligence.emotional > 0.7 && (
            <span className="intelligence-dot" style={{ background: "hsl(340 70% 55%)" }} title="Emotional Peak" />
          )}
          {fragment.intelligence.narrative > 0.7 && (
            <span className="intelligence-dot" style={{ background: "hsl(240 42% 56%)" }} title="Narrative Key" />
          )}
          {fragment.intelligence.action > 0.7 && (
            <span className="intelligence-dot" style={{ background: "hsl(160 60% 45%)" }} title="Action Dense" />
          )}
        </div>
      )}

      {/* Intelligence heat bar */}
      {showIntelligence && fragment.intelligence && (
        <div className="absolute bottom-0 left-0 right-0 h-1 z-20">
          <div
            className="h-full"
            style={{
              width: `${fragment.intelligence.confidence * 100}%`,
              background: `linear-gradient(90deg, hsl(240 42% 46% / 0.6), hsl(38 92% 50% / 0.6))`,
            }}
          />
        </div>
      )}

      {/* Expanded detail view (Time Lens) */}
      {isExpanded && (
        <div className="absolute inset-0 bg-background/80 z-30 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[10px] text-primary font-semibold">Time Lens</p>
            <p className="text-[9px] text-muted-foreground">F{fragment.start_frame}–F{fragment.end_frame}</p>
            <div className="flex gap-px mt-1 justify-center">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-5 rounded-sm"
                  style={{
                    background: `hsl(${hue + i * 5} 20% ${15 + i * 2}%)`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FragmentTile;
