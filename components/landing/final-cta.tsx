'use client';

import Link from 'next/link';

export function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />

      {/* Animated gradient orbs */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8">
          <span className="material-symbols-outlined text-indigo-400 text-sm">rocket_launch</span>
          <span className="text-sm text-indigo-300">Start Your Transformation</span>
        </div>

        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
          Ready to Look Your{' '}
          <span className="gradient-text">Professional Best</span>?
        </h2>

        {/* Subheadline */}
        <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
          Join 100,000+ professionals who have transformed their online presence.
          Your studio-quality headshot is just 60 seconds away.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Link
            href="/dashboard/create"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-lg font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
            Create Your Headshot — Free
          </Link>
          <Link
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-zinc-800/50 hover:bg-zinc-700/50 text-white text-lg font-medium rounded-xl border border-zinc-700 transition-all duration-200"
          >
            <span className="material-symbols-outlined">payments</span>
            View Pricing
          </Link>
        </div>

        {/* Trust elements */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
            <span>No credit card required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
            <span>3 free headshots included</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
            <span>Results in under 60 seconds</span>
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-12 pt-12 border-t border-zinc-800">
          <div className="flex justify-center mb-4">
            {/* Avatar stack */}
            <div className="flex -space-x-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"
                >
                  <span className="text-xs font-bold text-white">
                    {['JD', 'SK', 'MR', 'AL', 'TC'][i]}
                  </span>
                </div>
              ))}
              <div className="w-10 h-10 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center">
                <span className="text-xs font-medium text-zinc-400">+99K</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="material-symbols-outlined text-yellow-400">star</span>
            ))}
          </div>
          <p className="text-zinc-400">
            <span className="font-semibold text-white">4.9/5</span> from over 10,000 reviews
          </p>
        </div>
      </div>
    </section>
  );
}
