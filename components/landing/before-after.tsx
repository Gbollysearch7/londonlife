'use client';

import { useState } from 'react';

const transformations = [
  {
    id: 1,
    name: 'Sarah M.',
    role: 'Marketing Director',
    style: 'Executive',
    useCase: 'LinkedIn',
    category: 'professional',
  },
  {
    id: 2,
    name: 'James K.',
    role: 'Startup Founder',
    style: 'Startup Founder',
    useCase: 'Company Website',
    category: 'creative',
  },
  {
    id: 3,
    name: 'Emily R.',
    role: 'Creative Director',
    style: 'Creative Director',
    useCase: 'Portfolio',
    category: 'creative',
  },
  {
    id: 4,
    name: 'Michael T.',
    role: 'Attorney',
    style: 'Legal',
    useCase: 'Law Firm Website',
    category: 'professional',
  },
  {
    id: 5,
    name: 'Lisa P.',
    role: 'Content Creator',
    style: 'Influencer',
    useCase: 'Social Media',
    category: 'creative',
  },
  {
    id: 6,
    name: 'David W.',
    role: 'Musician',
    style: 'Noir',
    useCase: 'Album Cover',
    category: 'artistic',
  },
  {
    id: 7,
    name: 'Jennifer L.',
    role: 'Real Estate Agent',
    style: 'Real Estate',
    useCase: 'Business Cards',
    category: 'specialty',
  },
  {
    id: 8,
    name: 'Robert H.',
    role: 'Tech Executive',
    style: 'Corporate',
    useCase: 'Annual Report',
    category: 'professional',
  },
  {
    id: 9,
    name: 'Amanda S.',
    role: 'Author',
    style: 'Speaker/Author',
    useCase: 'Book Cover',
    category: 'creative',
  },
  {
    id: 10,
    name: 'Chris B.',
    role: 'Doctor',
    style: 'Medical',
    useCase: 'Hospital Website',
    category: 'professional',
  },
  {
    id: 11,
    name: 'Nina F.',
    role: 'Model',
    style: 'High Fashion',
    useCase: 'Portfolio',
    category: 'artistic',
  },
  {
    id: 12,
    name: 'Tyler M.',
    role: 'Gamer/Streamer',
    style: 'Neon Glow',
    useCase: 'Twitch Profile',
    category: 'artistic',
  },
];

const filters = [
  { id: 'all', label: 'All Styles' },
  { id: 'professional', label: 'Professional' },
  { id: 'creative', label: 'Creative' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'specialty', label: 'Specialty' },
];

export function BeforeAfter() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [sliderPosition, setSliderPosition] = useState<{ [key: number]: number }>({});

  const filteredTransformations = activeFilter === 'all'
    ? transformations
    : transformations.filter(t => t.category === activeFilter);

  const handleSliderMove = (id: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition({ ...sliderPosition, [id]: Math.max(0, Math.min(100, percentage)) });
  };

  return (
    <section className="py-24 relative overflow-hidden" id="examples">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-6">
            <span className="material-symbols-outlined text-pink-400 text-sm">compare</span>
            <span className="text-sm text-pink-300">Real Transformations</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            See the <span className="gradient-text">Magic</span> in Action
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Real examples from real users. Hover over any image to compare
            the original selfie with the AI-generated professional headshot.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeFilter === filter.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Gallery grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTransformations.map((item) => (
            <div
              key={item.id}
              className="group relative"
              onMouseEnter={() => setHoveredCard(item.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-zinc-800 border border-zinc-700 shadow-lg transition-all duration-300 group-hover:border-indigo-500/50 group-hover:shadow-xl group-hover:shadow-indigo-500/10">
                {/* Before image (placeholder) */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-800"
                  style={{
                    clipPath: `inset(0 ${100 - (sliderPosition[item.id] ?? 50)}% 0 0)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center opacity-50">
                      <span className="material-symbols-outlined text-3xl text-zinc-500">person</span>
                      <p className="text-xs text-zinc-500 mt-1">Before</p>
                    </div>
                  </div>
                </div>

                {/* After image (placeholder) */}
                <div
                  className="absolute inset-0 bg-gradient-to-br from-indigo-900/80 to-purple-900/80"
                  style={{
                    clipPath: `inset(0 0 0 ${sliderPosition[item.id] ?? 50}%)`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-3xl text-indigo-300">auto_awesome</span>
                      <p className="text-xs text-indigo-300 mt-1">After</p>
                    </div>
                  </div>
                </div>

                {/* Slider handle */}
                <div
                  className="absolute inset-0 cursor-ew-resize"
                  onMouseMove={(e) => hoveredCard === item.id && handleSliderMove(item.id, e)}
                >
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg"
                    style={{ left: `${sliderPosition[item.id] ?? 50}%` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-zinc-800 text-sm">drag_handle</span>
                    </div>
                  </div>
                </div>

                {/* Style badge */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-xs font-medium text-white border border-white/10">
                    {item.style}
                  </span>
                </div>

                {/* Hover overlay */}
                <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity ${
                  hoveredCard === item.id ? 'opacity-100' : 'opacity-0'
                }`}>
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-zinc-400 text-sm">{item.role}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <span className="material-symbols-outlined text-indigo-400 text-sm">check_circle</span>
                      <span className="text-xs text-zinc-400">Used for {item.useCase}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom stats */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '100,000+', label: 'Headshots Generated', icon: 'photo_camera' },
            { value: '50,000+', label: 'Happy Customers', icon: 'sentiment_satisfied' },
            { value: '4.9/5', label: 'Average Rating', icon: 'star' },
            { value: '18+', label: 'Professional Styles', icon: 'style' },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
              <span className="material-symbols-outlined text-3xl text-indigo-400 mb-2">{stat.icon}</span>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
