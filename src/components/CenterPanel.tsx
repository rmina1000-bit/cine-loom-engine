import React, { useState } from "react";
import { Plus, Send, ChevronRight } from "lucide-react";
import { Fragment, sourceVideos, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";

interface CenterPanelProps {
  selectedFragment: Fragment | null;
  selectedSource: string;
}

const CenterPanel: React.FC<CenterPanelProps> = ({ selectedFragment, selectedSource }) => {
  const [chatInput, setChatInput] = useState("");

  const sourceInfo = sourceVideos.find((s) => s.id === selectedSource);

  return (
    <div className="flex flex-col bg-card/40 h-full w-full">
      {/* Header */}
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground tracking-wide">Source Analysis</h2>
      </div>

      {/* Source summary cards */}
      <div className="px-3 py-2">
        <div className="flex flex-wrap gap-1.5">
          {sourceVideos.slice(0, 7).map((sv) => (
            <div
              key={sv.id}
              className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all
                ${sv.id === selectedSource
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
            >
              {sv.id}: {sv.label.split("–")[0].trim()}
            </div>
          ))}
        </div>
      </div>

      {/* Analysis content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Source info */}
        {sourceInfo && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Source {sourceInfo.id}
            </h3>
            <p className="text-sm text-foreground font-medium">{sourceInfo.label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{sourceInfo.description}</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>{sourceInfo.totalFrames} frames</span>
              <span>{sourceInfo.fps} fps</span>
              <span>{formatDuration(sourceInfo.totalFrames, sourceInfo.fps)}</span>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border/40" />

        {/* Selected fragment info */}
        {selectedFragment ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selected Fragment
              </span>
              <ChevronRight size={12} className="text-muted-foreground" />
              <span className="text-sm font-bold text-primary">{selectedFragment.fragment_id}</span>
            </div>

            {/* Fragment thumbnail placeholder */}
            <div
              className="w-full h-24 rounded-md border border-border"
              style={{
                background: `linear-gradient(135deg, hsl(${selectedFragment.thumbnail_hue} 30% 18%), hsl(${selectedFragment.thumbnail_hue + 30} 25% 12%))`,
              }}
            />

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-secondary rounded px-2 py-1.5">
                <span className="text-muted-foreground">Source</span>
                <p className="text-foreground font-medium">{selectedFragment.source_video}</p>
              </div>
              <div className="bg-secondary rounded px-2 py-1.5">
                <span className="text-muted-foreground">Duration</span>
                <p className="text-foreground font-medium">{formatDuration(selectedFragment.duration)}</p>
              </div>
              <div className="bg-secondary rounded px-2 py-1.5">
                <span className="text-muted-foreground">Start</span>
                <p className="text-foreground font-medium">F{selectedFragment.start_frame}</p>
              </div>
              <div className="bg-secondary rounded px-2 py-1.5">
                <span className="text-muted-foreground">End</span>
                <p className="text-foreground font-medium">F{selectedFragment.end_frame}</p>
              </div>
            </div>

            {/* Editorial context */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Editorial Context
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fragment {selectedFragment.fragment_id} serves as a {selectedFragment.intelligence && selectedFragment.intelligence.hook > 0.7 ? "strong hook element" : "supporting transition"} in
                the current edit structure. Sourced from {sourceInfo?.label || `Source ${selectedFragment.source_video}`}, it
                contributes {selectedFragment.intelligence && selectedFragment.intelligence.emotional > 0.6 ? "significant emotional weight" : "structural continuity"} to
                the narrative flow.
              </p>
            </div>

            {/* Intelligence metrics */}
            {selectedFragment.intelligence && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  AI Signals
                </h4>
                <div className="space-y-1">
                  {Object.entries(selectedFragment.intelligence).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20 capitalize">{key}</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${val * 100}%`,
                            background: `linear-gradient(90deg, hsl(240 42% 46%), hsl(38 92% 50%))`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{(val * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">
            Select a fragment to view analysis and editorial context.
          </div>
        )}
      </div>

      {/* Chat bar */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-secondary rounded-lg px-2 py-1.5">
          <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0">
            <Plus size={16} />
          </button>
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about fragments..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CenterPanel;
