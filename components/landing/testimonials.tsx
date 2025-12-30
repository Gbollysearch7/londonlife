'use client';

import { useState } from 'react';

const testimonials = [
  {
    id: 1,
    quote: "I was skeptical at first, but SnapStudio completely exceeded my expectations. My new LinkedIn headshot has gotten me so many compliments and connection requests!",
    name: 'Sarah Mitchell',
    role: 'Marketing Director',
    company: 'TechCorp',
    rating: 5,
    image: null,
    featured: true
  },
  {
    id: 2,
    quote: "We used SnapStudio for our entire 50-person team page. The consistency and quality are incredible. Saved us thousands compared to hiring a photographer.",
    name: 'Michael Chen',
    role: 'HR Director',
    company: 'StartupXYZ',
    rating: 5,
    image: null,
    featured: true
  },
  {
    id: 3,
    quote: "As a real estate agent, my headshot is everything. SnapStudio gave me a professional look that builds instant trust with clients. Worth every penny!",
    name: 'Jennifer Lopez',
    role: 'Real Estate Agent',
    company: 'Luxury Homes Realty',
    rating: 5,
    image: null,
    featured: true
  },
  {
    id: 4,
    quote: "The speed is unbelievable. I uploaded my selfie during a coffee break and had a professional headshot before I finished my latte.",
    name: 'David Kim',
    role: 'Software Engineer',
    company: 'Meta',
    rating: 5,
    image: null
  },
  {
    id: 5,
    quote: "I've used this for my book cover, speaking engagements, and podcast appearances. One photo session, infinite uses. Brilliant.",
    name: 'Dr. Amanda Foster',
    role: 'Author & Speaker',
    company: 'Self-employed',
    rating: 5,
    image: null
  },
  {
    id: 6,
    quote: "The AI preserved my features perfectly while making me look more polished. It actually looks like me, just having a really good photo day.",
    name: 'Robert Williams',
    role: 'Attorney',
    company: 'Williams & Associates',
    rating: 5,
    image: null
  },
  {
    id: 7,
    quote: "I updated my dating profile with SnapStudio photos and my matches literally tripled. Not even exaggerating!",
    name: 'Chris Thompson',
    role: 'Product Designer',
    company: 'Design Co',
    rating: 5,
    image: null
  },
  {
    id: 8,
    quote: "The Noir style is absolutely stunning. As a musician, I needed something dramatic for my album art. SnapStudio delivered beyond my imagination.",
    name: 'Nina Rodriguez',
    role: 'Musician',
    company: 'Independent Artist',
    rating: 5,
    image: null
  },
  {
    id: 9,
    quote: "Finally, a headshot that makes me look approachable AND professional. My patients love seeing a friendly face on the website before their appointment.",
    name: 'Dr. James Park',
    role: 'Dentist',
    company: 'Park Family Dentistry',
    rating: 5,
    image: null
  }
];

export function Testimonials() {
  const [showAll, setShowAll] = useState(false);

  const displayedTestimonials = showAll ? testimonials : testimonials.slice(0, 6);
  const featuredTestimonials = testimonials.filter(t => t.featured);

  return (
    <section className="py-24 relative overflow-hidden" id="testimonials">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      {/* Decorative */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-6">
            <span className="material-symbols-outlined text-yellow-400 text-sm">star</span>
            <span className="text-sm text-yellow-300">4.9/5 from 10,000+ reviews</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Loved by <span className="gradient-text">Professionals</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Join thousands of satisfied customers who transformed their online presence
            with SnapStudio.
          </p>
        </div>

        {/* Featured testimonials */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {featuredTestimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="p-6 rounded-2xl bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 hover:border-indigo-500/30 transition-all duration-300"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-yellow-400 text-lg">star</span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-zinc-300 mb-6 leading-relaxed">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-zinc-500">{testimonial.role} at {testimonial.company}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* All testimonials grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedTestimonials.filter(t => !t.featured).map((testimonial) => (
            <div
              key={testimonial.id}
              className="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-3">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="material-symbols-outlined text-yellow-400 text-sm">star</span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm text-zinc-400 mb-4">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-300">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{testimonial.name}</p>
                  <p className="text-xs text-zinc-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Show more button */}
        {!showAll && testimonials.length > 6 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-medium transition-colors"
            >
              <span className="material-symbols-outlined text-lg">expand_more</span>
              Show More Reviews
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="mt-16 p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: '10,000+', label: 'Happy Customers', icon: 'groups' },
              { value: '4.9/5', label: 'Average Rating', icon: 'star' },
              { value: '100K+', label: 'Headshots Created', icon: 'photo_camera' },
              { value: '95%', label: 'Satisfaction Rate', icon: 'thumb_up' }
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <span className="material-symbols-outlined text-2xl text-indigo-400 mb-2 block">{stat.icon}</span>
                <div className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
