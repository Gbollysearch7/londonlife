'use client';

import { useState } from 'react';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individuals who need a few headshots',
    price: 9,
    credits: 5,
    pricePerCredit: 1.8,
    features: [
      '5 headshot generations',
      'All 18+ professional styles',
      'High-resolution downloads (4K)',
      'Commercial usage rights',
      'Email support'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Best value for professionals and job seekers',
    price: 19,
    credits: 15,
    pricePerCredit: 1.27,
    features: [
      '15 headshot generations',
      'All 18+ professional styles',
      'High-resolution downloads (4K)',
      'Commercial usage rights',
      'Priority processing',
      'Background customization',
      'Multiple variations per generation',
      'Priority email support'
    ],
    cta: 'Get Pro',
    popular: true
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Ideal for teams and businesses',
    price: 39,
    credits: 50,
    pricePerCredit: 0.78,
    features: [
      '50 headshot generations',
      'All 18+ professional styles',
      'High-resolution downloads (4K)',
      'Commercial usage rights',
      'Fastest priority processing',
      'Full customization options',
      'Batch processing',
      'Team management',
      'Dedicated support',
      'Invoice billing'
    ],
    cta: 'Get Business',
    popular: false
  }
];

const faqs = [
  {
    question: 'What is a credit?',
    answer: 'One credit equals one headshot generation. Each generation can include up to 4 variations, so you get multiple options with each credit used.'
  },
  {
    question: 'Do credits expire?',
    answer: 'No, your credits never expire. Use them whenever you need a new headshot.'
  },
  {
    question: 'Can I get a refund?',
    answer: 'Yes! We offer a 100% money-back guarantee within 7 days if you\'re not satisfied with the quality of your headshots.'
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, MasterCard, American Express) and PayPal.'
  },
  {
    question: 'Can I use the headshots commercially?',
    answer: 'Absolutely! All plans include full commercial usage rights. Use your headshots on LinkedIn, company websites, marketing materials, and more.'
  },
  {
    question: 'Do you offer team/enterprise pricing?',
    answer: 'Yes! For teams larger than 10 people, contact us for custom enterprise pricing with additional features and support.'
  }
];

export function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className="py-24 relative overflow-hidden" id="pricing">
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />
      <div className="absolute inset-0 bg-grid opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <span className="material-symbols-outlined text-emerald-400 text-sm">payments</span>
            <span className="text-sm text-emerald-300">Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Choose Your <span className="gradient-text">Plan</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            No subscriptions, no hidden fees. Pay once and use your credits whenever you need them.
          </p>
        </div>

        {/* Pricing cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-3xl border transition-all duration-300 ${
                plan.popular
                  ? 'bg-gradient-to-b from-indigo-500/10 to-zinc-900/80 border-indigo-500/50 shadow-xl shadow-indigo-500/10 scale-105 z-10'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-semibold rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="p-8">
                {/* Plan name */}
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className="text-sm text-zinc-500 mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-zinc-500">one-time</span>
                  </div>
                  <div className="text-sm text-zinc-500 mt-1">
                    {plan.credits} credits • ${plan.pricePerCredit.toFixed(2)} per headshot
                  </div>
                </div>

                {/* CTA button */}
                <button
                  className={`w-full py-3 rounded-xl font-semibold transition-all mb-6 flex items-center justify-center gap-2 ${
                    plan.popular
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">shopping_cart</span>
                  {plan.cta}
                </button>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-emerald-400 text-lg mt-0.5">check_circle</span>
                      <span className="text-sm text-zinc-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Money back guarantee */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
            <span className="material-symbols-outlined text-emerald-400">verified_user</span>
            <span className="text-emerald-300 font-medium">100% Money-Back Guarantee — 7 Days, No Questions Asked</span>
          </div>
        </div>

        {/* FAQ section */}
        <div className="max-w-3xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h3>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-xl border border-zinc-800 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-5 flex items-center justify-between bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
                >
                  <span className="font-medium text-left">{faq.question}</span>
                  <span className={`material-symbols-outlined transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`}>
                    expand_more
                  </span>
                </button>
                {openFaq === index && (
                  <div className="p-5 pt-0 bg-zinc-900/50">
                    <p className="text-zinc-400">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border border-zinc-700 text-center">
          <h3 className="text-2xl font-bold mb-2">Need More?</h3>
          <p className="text-zinc-400 mb-6 max-w-xl mx-auto">
            For large teams or enterprise needs, we offer custom pricing with additional features,
            dedicated support, and flexible billing options.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors">
            <span className="material-symbols-outlined">contact_support</span>
            Contact Sales
          </button>
        </div>
      </div>
    </section>
  );
}
