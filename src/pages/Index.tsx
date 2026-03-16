import React, { useState, useCallback, useRef, useEffect } from "react";
import LeftNav from "@/components/LeftNav";
import CenterPanel from "@/components/CenterPanel";
import OriginalPanorama from "@/components/OriginalPanorama";
import FragmentMap from "@/components/FragmentMap";
import ReservedFragments from "@/components/ReservedFragments";
import { Fragment, initialEditFragments, initialReservedFragments } from "@/data/fragmentData";

const STORAGE_KEY = "ccut-center-width";
const MIN_CENTER = 260;
const MIN_RIGHT = 400;
const DEFAULT_CENTER = 340;

const Index: React.FC = () => {
  const [activeNavItem, setActiveNavItem] = useState("projects");
  const [activeSource, setActiveSource] = useState("A");
  const [selectedFragment, setSelectedFragment] = useState<Fragment | null>(null);
  const [highlightedPanoramaFrag, setHighlightedPanoramaFrag] = useState<string | null>(null);
  const [expandedFragment, setExpandedFragment] = useState<string | null>(null);
  const [intelligenceOn, setIntelligenceOn] = useState(false);
  const [editFragments, setEditFragments] = useState<Fragment[]>(initialEditFragments);
  const [reservedFragments, setReservedFragments] = useState<Fragment[]>(initialReservedFragments);

  // Splitter state
  const [centerWidth, setCenterWidth] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Math.max(MIN_CENTER, Number(saved)) : DEFAULT_CENTER;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftNavWidth = 56; // w-14 = 3.5rem = 56px

  // Persist width
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(centerWidth));
  }, [centerWidth]);

  // Global mouse handlers for smooth dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const totalWidth = containerRect.width;
      const relativeX = e.clientX - containerRect.left - leftNavWidth;
      const maxCenter = totalWidth - leftNavWidth - MIN_RIGHT;
      const clamped = Math.max(MIN_CENTER, Math.min(maxCenter, relativeX));
      setCenterWidth(clamped);
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  // Source Recall — single click toggles selection
  const handleEditFragmentClick = useCallback((f: Fragment) => {
    if (selectedFragment?.fragment_id === f.fragment_id) {
      // Toggle off
      setSelectedFragment(null);
      setHighlightedPanoramaFrag(null);
      setExpandedFragment(null);
    } else {
      setSelectedFragment(f);
      setActiveSource(f.source_video);
      setHighlightedPanoramaFrag(f.fragment_id);
      setExpandedFragment(null);
    }
  }, [selectedFragment]);

  const handleEditFragmentDoubleClick = useCallback((f: Fragment) => {
    // Always select + enter Time Lens
    setSelectedFragment(f);
    setActiveSource(f.source_video);
    setHighlightedPanoramaFrag(f.fragment_id);
    setExpandedFragment((prev) => (prev === f.fragment_id ? null : f.fragment_id));
  }, []);

  const handlePanoramaFragmentClick = useCallback((f: Fragment) => {
    if (selectedFragment?.fragment_id === f.fragment_id) {
      setSelectedFragment(null);
      setHighlightedPanoramaFrag(null);
    } else {
      setSelectedFragment(f);
    }
  }, [selectedFragment]);

  const handleReservedClick = useCallback((f: Fragment) => {
    if (selectedFragment?.fragment_id === f.fragment_id) {
      setSelectedFragment(null);
      setHighlightedPanoramaFrag(null);
    } else {
      setSelectedFragment(f);
      setActiveSource(f.source_video);
      setHighlightedPanoramaFrag(f.fragment_id);
    }
  }, [selectedFragment]);

  return (
    <div ref={containerRef} className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Navigation */}
      <LeftNav activeItem={activeNavItem} onItemClick={setActiveNavItem} />

      {/* Center Panel - resizable */}
      <div style={{ width: centerWidth, flexShrink: 0 }}>
        <CenterPanel selectedFragment={selectedFragment} selectedSource={activeSource} />
      </div>

      {/* Vertical Splitter */}
      <div
        className={`flex-shrink-0 flex items-center justify-center cursor-col-resize group transition-colors
          ${isDragging ? "bg-primary/15" : "hover:bg-primary/8"}`}
        style={{ width: 6 }}
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
      >
        <div
          className={`w-[2px] h-10 rounded-full transition-all duration-150
            ${isDragging
              ? "bg-primary/60 h-16"
              : "bg-border/40 group-hover:bg-primary/40 group-hover:h-14"
            }`}
        />
      </div>

      {/* Right Workspace - fills remaining */}
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden min-w-0">
        <OriginalPanorama
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          highlightedFragmentId={highlightedPanoramaFrag}
          selectedFragmentId={selectedFragment?.fragment_id || null}
          onFragmentClick={handlePanoramaFragmentClick}
          intelligenceOn={intelligenceOn}
          onToggleIntelligence={() => setIntelligenceOn((p) => !p)}
        />

        <div className="flex-1 overflow-y-auto">
          <FragmentMap
            fragments={editFragments}
            onFragmentsChange={setEditFragments}
            selectedFragmentId={selectedFragment?.fragment_id || null}
            expandedFragmentId={expandedFragment}
            onFragmentClick={handleEditFragmentClick}
            onFragmentDoubleClick={handleEditFragmentDoubleClick}
            onRemoveFragment={handleRemoveFromEdit}
          />
        </div>

        <ReservedFragments
          fragments={reservedFragments}
          selectedFragmentId={selectedFragment?.fragment_id || null}
          onFragmentClick={handleReservedClick}
          onDeleteFragment={handleDeleteReserved}
        />
      </div>
    </div>
  );
};

export default Index;
