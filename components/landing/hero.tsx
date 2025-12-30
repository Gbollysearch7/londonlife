'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const stats = [
  { value: '100K+', label: 'Headshots Created' },
  { value: '4.9★', label: 'User Rating' },
  { value: '<60s', label: 'Generation Time' },
  { value: '18+', label: 'Pro Styles' },
];

const trustedBy = [
  'Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix'
];

export function Hero() {
  const [currentStat, setCurrentStat] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStat((prev) => (prev + 1) % stats.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setImageIndex((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-grid opacity-50" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
              <span className="material-symbols-outlined text-indigo-400 text-sm">auto_awesome</span>
              <span className="text-sm text-indigo-300">AI-Powered Professional Headshots</span>
            </div>

            {/* Main headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Transform Any Selfie Into a{' '}
              <span className="gradient-text">Studio-Quality Headshot</span>{' '}
              in 60 Seconds
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-zinc-400 mb-8 max-w-xl mx-auto lg:mx-0">
              No photographer needed. No expensive studio. Just upload your selfie and let our AI create stunning professional headshots for LinkedIn, your website, or anywhere you need to look your best.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <Link
                href="/dashboard/create"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                <span className="material-symbols-outlined">add_photo_alternate</span>
                Create Your Headshot — Free
              </Link>
              <a
                href="#examples"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-800/50 hover:bg-zinc-700/50 text-white font-medium rounded-xl border border-zinc-700 transition-all duration-200"
              >
                <span className="material-symbols-outlined">play_circle</span>
                See Examples
              </a>
            </div>

            {/* Trust stats */}
            <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto lg:mx-0">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`text-center transition-all duration-300 ${
                    index === currentStat ? 'scale-110' : 'opacity-70'
                  }`}
                >
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-xs text-zinc-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right content - Demo preview */}
          <div className="relative">
            <div className="relative mx-auto max-w-md">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl blur-2xl" />

              {/* Main card */}
              <div className="relative bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800 p-6 shadow-2xl">
                {/* Before/After labels */}
                <div className="flex justify-between mb-4">
                  <span className="text-sm text-zinc-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">photo_camera</span>
                    Your Selfie
                  </span>
                  <span className="text-sm text-indigo-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    AI Result
                  </span>
                </div>

                {/* Image comparison */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Before */}
                  <div className="aspect-[3/4] rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center p-4">
                        <span className="material-symbols-outlined text-4xl text-zinc-600 mb-2">person</span>
                        <p className="text-xs text-zinc-600">Casual selfie</p>
                      </div>
                    </div>
                    {/* Placeholder effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-700/50 to-zinc-800/50" />
                  </div>

                  {/* After */}
                  <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 overflow-hidden relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center p-4">
                        <span className="material-symbols-outlined text-4xl text-indigo-400 mb-2">verified</span>
                        <p className="text-xs text-indigo-300">Professional</p>
                      </div>
                    </div>
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-shimmer" />
                  </div>
                </div>

                {/* Style selector preview */}
                <div className="flex gap-2 mb-4">
                  {['Corporate', 'Creative', 'Artistic'].map((style, i) => (
                    <button
                      key={style}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                        i === imageIndex
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>

                {/* Generate button */}
                <button className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined">bolt</span>
                  Generate Headshot
                </button>
              </div>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-bounce">
                FREE TRIAL
              </div>
            </div>
          </div>
        </div>

        {/* Trusted by section */}
        <div className="mt-20 pt-10 border-t border-zinc-800">
          <p className="text-center text-sm text-zinc-500 mb-6">
            Trusted by professionals at world-leading companies
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-50">
            {trustedBy.map((company) => (
              <span key={company} className="text-xl font-bold text-zinc-500">
                {company}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </section>
  );
}
