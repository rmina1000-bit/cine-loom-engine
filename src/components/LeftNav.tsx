import React from "react";
import { Archive, Upload, Settings, User, Plus, FolderOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LeftNavProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const projects = [
  { id: "p1", name: "제주 여행 3월", date: "3월 18일", count: 4 },
  { id: "p2", name: "먹방 시리즈 EP3", date: "3월 15일", count: 7 },
  { id: "p3", name: "일상 브이로그", date: "3월 12일", count: 3 },
  { id: "p4", name: "제품 리뷰", date: "3월 10일", count: 5 },
  { id: "p5", name: "여행 하이라이트", date: "3월 8일", count: 2 },
];

const bottomItems = [
  { id: "archive", icon: Archive, label: "아카이브" },
  { id: "upload", icon: Upload, label: "SNS 업로드" },
  { id: "settings", icon: Settings, label: "설정" },
];

const LeftNav: React.FC<LeftNavProps> = ({ activeItem, onItemClick }) => {
  return (
    <div className="w-[220px] flex flex-col bg-[hsl(228_14%_8%)] h-full flex-shrink-0 border-r border-border/50">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2">
        <span className="text-primary font-bold text-base tracking-wider">CC</span>
        <span className="text-foreground/50 font-medium text-base tracking-wider">UT</span>
      </div>

      {/* Projects section */}
      <div className="px-3 mt-1">
        <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-widest px-2">
          프로젝트
        </span>
      </div>

      <ScrollArea className="flex-1 mt-2 px-2">
        <div className="flex flex-col gap-0.5">
          {projects.map((proj) => {
            const isActive = activeItem === proj.id;
            return (
              <button
                key={proj.id}
                onClick={() => onItemClick(proj.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors duration-100 group
                  ${isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground/80"
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <FolderOpen size={14} className={isActive ? "text-primary" : "text-muted-foreground/50"} strokeWidth={1.5} />
                  <span className="text-[13px] font-normal truncate flex-1">{proj.name}</span>
                </div>
                <span className="text-[11px] text-muted-foreground/50 ml-[26px] block mt-0.5">
                  {proj.date} · {proj.count}개 영상
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* New project button */}
      <div className="px-3 py-2">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/40 transition-colors duration-100">
          <Plus size={14} strokeWidth={1.5} />
          <span className="text-[13px]">새 프로젝트</span>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-border/40" />

      {/* Bottom icons */}
      <div className="px-2 py-3 flex flex-col gap-0.5">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onItemClick(item.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors duration-100
              ${activeItem === item.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground/60 hover:text-foreground/70 hover:bg-secondary/40"
              }`}
          >
            <item.icon size={15} strokeWidth={1.5} />
            <span className="text-[13px]">{item.label}</span>
          </button>
        ))}
      </div>

      {/* User */}
      <div className="px-3 pb-4 pt-1">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-secondary border border-border/50 flex items-center justify-center">
            <User size={13} className="text-muted-foreground" />
          </div>
          <span className="text-[12px] text-muted-foreground/60">내 계정</span>
        </div>
      </div>
    </div>
  );
};

export default LeftNav;
