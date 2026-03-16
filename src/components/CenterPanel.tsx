import React, { useState } from "react";
import { Plus, Send, ChevronRight, Play, Film } from "lucide-react";
import { Fragment, sourceVideos, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";

interface CenterPanelProps {
  selectedFragment: Fragment | null;
  selectedSource: string;
  editSequence?: Fragment[];
}

const CenterPanel: React.FC<CenterPanelProps> = ({ selectedFragment, selectedSource, editSequence = [] }) => {
  const [chatInput, setChatInput] = useState("");

  const sourceInfo = sourceVideos.find((s) => s.id === selectedSource);

  // Total edit structure duration
  const totalDuration = editSequence.reduce((sum, f) => sum + f.duration, 0);

  return (
    <div className="flex flex-col bg-card/40 h-full w-full">
      {/* Header */}
      <div className="px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground tracking-wide">Structure Analysis</h2>
      </div>

      {/* Edit Structure sequence summary */}
      {editSequence.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Edit Structure
            </span>
            <span className="text-[10px] text-muted-foreground">
              {editSequence.length} fragments · {formatDuration(totalDuration)}
            </span>
          </div>
          {/* Sequence minimap */}
          <div className="flex items-center gap-0 h-5 rounded overflow-hidden">
            {editSequence.map((f) => (
              <div
                key={f.fragment_id}
                className={`h-full overflow-hidden relative flex-shrink-0 ${
                  selectedFragment?.fragment_id === f.fragment_id ? "ring-1 ring-primary" : ""
                }`}
                style={{ width: Math.max(8, (f.duration / totalDuration) * 100) + "%" }}
                title={`${f.fragment_id} · ${formatDuration(f.duration)}`}
              >
                <img
                  src={getFragmentThumbnail(f.fragment_id, f.source_video, f.thumbnail?.thumbnail_url)}
                  alt={f.fragment_id}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
          {/* Sequence text */}
          <p className="text-[9px] text-muted-foreground/60 leading-tight truncate">
            {editSequence.map(f => f.fragment_id).join(" → ")}
          </p>
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 h-px bg-border/30" />

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

            {/* Fragment thumbnail preview */}
            <div className="w-full h-24 rounded-md border border-border overflow-hidden">
              <img
                src={getFragmentThumbnail(selectedFragment.fragment_id, selectedFragment.source_video, selectedFragment.thumbnail?.thumbnail_url)}
                alt={selectedFragment.fragment_id}
                className="w-full h-full object-cover"
              />
            </div>

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

            {/* Boundary context */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Structure Context
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fragment {selectedFragment.fragment_id} occupies frames {selectedFragment.start_frame}–{selectedFragment.end_frame} ({formatDuration(selectedFragment.duration)}).
                {selectedFragment.intelligence && selectedFragment.intelligence.hook > 0.7
                  ? " Strong hook element in the edit structure."
                  : " Supporting structural element in the sequence."}
                {" "}Boundaries are shared with adjacent fragments — adjusting this fragment's edges will redistribute neighboring durations.
              </p>
              <p className="text-[10px] text-muted-foreground/50">
                Excluding this fragment will move it to the Hold Area, not delete the source material.
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
            Select a fragment to view its structure context and editorial analysis.
          </div>
        )}

        {/* Render preview placeholder */}
        <div className="h-px bg-border/40" />
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Film size={12} />
            Render Preview
          </h4>
          <div className="w-full h-20 rounded-md border border-dashed border-border/40 flex items-center justify-center gap-2 bg-secondary/30">
            <Play size={14} className="text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/40">
              Request render to preview final video here
            </span>
          </div>
        </div>
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
            placeholder="Ask about structure, request render..."
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
