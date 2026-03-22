import React from "react";
import { FolderOpen, Upload, Archive, Layers, Settings, User } from "lucide-react";

interface LeftNavProps {
  activeItem: string;
  onItemClick: (item: string) => void;
}

const navItems = [
  { id: "projects", icon: FolderOpen, label: "프로젝트" },
  { id: "upload", icon: Upload, label: "업로드" },
  { id: "archive", icon: Archive, label: "아카이브" },
  { id: "layers", icon: Layers, label: "레이어/구조" },
  { id: "settings", icon: Settings, label: "설정" },
];

const LeftNav: React.FC<LeftNavProps> = ({ activeItem, onItemClick }) => {
  return (
    <div className="w-[60px] flex flex-col items-center bg-card/50 h-full py-4 flex-shrink-0">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-primary font-semibold text-sm tracking-widest">CC</span>
        <span className="text-foreground/60 font-medium text-sm tracking-widest">UT</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all group relative
                ${isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              title={item.label}
            >
              <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              <span className="absolute left-full ml-2 px-2 py-1 bg-secondary text-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="mt-auto">
        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center">
          <User size={14} className="text-primary" />
        </div>
      </div>
    </div>
  );
};

export default LeftNav;
