import React, { useState, useRef, useEffect } from "react";
import { Fragment, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

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
  const thumbUrl = getFragmentThumbnail(fragment.fragment_id, fragment.source_video, fragment.thumbnail?.thumbnail_url);
  const minW = variant === "panorama" ? 60 : 48;
  const baseWidth = Math.max(minW, fragment.duration * widthScale);
  const width = isExpanded ? baseWidth * 2 : baseWidth;
  const height = variant === "panorama" ? 64 : variant === "reserved" ? 56 : 72;

  const [isHovering, setIsHovering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hover preview: animate a gradient sweep to simulate playback
  useEffect(() => {
    if (isHovering && !isPlaying) {
      // Subtle preview animation on hover
    }
  }, [isHovering, isPlaying]);

  // Click-to-play: simulate playback progress
  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      setIsPlaying(false);
      if (playInterval.current) clearInterval(playInterval.current);
      playInterval.current = null;
    } else {
      setIsPlaying(true);
      setPlayProgress(0);
      playInterval.current = setInterval(() => {
        setPlayProgress(prev => {
          if (prev >= 100) {
            setIsPlaying(false);
            if (playInterval.current) clearInterval(playInterval.current);
            return 0;
          }
          return prev + 2;
        });
      }, 50);
    }
  };

  useEffect(() => {
    return () => {
      if (playInterval.current) clearInterval(playInterval.current);
    };
  }, []);

  return (
    <motion.div
      layout={variant !== "reserved"}
      layoutId={variant !== "reserved" ? `${variant}-${fragment.fragment_id}` : undefined}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); }}
      className={`fragment-tile relative rounded-md cursor-pointer overflow-hidden flex-shrink-0
        ${isSelected ? "fragment-glow border-primary/60" : isHighlighted ? "border-primary/30" : "border-border/30"}
        border`}
      style={{ width, height }}
      animate={{
        scale: isHighlighted ? 1.04 : 1,
      }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      whileHover={{ scale: variant === "reserved" ? 1 : 1.03 }}
    >
      {/* Real thumbnail or fallback hue gradient */}
      {fragment.thumbnail?.thumbnail_url ? (
        <img
          src={fragment.thumbnail.thumbnail_url}
          alt={fragment.fragment_id}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 18% 20%), hsl(${(hue + 25) % 360} 14% 15%))`,
          }}
        />
      )}

      {/* Readability overlay for text on real thumbnails */}
      {fragment.thumbnail?.thumbnail_url && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />
      )}

      {/* Hover preview animation - sweeping highlight */}
      {isHovering && !isPlaying && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, hsl(${hue} 30% 30% / 0.4) 50%, transparent 100%)`,
            animation: "preview-sweep 1.5s ease-in-out infinite",
          }}
        />
      )}

      {/* Playing state - progress bar and scanning effect */}
      {isPlaying && (
        <>
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, hsl(${hue} 25% 25% / 0.5) ${playProgress}%, transparent ${playProgress + 2}%)`,
            }}
          />
          {/* Playhead line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
            style={{ left: `${playProgress}%` }}
          />
        </>
      )}

      {/* Selection overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-primary/10" />
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-1.5">
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-semibold text-foreground/90 leading-none">
            {fragment.fragment_id}
          </span>
          {/* Play button - visible on hover */}
          {isHovering && (
            <button
              onClick={togglePlay}
              className="w-4 h-4 rounded-full bg-foreground/20 hover:bg-foreground/40 flex items-center justify-center transition-all"
            >
              {isPlaying ? (
                <Pause size={8} className="text-foreground" />
              ) : (
                <Play size={8} className="text-foreground ml-px" />
              )}
            </button>
          )}
        </div>
        <div className="flex items-end justify-between">
          <span className="text-[9px] text-foreground/50 leading-none">
            {formatDuration(fragment.duration)}
          </span>
          {/* Playback progress indicator */}
          {isPlaying && (
            <span className="text-[8px] text-primary/80 leading-none">
              {Math.round(playProgress)}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar at bottom during playback */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground/10 z-30">
          <div
            className="h-full bg-primary/70 transition-all"
            style={{ width: `${playProgress}%` }}
          />
        </div>
      )}

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
      {showIntelligence && fragment.intelligence && !isPlaying && (
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
