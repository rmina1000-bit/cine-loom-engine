import React, { useState, useRef, useEffect } from "react";
import { Upload, Send, Play, Film, Loader2, Check, MessageSquare, User, Bot, Plus } from "lucide-react";
import { Fragment, sourceVideos, formatDuration } from "@/data/fragmentData";
import { getFragmentThumbnail } from "@/data/thumbnailMap";
import { ScrollArea } from "@/components/ui/scroll-area";

type AppState = "empty" | "analyzing" | "proposal" | "chat";

interface ProposalOption {
  id: string;
  title: string;
  description: string;
  thumbnailHue: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  proposal?: { a: ProposalOption; b: ProposalOption };
}

interface CenterPanelProps {
  selectedFragment: Fragment | null;
  selectedSource: string;
  editSequence?: Fragment[];
}

const mockProposals: { a: ProposalOption; b: ProposalOption } = {
  a: {
    id: "A",
    title: "내러티브 중심",
    description: "인터뷰 흐름을 따라 감정선을 강조한 편집",
    thumbnailHue: 211,
  },
  b: {
    id: "B",
    title: "비주얼 중심",
    description: "B-Roll과 액션 컷을 활용한 역동적인 편집",
    thumbnailHue: 30,
  },
};

const CenterPanel: React.FC<CenterPanelProps> = ({ selectedFragment, selectedSource, editSequence = [] }) => {
  const [appState, setAppState] = useState<AppState>("empty");
  const [chatInput, setChatInput] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sourceInfo = sourceVideos.find((s) => s.id === selectedSource);
  const activeSequence = editSequence.filter(f => !f.excluded);
  const totalDuration = activeSequence.reduce((sum, f) => sum + f.duration, 0);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Simulate analysis progress
  useEffect(() => {
    if (appState !== "analyzing") return;
    setAnalyzeProgress(0);
    const interval = setInterval(() => {
      setAnalyzeProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setAppState("proposal"), 400);
          return 100;
        }
        return prev + Math.random() * 8 + 2;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [appState]);

  const handleUpload = () => {
    setAppState("analyzing");
  };

  const handleSelectProposal = (id: string) => {
    setSelectedProposal(id);
  };

  const handleStartChat = () => {
    const proposal = selectedProposal === "A" ? mockProposals.a : mockProposals.b;
    setMessages([
      {
        id: "1",
        role: "ai",
        content: `"${proposal.title}" 편집안을 선택하셨습니다. ${proposal.description}. 수정이 필요하시면 말씀해 주세요.`,
      },
    ]);
    setAppState("chat");
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: chatInput,
    };
    setMessages(prev => [...prev, userMsg]);
    setChatInput("");

    // Simulate AI response
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: "네, 이해했습니다. 새로운 편집안을 준비하고 있어요.",
        proposal: Math.random() > 0.5 ? mockProposals : undefined,
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ── STATE 1: Empty ──
  if (appState === "empty") {
    return (
      <div className="flex flex-col bg-card/40 h-full w-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            className="w-full max-w-sm border-2 border-dashed border-border/40 rounded-xl p-8 flex flex-col items-center gap-4 hover:border-primary/30 transition-colors cursor-pointer"
            onClick={handleUpload}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); handleUpload(); }}
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <Upload size={24} className="text-muted-foreground" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium text-foreground">영상을 업로드하세요</p>
              <p className="text-xs text-muted-foreground">드래그하거나 클릭해서 파일을 선택하세요</p>
            </div>
            <button
              className="px-5 py-2 rounded-lg border border-foreground/20 bg-transparent text-foreground text-sm font-medium hover:bg-foreground/5 hover:border-foreground/40 transition-all"
              onClick={(e) => { e.stopPropagation(); handleUpload(); }}
            >
              파일 선택
            </button>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" />
          </div>
        </div>

        {/* Chat bar */}
        <ChatBar
          value={chatInput}
          onChange={setChatInput}
          onSend={handleSendMessage}
          onKeyDown={handleKeyDown}
          disabled
        />
      </div>
    );
  }

  // ── STATE 2: Analyzing ──
  if (appState === "analyzing") {
    return (
      <div className="flex flex-col bg-card/40 h-full w-full">
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-5 w-full max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
              <Loader2 size={24} className="text-primary animate-spin" />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium text-foreground">AI가 영상을 분석하고 있어요</p>
              <p className="text-xs text-muted-foreground">장면 분할, 감정 분석, 구조 파악 중...</p>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(analyzeProgress, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">{Math.min(Math.round(analyzeProgress), 100)}%</p>
          </div>
        </div>
        <ChatBar value="" onChange={() => {}} onSend={() => {}} onKeyDown={() => {}} disabled />
      </div>
    );
  }

  // ── STATE 3: Proposal ──
  if (appState === "proposal") {
    return (
      <div className="flex flex-col bg-card/40 h-full w-full">
        <div className="flex-1 overflow-y-auto">
          {/* Source info */}
          {sourceInfo && (
            <div className="px-4 pt-4 pb-3 space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">SOURCE</span>
              <p className="text-sm font-medium text-foreground">{sourceInfo.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{sourceInfo.description}</p>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>{sourceInfo.totalFrames} frames</span>
                <span>{sourceInfo.fps} fps</span>
                <span>{formatDuration(sourceInfo.totalFrames, sourceInfo.fps)}</span>
              </div>
            </div>
          )}

          <div className="mx-4 h-px bg-border/30" />

          {/* A/B Proposal cards */}
          <div className="px-4 py-4 space-y-3">
            <h3 className="text-xs font-semibold text-foreground">편집안 선택</h3>
            <div className="grid grid-cols-2 gap-3">
              {[mockProposals.a, mockProposals.b].map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  isSelected={selectedProposal === p.id}
                  onSelect={() => handleSelectProposal(p.id)}
                />
              ))}
            </div>
          </div>

          <div className="mx-4 h-px bg-border/30" />

          {/* Render preview */}
          <div className="px-4 py-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Film size={12} />
              Render Preview
            </h4>
            {selectedProposal ? (
              <div className="space-y-3">
                <div className="w-full h-28 rounded-lg border border-border/30 bg-secondary/30 flex items-center justify-center">
                  <div className="text-center space-y-1">
                    <Play size={20} className="text-muted-foreground/50 mx-auto" />
                    <p className="text-[10px] text-muted-foreground/60">미리보기 준비 완료</p>
                  </div>
                </div>
                <button
                  onClick={handleStartChat}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  이 편집안으로 시작하기
                </button>
              </div>
            ) : (
              <div className="w-full h-20 rounded-lg border border-dashed border-border/30 flex items-center justify-center bg-secondary/20">
                <span className="text-[10px] text-muted-foreground/50">
                  편집안을 선택하면 미리보기가 여기에 표시됩니다
                </span>
              </div>
            )}
          </div>
        </div>

        <ChatBar
          value={chatInput}
          onChange={setChatInput}
          onSend={handleSendMessage}
          onKeyDown={handleKeyDown}
        />
      </div>
    );
  }

  // ── STATE 4: Chat ──
  return (
    <div className="flex flex-col bg-card/40 h-full w-full">
      <ScrollArea className="flex-1">
        <div className="px-4 py-3 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "ai" && (
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={12} className="text-primary" />
                </div>
              )}
              <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
                {/* Inline proposal cards in chat */}
                {msg.proposal && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[msg.proposal.a, msg.proposal.b].map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        isSelected={selectedProposal === p.id}
                        onSelect={() => setSelectedProposal(p.id)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={12} className="text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      <ChatBar
        value={chatInput}
        onChange={setChatInput}
        onSend={handleSendMessage}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
};

// ── Sub-components ──

interface ChatBarProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
}

