"use client";

import { photoStyles, type PhotoStyle } from "@/lib/styles";

const styleIcons: Record<string, string> = {
  "classic-bw": "contrast",
  "neon-dual": "flare",
  "studio-pro": "photo_camera",
  "ethereal": "blur_on",
  "beam": "wb_sunny",
  "slit": "light_mode",
  "silhouette": "person",
};

interface StyleSelectorProps {
  selectedStyle: string | null;
  onSelectStyle: (styleId: string) => void;
}

export function StyleSelector({ selectedStyle, onSelectStyle }: StyleSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-white mb-1">Choose a Style</h3>
        <p className="text-sm text-[#71717a]">Select the look you want for your headshot</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {photoStyles.map((style) => (
          <StyleCard
            key={style.id}
            style={style}
            icon={styleIcons[style.id] || "photo_camera"}
            isSelected={selectedStyle === style.id}
            onSelect={() => onSelectStyle(style.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface StyleCardProps {
  style: PhotoStyle;
  icon: string;
  isSelected: boolean;
  onSelect: () => void;
}

function StyleCard({ style, icon, isSelected, onSelect }: StyleCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative group rounded-2xl overflow-hidden border-2 transition-all duration-300 ${
        isSelected
          ? "border-indigo-500 ring-2 ring-indigo-500/30 scale-[1.02]"
          : "border-[#27272a] hover:border-[#3f3f46]"
      }`}
    >
      {/* Style Preview */}
      <div className={`aspect-square bg-gradient-to-br ${style.gradient} relative`}>
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-white/70 text-[28px]">{icon}</span>
          </div>
        </div>

        {/* Selected Checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-[18px]">check</span>
          </div>
        )}
      </div>

      {/* Style Name */}
      <div className="p-3 bg-[#18181b]">
        <p className={`text-sm font-medium truncate transition-colors ${
          isSelected ? "text-indigo-400" : "text-white"
        }`}>
          {style.name}
        </p>
      </div>
    </button>
  );
}
