'use client';

const features = [
  {
    icon: 'face',
    title: 'Identity Preservation',
    description: 'Our AI maintains your exact facial features, expressions, and unique characteristics. You\'ll look like you — just more polished.',
    highlight: 'You, but better',
    color: 'indigo'
  },
  {
    icon: 'wb_sunny',
    title: 'Professional Lighting',
    description: 'Simulated studio lighting techniques including Rembrandt, butterfly, and split lighting. No expensive studio required.',
    highlight: 'Studio quality',
    color: 'amber'
  },
  {
    icon: 'wallpaper',
    title: 'Smart Backgrounds',
    description: 'Choose from solid colors, gradients, or blurred backgrounds. Our AI seamlessly replaces your original background.',
    highlight: 'Instant upgrade',
    color: 'emerald'
  },
  {
    icon: '4k',
    title: 'High Resolution Output',
    description: 'Download your headshot in stunning 4K resolution. Perfect for print, web, and everything in between.',
    highlight: '4K Ultra HD',
    color: 'purple'
  },
  {
    icon: 'bolt',
    title: 'Lightning Fast',
    description: 'Get your professional headshot in under 60 seconds. No appointments, no waiting, no hassle.',
    highlight: '< 60 seconds',
    color: 'pink'
  },
  {
    icon: 'verified',
    title: 'Commercial License',
    description: 'Use your headshots anywhere — LinkedIn, company websites, marketing materials. Full commercial rights included.',
    highlight: 'Use anywhere',
    color: 'cyan'
  },
  {
    icon: 'tune',
    title: 'Customization Options',
    description: 'Adjust lighting direction, background color, and output settings to get exactly the look you want.',
    highlight: 'Full control',
    color: 'rose'
  },
  {
    icon: 'photo_library',
    title: 'Multiple Variations',
    description: 'Generate up to 4 variations with each request. Pick your favorite or use different shots for different platforms.',
    highlight: 'More options',
    color: 'orange'
  }
];

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
};

export function Features() {
  return (
    <section className="py-24 relative overflow-hidden" id="features">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
            <span className="material-symbols-outlined text-cyan-400 text-sm">stars</span>
            <span className="text-sm text-cyan-300">Powerful Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need for{' '}
            <span className="gradient-text">Perfect Headshots</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Professional photography studio results without the professional photography studio.
            Our AI handles all the technical details so you don&apos;t have to.
          </p>
        </div>

        {/* Features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const colors = colorClasses[feature.color];
            return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                  <span className={`material-symbols-outlined text-2xl ${colors.text}`}>
                    {feature.icon}
                  </span>
                </div>

                {/* Content */}
                <h3 className="font-semibold text-lg mb-2 text-white group-hover:text-indigo-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-zinc-400 mb-4">
                  {feature.description}
                </p>

                {/* Highlight badge */}
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {feature.highlight}
                </span>

                {/* Hover gradient */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            );
          })}
        </div>

        {/* Bottom highlight */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20">
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-bold mb-2">Why Choose SnapStudio?</h3>
              <p className="text-zinc-400">
                Traditional professional photography costs $200-$500 and takes weeks to schedule.
                SnapStudio delivers the same quality in under 60 seconds for a fraction of the price.
                Plus, you can create as many headshots as you need, whenever you need them.
              </p>
            </div>
            <div className="text-center md:text-right">
              <a
                href="/dashboard/create"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-all"
              >
                <span className="material-symbols-outlined">rocket_launch</span>
                Try It Free
              </a>
              <p className="mt-2 text-sm text-zinc-500">No credit card required</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