const ChatBar: React.FC<ChatBarProps> = ({ value, onChange, onSend, onKeyDown, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="px-3 py-2 border-t border-border/20">
      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) console.log("Video selected:", file.name);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="수정을 요청하거나 질문하세요..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-40"
          disabled={disabled}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

interface ProposalCardProps {
  proposal: ProposalOption;
  isSelected: boolean;
  onSelect: () => void;
  compact?: boolean;
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, isSelected, onSelect, compact }) => (
  <button
    onClick={onSelect}
    className={`text-left rounded-xl border overflow-hidden transition-all ${
      isSelected
        ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
        : "border-border/30 bg-secondary/30 hover:border-border/50 hover:bg-secondary/50"
    }`}
  >
    {/* Thumbnail area */}
    <div
      className={`w-full ${compact ? "h-16" : "h-20"} relative`}
      style={{
        background: `linear-gradient(135deg, hsl(${proposal.thumbnailHue} 25% 18%), hsl(${proposal.thumbnailHue} 30% 12%))`,
      }}
    >
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <Check size={10} className="text-primary-foreground" />
        </div>
      )}
      <div className="absolute bottom-1.5 left-2">
        <span className="text-[10px] font-bold text-foreground/80">{proposal.id}안</span>
      </div>
    </div>
    <div className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} space-y-0.5`}>
      <p className={`font-medium text-foreground ${compact ? "text-[10px]" : "text-xs"}`}>{proposal.title}</p>
      <p className={`text-muted-foreground leading-snug ${compact ? "text-[9px]" : "text-[10px]"}`}>{proposal.description}</p>
    </div>
  </button>
);

export default CenterPanel;
