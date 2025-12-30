"use client";

import Link from "next/link";

const pricingPlans = [
  {
    name: "Starter",
    price: 9,
    credits: 5,
    features: [
      "5 AI-generated images",
      "High-resolution downloads",
      "All 7 style options",
      "Instant generation",
    ],
    popular: false,
  },
  {
    name: "Basic",
    price: 19,
    credits: 20,
    features: [
      "20 AI-generated images",
      "High-resolution downloads",
      "All 7 style options",
      "Instant generation",
      "Priority processing",
    ],
    popular: true,
  },
  {
    name: "Pro",
    price: 29,
    credits: 40,
    features: [
      "40 AI-generated images",
      "High-resolution downloads",
      "All 7 style options",
      "Instant generation",
      "Priority processing",
      "4K resolution option",
    ],
    popular: false,
  },
];

export function PricingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
      {pricingPlans.map((plan) => (
        <div
          key={plan.name}
          className={`relative bg-[#18181b] border rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] card-hover ${
            plan.popular
              ? "border-indigo-500/50 shadow-xl shadow-indigo-500/10"
              : "border-[#27272a]"
          }`}
        >
          {/* Popular Badge */}
          {plan.popular && (
            <div className="absolute top-0 right-0">
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-xs font-bold px-3 py-1.5 rounded-bl-xl">
                Most Popular
              </div>
            </div>
          )}

          {/* Header */}
          <div className="p-6 text-center border-b border-[#27272a]">
            <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
            <p className="text-sm text-[#71717a]">{plan.credits} credits</p>
          </div>

          {/* Price */}
          <div className="p-6 text-center">
            <span className="text-5xl font-bold text-white">${plan.price}</span>
            <span className="text-[#71717a] ml-2">one-time</span>
          </div>

          {/* Features */}
          <div className="px-6 pb-6">
            <ul className="space-y-3">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-3 text-sm text-[#a1a1aa]">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-indigo-400 text-[14px]">check</span>
                  </div>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* CTA Button */}
          <div className="p-6 pt-0">
            <Link
              href="/generate"
              className={`flex items-center justify-center w-full py-3 rounded-xl font-semibold transition-all ${
                plan.popular
                  ? "bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-[#27272a] hover:bg-[#3f3f46] text-white border border-[#3f3f46]"
              }`}
            >
              {plan.popular && (
                <span className="material-symbols-outlined text-[18px] mr-2">auto_awesome</span>
              )}
              Get Started
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
