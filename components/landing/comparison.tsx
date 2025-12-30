'use client';

const comparisonData = [
  {
    feature: 'Cost',
    traditional: '$200 - $500+',
    snapstudio: 'From $9',
    winner: 'snapstudio'
  },
  {
    feature: 'Time to get photos',
    traditional: '1-3 weeks',
    snapstudio: '< 60 seconds',
    winner: 'snapstudio'
  },
  {
    feature: 'Scheduling required',
    traditional: 'Yes, often weeks out',
    snapstudio: 'No, instant access',
    winner: 'snapstudio'
  },
  {
    feature: 'Location',
    traditional: 'Travel to studio',
    snapstudio: 'Anywhere, anytime',
    winner: 'snapstudio'
  },
  {
    feature: 'Number of styles',
    traditional: '1-2 per session',
    snapstudio: '18+ styles available',
    winner: 'snapstudio'
  },
  {
    feature: 'Retakes',
    traditional: 'Reschedule & repay',
    snapstudio: 'Unlimited regenerations',
    winner: 'snapstudio'
  },
  {
    feature: 'Team photos',
    traditional: 'Schedule everyone together',
    snapstudio: 'Each person anytime',
    winner: 'snapstudio'
  },
  {
    feature: 'Quality',
    traditional: 'Excellent',
    snapstudio: 'Professional-grade',
    winner: 'tie'
  },
  {
    feature: 'Consistency',
    traditional: 'Varies by photographer',
    snapstudio: 'Always consistent',
    winner: 'snapstudio'
  },
  {
    feature: 'Digital delivery',
    traditional: 'Days to weeks',
    snapstudio: 'Instant download',
    winner: 'snapstudio'
  }
];

export function Comparison() {
  return (
    <section className="py-24 relative overflow-hidden" id="comparison">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
            <span className="material-symbols-outlined text-amber-400 text-sm">compare_arrows</span>
            <span className="text-sm text-amber-300">See the Difference</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            SnapStudio vs{' '}
            <span className="gradient-text">Traditional Photography</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Why spend hundreds of dollars and weeks of time when you can get
            professional results in seconds?
          </p>
        </div>

        {/* Comparison table */}
        <div className="bg-zinc-900/50 rounded-3xl border border-zinc-800 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-3 bg-zinc-800/50 border-b border-zinc-700">
            <div className="p-4 md:p-6">
              <span className="text-sm text-zinc-500">Feature</span>
            </div>
            <div className="p-4 md:p-6 text-center border-l border-zinc-700">
              <div className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-zinc-500">photo_camera</span>
                <span className="text-sm font-medium text-zinc-400">Traditional</span>
              </div>
            </div>
            <div className="p-4 md:p-6 text-center border-l border-zinc-700 bg-indigo-500/10">
              <div className="flex flex-col items-center gap-1">
                <span className="material-symbols-outlined text-indigo-400">auto_awesome</span>
                <span className="text-sm font-medium text-indigo-400">SnapStudio</span>
              </div>
            </div>
          </div>

          {/* Data rows */}
          {comparisonData.map((row, index) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 ${
                index !== comparisonData.length - 1 ? 'border-b border-zinc-800' : ''
              }`}
            >
              <div className="p-4 md:p-6 flex items-center">
                <span className="text-sm md:text-base text-zinc-300">{row.feature}</span>
              </div>
              <div className={`p-4 md:p-6 text-center border-l border-zinc-800 flex items-center justify-center ${
                row.winner === 'traditional' ? 'bg-emerald-500/5' : ''
              }`}>
                <span className="text-sm text-zinc-500">{row.traditional}</span>
              </div>
              <div className={`p-4 md:p-6 text-center border-l border-zinc-800 flex items-center justify-center gap-2 ${
                row.winner === 'snapstudio' ? 'bg-indigo-500/10' : row.winner === 'tie' ? 'bg-zinc-800/30' : ''
              }`}>
                {row.winner === 'snapstudio' && (
                  <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                )}
                <span className={`text-sm ${
                  row.winner === 'snapstudio' ? 'text-white font-medium' : 'text-zinc-400'
                }`}>
                  {row.snapstudio}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary cards */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 text-center">
            <div className="text-4xl font-bold text-emerald-400 mb-2">95%</div>
            <div className="text-sm text-zinc-400">Cost savings vs traditional</div>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 text-center">
            <div className="text-4xl font-bold text-indigo-400 mb-2">1000x</div>
            <div className="text-sm text-zinc-400">Faster delivery time</div>
          </div>
          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">∞</div>
            <div className="text-sm text-zinc-400">Unlimited style options</div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-zinc-400 mb-6">
            Still not convinced? Try it free and see the difference yourself.
          </p>
          <a
            href="/dashboard/create"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            <span className="material-symbols-outlined">science</span>
            Try SnapStudio Free
          </a>
        </div>
      </div>
    </section>
  );
}
