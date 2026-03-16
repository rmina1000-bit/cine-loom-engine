import React, { useState, useCallback } from "react";
import LeftNav from "@/components/LeftNav";
import CenterPanel from "@/components/CenterPanel";
import OriginalPanorama from "@/components/OriginalPanorama";
import FragmentMap from "@/components/FragmentMap";
import ReservedFragments from "@/components/ReservedFragments";
import { Fragment, initialEditFragments, initialReservedFragments } from "@/data/fragmentData";

const Index: React.FC = () => {
  const [activeNavItem, setActiveNavItem] = useState("projects");
  const [activeSource, setActiveSource] = useState("A");
  const [selectedFragment, setSelectedFragment] = useState<Fragment | null>(null);
  const [highlightedPanoramaFrag, setHighlightedPanoramaFrag] = useState<string | null>(null);
  const [expandedFragment, setExpandedFragment] = useState<string | null>(null);
  const [intelligenceOn, setIntelligenceOn] = useState(false);
  const [editFragments, setEditFragments] = useState<Fragment[]>(initialEditFragments);
  const [reservedFragments, setReservedFragments] = useState<Fragment[]>(initialReservedFragments);

  // Source Recall: when clicking an edit fragment, recall its source
  const handleEditFragmentClick = useCallback((f: Fragment) => {
    setSelectedFragment(f);
    // Source recall system
    setActiveSource(f.source_video);
    setHighlightedPanoramaFrag(f.fragment_id);
    // Clear expansion if clicking different fragment
    if (expandedFragment === f.fragment_id) {
      setExpandedFragment(null);
    }
  }, [expandedFragment]);

  // Time Lens: double-click to expand
  const handleEditFragmentDoubleClick = useCallback((f: Fragment) => {
    setExpandedFragment((prev) => (prev === f.fragment_id ? null : f.fragment_id));
  }, []);

  // Panorama fragment click
  const handlePanoramaFragmentClick = useCallback((f: Fragment) => {
    setSelectedFragment(f);
  }, []);

  // Remove from edit → move to reserved
  const handleRemoveFromEdit = useCallback((f: Fragment) => {
    setEditFragments((prev) => prev.filter((fr) => fr.fragment_id !== f.fragment_id));
    setReservedFragments((prev) => [...prev, f]);
  }, []);

  // Delete from reserved (just removes pointer)
  const handleDeleteReserved = useCallback((f: Fragment) => {
    setReservedFragments((prev) => prev.filter((fr) => fr.fragment_id !== f.fragment_id));
  }, []);

  const handleReservedClick = useCallback((f: Fragment) => {
    setSelectedFragment(f);
    setActiveSource(f.source_video);
    setHighlightedPanoramaFrag(f.fragment_id);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Left Navigation */}
      <LeftNav activeItem={activeNavItem} onItemClick={setActiveNavItem} />

      {/* Center Panel */}
      <CenterPanel selectedFragment={selectedFragment} selectedSource={activeSource} />

      {/* Right Workspace */}
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-hidden">
        {/* A: Original Panorama */}
        <OriginalPanorama
          activeSource={activeSource}
          onSourceChange={setActiveSource}
          highlightedFragmentId={highlightedPanoramaFrag}
          selectedFragmentId={selectedFragment?.fragment_id || null}
          onFragmentClick={handlePanoramaFragmentClick}
          intelligenceOn={intelligenceOn}
          onToggleIntelligence={() => setIntelligenceOn((p) => !p)}
        />

        {/* B: Fragment Map */}
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

        {/* C: Reserved Fragments */}
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
