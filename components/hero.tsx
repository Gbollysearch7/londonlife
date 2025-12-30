"use client";

import Link from "next/link";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[#09090b]" />
      <div className="absolute inset-0 bg-grid opacity-50" />

      {/* Gradient Orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Card */}
        <div className="bg-gradient-to-br from-[#18181b] to-black rounded-3xl p-1 border border-[#27272a] shadow-2xl shadow-black/50">
          <div className="bg-[#18181b]/50 rounded-[20px] p-8 md:p-16 text-center relative overflow-hidden group">
            {/* Inner Grid */}
            <div className="absolute inset-0 bg-grid opacity-30" />

            {/* Glow Effect */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/20 rounded-full blur-[100px] group-hover:bg-indigo-500/30 transition-all duration-700" />

            <div className="relative z-10 max-w-3xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                <span>AI-Powered Professional Headshots</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-6">
                Transform Your Selfie Into{" "}
                <span className="gradient-text">Professional Headshots</span>
              </h1>

              {/* Subheading */}
              <p className="text-[#a1a1aa] text-lg sm:text-xl mb-12 max-w-2xl mx-auto">
                Upload a selfie and get stunning professional headshots in under a minute.
                Perfect for LinkedIn, social media, and professional profiles.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap justify-center gap-4 mb-12">
                <Link
                  href="/generate"
                  className="flex items-center px-8 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 transform hover:-translate-y-1 font-semibold text-lg group/btn"
                >
                  <span className="material-symbols-outlined mr-3 group-hover/btn:rotate-12 transition-transform">add_circle</span>
                  Create Your Headshot
                </Link>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Ready in 30 seconds
                </div>
              </div>

              {/* Style Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-12 border-t border-white/5">
                {[
                  { icon: "contrast", label: "B&W Film", color: "text-zinc-400", hoverBg: "group-hover/action:bg-zinc-500/10", hoverBorder: "group-hover/action:border-zinc-500/50" },
                  { icon: "flare", label: "Neon Glow", color: "text-pink-500", hoverBg: "group-hover/action:bg-pink-500/10", hoverBorder: "group-hover/action:border-pink-500/50" },
                  { icon: "photo_camera", label: "Studio Pro", color: "text-blue-500", hoverBg: "group-hover/action:bg-blue-500/10", hoverBorder: "group-hover/action:border-blue-500/50" },
                  { icon: "wb_sunny", label: "Beam Light", color: "text-amber-500", hoverBg: "group-hover/action:bg-amber-500/10", hoverBorder: "group-hover/action:border-amber-500/50" },
                  { icon: "blur_on", label: "Ethereal", color: "text-purple-500", hoverBg: "group-hover/action:bg-purple-500/10", hoverBorder: "group-hover/action:border-purple-500/50" },
                ].map((style, i) => (
                  <Link
                    key={i}
                    href="/generate"
                    className="flex flex-col items-center gap-2 group/action hover:-translate-y-1 transition-transform"
                  >
                    <div className={`w-14 h-14 rounded-2xl bg-[#27272a] border border-[#3f3f46] flex items-center justify-center ${style.hoverBorder} ${style.hoverBg} transition-colors`}>
                      <span className={`material-symbols-outlined ${style.color}`}>{style.icon}</span>
                    </div>
                    <span className="text-xs font-medium text-[#a1a1aa] group-hover/action:text-white transition-colors">{style.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-yellow-500">bolt</span>
            <span>Instant generation</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-green-500">verified_user</span>
            <span>Privacy focused</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-indigo-500">palette</span>
            <span>7 unique styles</span>
          </div>
        </div>
      </div>
    </section>
  );
}
