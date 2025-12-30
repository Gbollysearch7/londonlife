import { PricingCards } from "@/components/pricing-cards";

export default function PricingPage() {
  return (
    <div className="min-h-screen pt-24 pb-16 bg-[#09090b]">
      {/* Background Effects */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
            <span className="material-symbols-outlined text-[18px]">payments</span>
            <span>Simple, transparent pricing</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Choose Your <span className="gradient-text">Plan</span>
          </h1>
          <p className="text-[#71717a] text-lg max-w-2xl mx-auto">
            Get professional AI headshots at a fraction of the cost of traditional photography.
            One credit equals one AI-generated image.
          </p>
        </div>

        {/* Pricing Cards */}
        <PricingCards />

        {/* Features Section */}
        <div className="mt-24">
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="w-1.5 h-8 bg-indigo-500 rounded-full" />
            <h2 className="text-2xl font-bold text-white">What&apos;s Included</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                icon: "all_inclusive",
                title: "Credits Never Expire",
                description: "Use your credits whenever you want, they're yours forever"
              },
              {
                icon: "high_quality",
                title: "High Resolution",
                description: "Download your headshots in stunning 2K quality"
              },
              {
                icon: "palette",
                title: "7 Unique Styles",
                description: "From professional to artistic, find your perfect look"
              },
              {
                icon: "bolt",
                title: "Instant Generation",
                description: "Get your results in under 30 seconds"
              },
              {
                icon: "download",
                title: "Unlimited Downloads",
                description: "Download your images as many times as you want"
              },
              {
                icon: "verified_user",
                title: "Privacy Focused",
                description: "Your photos are processed securely and not stored"
              },
            ].map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-xl bg-[#18181b] border border-[#27272a]">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-indigo-400 text-[20px]">{feature.icon}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-[#71717a]">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="w-1.5 h-8 bg-emerald-500 rounded-full" />
            <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            {[
              {
                question: "How does the credit system work?",
                answer: "One credit equals one AI-generated image. When you purchase a plan, you receive a set number of credits that you can use to generate professional headshots in any of our 7 styles."
              },
              {
                question: "Do credits expire?",
                answer: "No! Your credits never expire. Use them whenever you're ready - they'll always be available in your account."
              },
              {
                question: "Can I get a refund?",
                answer: "Yes, we offer refunds within 24 hours of purchase if you haven't used any of your credits. Once credits are used, they cannot be refunded."
              },
              {
                question: "How long does generation take?",
                answer: "Most headshots are generated in 10-30 seconds. The exact time depends on server load and the complexity of the style you choose."
              },
              {
                question: "What image formats are supported?",
                answer: "You can upload JPG, PNG, or WebP images up to 10MB. Generated headshots are provided in high-quality PNG format."
              },
            ].map((faq, index) => (
              <div key={index} className="p-6 rounded-2xl border border-[#27272a] bg-[#18181b] hover:border-[#3f3f46] transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center mt-0.5">
                    <span className="material-symbols-outlined text-emerald-500 text-[14px]">help</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-2">{faq.question}</h3>
                    <p className="text-[#a1a1aa] text-sm leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
