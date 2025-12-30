'use client';

import { useState } from 'react';

const steps = [
  {
    number: '01',
    title: 'Upload Your Selfie',
    description: 'Take a photo or upload any existing selfie. Our AI works with any lighting, any background, any angle. Just make sure your face is clearly visible.',
    icon: 'cloud_upload',
    color: 'indigo',
    details: [
      'Supports JPG, PNG, WebP up to 10MB',
      'Works with selfies, phone photos, or webcam shots',
      'AI automatically detects and enhances your face',
      'No professional camera required'
    ]
  },
  {
    number: '02',
    title: 'Choose Your Style',
    description: 'Select from 18+ professional styles. From corporate executive to creative artist, we have the perfect look for every occasion and industry.',
    icon: 'style',
    color: 'purple',
    details: [
      'Professional: Corporate, LinkedIn, Executive, Legal, Medical',
      'Creative: Startup Founder, Speaker, Influencer',
      'Artistic: Noir, Neon, Golden Hour, High Fashion',
      'Specialty: Dating, Actor, Real Estate'
    ]
  },
  {
    number: '03',
    title: 'AI Magic Happens',
    description: 'Our advanced AI transforms your photo in under 60 seconds. Professional lighting, perfect background, and studio-quality results — all while preserving your unique features.',
    icon: 'auto_awesome',
    color: 'pink',
    details: [
      'Identity preservation technology keeps you recognizable',
      'Professional lighting simulation',
      'Smart background generation',
      'Natural skin texture — no fake smoothing'
    ]
  },
  {
    number: '04',
    title: 'Download & Use',
    description: 'Download your professional headshot in high resolution. Use it on LinkedIn, your company website, social media, or print it for your office.',
    icon: 'download',
    color: 'emerald',
    details: [
      'High-resolution 4K output',
      'Multiple format options (PNG, JPG, WebP)',
      'Commercial usage rights included',
      'Unlimited downloads'
    ]
  }
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="py-24 relative overflow-hidden" id="how-it-works">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-30" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
            <span className="material-symbols-outlined text-purple-400 text-sm">play_circle</span>
            <span className="text-sm text-purple-300">Simple 4-Step Process</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            From selfie to professional headshot in under 2 minutes.
            No photography skills required.
          </p>
        </div>

        {/* Steps timeline */}
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: Step cards */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                onClick={() => setActiveStep(index)}
                className={`group cursor-pointer relative p-6 rounded-2xl border transition-all duration-300 ${
                  activeStep === index
                    ? 'bg-zinc-800/80 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : 'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'
                }`}
              >
                {/* Connection line */}
                {index < steps.length - 1 && (
                  <div className="absolute left-10 top-full w-0.5 h-4 bg-zinc-800" />
                )}

                <div className="flex gap-4">
                  {/* Number/Icon */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center transition-all ${
                    activeStep === index
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">{step.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-indigo-400">{step.number}</span>
                      <h3 className="font-semibold text-lg">{step.title}</h3>
                    </div>
                    <p className="text-sm text-zinc-400">{step.description}</p>
                  </div>

                  {/* Arrow */}
                  <div className={`flex-shrink-0 self-center transition-transform ${
                    activeStep === index ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'
                  }`}>
                    <span className="material-symbols-outlined text-indigo-400">arrow_forward</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Active step details */}
          <div className="lg:sticky lg:top-24">
            <div className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl border border-zinc-800 p-8 shadow-xl">
              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl text-white">
                    {steps[activeStep].icon}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-mono text-indigo-400">Step {steps[activeStep].number}</span>
                  <h3 className="text-xl font-bold">{steps[activeStep].title}</h3>
                </div>
              </div>

              {/* Visual demo area */}
              <div className="aspect-video bg-zinc-800/50 rounded-2xl border border-zinc-700 mb-6 overflow-hidden relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  {activeStep === 0 && (
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-4 rounded-full border-4 border-dashed border-zinc-600 flex items-center justify-center animate-pulse">
                        <span className="material-symbols-outlined text-4xl text-zinc-500">add_a_photo</span>
                      </div>
                      <p className="text-sm text-zinc-500">Drop your photo here</p>
                    </div>
                  )}
                  {activeStep === 1 && (
                    <div className="grid grid-cols-3 gap-3 p-4">
                      {['Corporate', 'Creative', 'Artistic', 'LinkedIn', 'Startup', 'Noir'].map((style, i) => (
                        <div
                          key={style}
                          className={`p-3 rounded-xl text-center text-xs font-medium transition-all ${
                            i === 0 ? 'bg-indigo-600 text-white scale-105' : 'bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {style}
                        </div>
                      ))}
                    </div>
                  )}
                  {activeStep === 2 && (
                    <div className="text-center">
                      <div className="relative w-32 h-32 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
                        <div className="absolute inset-2 rounded-full bg-indigo-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-3xl text-indigo-400">auto_awesome</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400">AI processing your headshot...</p>
                      <p className="text-xs text-zinc-600 mt-1">~45 seconds remaining</p>
                    </div>
                  )}
                  {activeStep === 3 && (
                    <div className="text-center">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-emerald-400">check_circle</span>
                      </div>
                      <p className="text-sm text-zinc-300 font-medium">Your headshot is ready!</p>
                      <div className="flex gap-2 justify-center mt-4">
                        <button className="px-4 py-2 bg-indigo-600 rounded-lg text-sm font-medium">
                          Download PNG
                        </button>
                        <button className="px-4 py-2 bg-zinc-700 rounded-lg text-sm font-medium">
                          Share
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Details list */}
              <div className="space-y-3">
                {steps[activeStep].details.map((detail, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-indigo-400 text-lg mt-0.5">check_circle</span>
                    <span className="text-sm text-zinc-300">{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <a
            href="/dashboard/create"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            Try It Now — Free
          </a>
          <p className="mt-3 text-sm text-zinc-500">No credit card required • 3 free headshots</p>
        </div>
      </div>
    </section>
  );
}
