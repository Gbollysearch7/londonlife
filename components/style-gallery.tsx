"use client";

import Link from "next/link";
import { photoStyles } from "@/lib/styles";

const styleIcons: Record<string, string> = {
  "classic-bw": "contrast",
  "neon-dual": "flare",
  "studio-pro": "photo_camera",
  "ethereal": "blur_on",
  "beam": "wb_sunny",
  "slit": "light_mode",
  "silhouette": "person",
};

const styleColors: Record<string, { bg: string; border: string; text: string }> = {
  "classic-bw": { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-400" },
  "neon-dual": { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-500" },
  "studio-pro": { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-500" },
  "ethereal": { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-500" },
  "beam": { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-500" },
  "slit": { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-500" },
  "silhouette": { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-400" },
};

export function StyleGallery() {
  return (
    <section id="styles" className="relative py-24 overflow-hidden bg-[#09090b]">
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <span className="w-1.5 h-8 bg-indigo-500 rounded-full" />
              Photography Styles
            </h2>
            <p className="text-[#71717a] mt-2">
              Choose from 7 professionally designed looks
            </p>
          </div>
          <Link
            href="/generate"
            className="text-sm font-medium text-indigo-500 hover:text-white transition-colors flex items-center gap-1"
          >
            Try All Styles
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>

        {/* Style Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {photoStyles.map((style) => {
            const colors = styleColors[style.id] || styleColors["classic-bw"];
            const icon = styleIcons[style.id] || "photo_camera";

            return (
              <Link
                key={style.id}
                href="/generate"
                className="group bg-[#18181b] border border-[#27272a] hover:border-indigo-500/30 rounded-2xl overflow-hidden transition-all duration-300 hover:bg-[#27272a]/50 hover:shadow-lg hover:shadow-black/20 card-hover"
              >
                {/* Style Preview */}
                <div className={`h-40 bg-gradient-to-br ${style.gradient} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white/70 text-[32px]">{icon}</span>
                    </div>
                  </div>
                </div>

                {/* Style Info */}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${colors.bg} ${colors.text} ${colors.border} border`}>
                        {style.id.split("-")[0]}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-indigo-400 transition-colors">
                    {style.name}
                  </h3>
                  <p className="text-xs text-[#71717a] line-clamp-2 mb-4">
                    {style.description}
                  </p>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center text-xs font-medium text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[16px] mr-1">visibility</span>
                      Preview
                    </button>
                    <button className="flex items-center text-xs font-medium text-[#a1a1aa] hover:text-white transition-colors ml-auto">
                      <span className="material-symbols-outlined text-[16px] mr-1">arrow_forward</span>
                      Use Style
                    </button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
