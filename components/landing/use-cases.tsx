'use client';

import { useState } from 'react';

const useCases = [
  {
    id: 'linkedin',
    title: 'LinkedIn Profile',
    icon: 'work',
    description: 'Stand out with a professional headshot that gets you noticed. LinkedIn users with professional photos receive up to 21x more profile views.',
    stats: '21x more views',
    color: '#0077b5',
    tips: [
      'Use a clean, professional background',
      'Maintain eye contact with the camera',
      'Dress appropriately for your industry',
      'Keep it current — update every 2-3 years'
    ],
    testimonial: {
      quote: "I updated my LinkedIn photo with SnapStudio and saw my profile views triple in a week!",
      name: 'Sarah K.',
      role: 'Marketing Manager'
    }
  },
  {
    id: 'company',
    title: 'Company Website',
    icon: 'apartment',
    description: 'Create a cohesive team page with consistent, professional headshots. No need to schedule a photographer for every new hire.',
    stats: 'Consistent team look',
    color: '#6366f1',
    tips: [
      'Use the same style across all team members',
      'Match your brand colors in backgrounds',
      'Ensure similar lighting and composition',
      'Update as team members join'
    ],
    testimonial: {
      quote: "We saved thousands on photography by using SnapStudio for our 50-person team page.",
      name: 'Michael R.',
      role: 'HR Director'
    }
  },
  {
    id: 'resume',
    title: 'Resume & CV',
    icon: 'description',
    description: 'Many industries expect a photo on your resume. Make a strong first impression before the interview even starts.',
    stats: '40% better response',
    color: '#10b981',
    tips: [
      'Keep it professional and conservative',
      'Use high resolution for print quality',
      'Match the formality of your industry',
      'Ensure the photo is recent'
    ],
    testimonial: {
      quote: "Adding a professional headshot to my CV increased my interview callbacks significantly.",
      name: 'James L.',
      role: 'Software Engineer'
    }
  },
  {
    id: 'social',
    title: 'Social Media',
    icon: 'share',
    description: 'Build your personal brand with a consistent, professional image across all platforms — Twitter, Instagram, and beyond.',
    stats: '2.5x engagement',
    color: '#ec4899',
    tips: [
      'Use the same photo across platforms',
      'Consider the platform\'s typical style',
      'Square crop works best for most platforms',
      'Update regularly to stay current'
    ],
    testimonial: {
      quote: "My follower engagement increased 150% after I updated all my profile photos.",
      name: 'Emily T.',
      role: 'Content Creator'
    }
  },
  {
    id: 'dating',
    title: 'Dating Apps',
    icon: 'favorite',
    description: 'First impressions matter. Get more matches with a natural, attractive photo that shows the real you.',
    stats: '3x more matches',
    color: '#f43f5e',
    tips: [
      'Keep it natural and approachable',
      'Use genuine expressions',
      'Avoid heavy editing or filters',
      'Show your personality'
    ],
    testimonial: {
      quote: "Honestly, my matches went up dramatically with a better quality photo. Worth every penny!",
      name: 'Chris M.',
      role: 'Product Designer'
    }
  },
  {
    id: 'author',
    title: 'Author & Speaker',
    icon: 'menu_book',
    description: 'Build authority and connection with your audience. Your headshot appears on book covers, event pages, and speaker bios.',
    stats: 'Build authority',
    color: '#f59e0b',
    tips: [
      'Convey warmth and approachability',
      'Consider your book/talk subject matter',
      'High resolution for print (book covers)',
      'Match your personal brand'
    ],
    testimonial: {
      quote: "My new headshot helped me land 3 speaking gigs at major conferences.",
      name: 'Dr. Amanda S.',
      role: 'Author & Keynote Speaker'
    }
  }
];

export function UseCases() {
  const [activeCase, setActiveCase] = useState('linkedin');

  const activeUseCase = useCases.find(uc => uc.id === activeCase)!;

  return (
    <section className="py-24 relative overflow-hidden" id="use-cases">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <span className="material-symbols-outlined text-emerald-400 text-sm">category</span>
            <span className="text-sm text-emerald-300">Versatile Use Cases</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Perfect For <span className="gradient-text">Every Platform</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Whether you need a photo for LinkedIn, your company website, or dating apps,
            SnapStudio creates the perfect headshot for any occasion.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left: Use case tabs */}
          <div className="lg:col-span-4 space-y-3">
            {useCases.map((useCase) => (
              <button
                key={useCase.id}
                onClick={() => setActiveCase(useCase.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                  activeCase === useCase.id
                    ? 'bg-zinc-800/80 border-indigo-500/50 shadow-lg'
                    : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${useCase.color}20` }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: useCase.color }}
                    >
                      {useCase.icon}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{useCase.title}</h3>
                    <p className="text-xs text-zinc-500">{useCase.stats}</p>
                  </div>
                  <span className={`material-symbols-outlined transition-transform ${
                    activeCase === useCase.id ? 'text-indigo-400' : 'text-zinc-600'
                  }`}>
                    {activeCase === useCase.id ? 'check_circle' : 'arrow_forward'}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Right: Active use case details */}
          <div className="lg:col-span-8">
            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800 overflow-hidden">
              {/* Header */}
              <div
                className="p-8 border-b border-zinc-800"
                style={{
                  background: `linear-gradient(135deg, ${activeUseCase.color}15, transparent)`
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${activeUseCase.color}20` }}
                  >
                    <span
                      className="material-symbols-outlined text-3xl"
                      style={{ color: activeUseCase.color }}
                    >
                      {activeUseCase.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2">{activeUseCase.title}</h3>
                    <p className="text-zinc-400">{activeUseCase.description}</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Tips */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-400">tips_and_updates</span>
                      Pro Tips
                    </h4>
                    <ul className="space-y-3">
                      {activeUseCase.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5">check</span>
                          <span className="text-zinc-300 text-sm">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Testimonial */}
                  <div>
                    <h4 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-400">format_quote</span>
                      Success Story
                    </h4>
                    <div className="bg-zinc-800/50 rounded-xl p-5 border border-zinc-700">
                      <p className="text-zinc-300 italic mb-4">
                        &ldquo;{activeUseCase.testimonial.quote}&rdquo;
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {activeUseCase.testimonial.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{activeUseCase.testimonial.name}</p>
                          <p className="text-xs text-zinc-500">{activeUseCase.testimonial.role}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <div className="mt-8 pt-6 border-t border-zinc-800 flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: `${activeUseCase.color}20`,
                        color: activeUseCase.color
                      }}
                    >
                      {activeUseCase.stats}
                    </span>
                    <span className="text-zinc-500 text-sm">with professional headshot</span>
                  </div>
                  <a
                    href="/dashboard/create"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-all"
                  >
                    <span className="material-symbols-outlined">add_photo_alternate</span>
                    Create for {activeUseCase.title}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
