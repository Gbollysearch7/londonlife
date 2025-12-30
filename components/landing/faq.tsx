'use client';

import { useState } from 'react';

const faqCategories = [
  {
    id: 'general',
    name: 'General',
    icon: 'help'
  },
  {
    id: 'quality',
    name: 'Quality',
    icon: 'high_quality'
  },
  {
    id: 'privacy',
    name: 'Privacy',
    icon: 'lock'
  },
  {
    id: 'technical',
    name: 'Technical',
    icon: 'settings'
  }
];

const faqs = [
  {
    category: 'general',
    question: 'What is SnapStudio?',
    answer: 'SnapStudio is an AI-powered platform that transforms your ordinary selfies into professional-quality headshots. Using advanced AI technology, we create stunning photos suitable for LinkedIn, company websites, social media, and more — all in under 60 seconds.'
  },
  {
    category: 'general',
    question: 'How long does it take to generate a headshot?',
    answer: 'Most headshots are generated in under 60 seconds. The exact time may vary slightly based on the style selected and current server load, but you\'ll typically have your professional headshot ready in less than a minute.'
  },
  {
    category: 'general',
    question: 'Do I need any special equipment or photos?',
    answer: 'No special equipment needed! SnapStudio works with any selfie taken with your smartphone or webcam. Just make sure your face is clearly visible, well-lit, and facing the camera. Our AI handles the rest.'
  },
  {
    category: 'general',
    question: 'Can I use SnapStudio headshots commercially?',
    answer: 'Absolutely! All SnapStudio plans include full commercial usage rights. You can use your headshots for LinkedIn, company websites, marketing materials, business cards, and any other professional purpose.'
  },
  {
    category: 'quality',
    question: 'Will the headshot still look like me?',
    answer: 'Yes, 100%! Our AI uses advanced identity preservation technology to maintain your exact facial features, expressions, and unique characteristics. You\'ll look like you — just with professional studio lighting and a polished background.'
  },
  {
    category: 'quality',
    question: 'What resolution are the output images?',
    answer: 'We deliver high-resolution 4K images (up to 4096x4096 pixels) that are suitable for both digital use and print. This resolution works great for everything from social media profiles to large printed materials.'
  },
  {
    category: 'quality',
    question: 'How does SnapStudio compare to a professional photographer?',
    answer: 'Our AI produces results comparable to professional studio photography. While a skilled photographer brings artistic direction, SnapStudio offers consistent, professional-quality results at a fraction of the cost and time. Many users can\'t tell the difference!'
  },
  {
    category: 'quality',
    question: 'What if I don\'t like the result?',
    answer: 'Each generation includes multiple variations to choose from. If you\'re still not satisfied, you can regenerate with different settings or try a different style. We also offer a 7-day money-back guarantee if you\'re not happy with the overall quality.'
  },
  {
    category: 'privacy',
    question: 'What happens to my uploaded photos?',
    answer: 'Your privacy is our priority. Uploaded photos are processed securely and automatically deleted within 24 hours. We never use your photos for AI training, marketing, or any other purpose without your explicit consent.'
  },
  {
    category: 'privacy',
    question: 'Is my data secure?',
    answer: 'Yes. We use enterprise-grade encryption for all data transmission and storage. Your photos are processed in secure cloud environments and are never accessible to our staff unless you specifically request support.'
  },
  {
    category: 'privacy',
    question: 'Do you share my photos with third parties?',
    answer: 'Never. Your photos are yours alone. We do not sell, share, or use your photos for any purpose other than generating your headshots. See our Privacy Policy for complete details.'
  },
  {
    category: 'technical',
    question: 'What image formats are supported?',
    answer: 'We support all common image formats including JPG, PNG, and WebP. Files can be up to 10MB in size. For best results, upload a clear, well-lit photo where your face is clearly visible.'
  },
  {
    category: 'technical',
    question: 'Can I customize the background and lighting?',
    answer: 'Yes! Pro and Business plans include full customization options. You can choose from solid colors, gradients, or blurred backgrounds. You can also adjust lighting direction and intensity to get your perfect look.'
  },
  {
    category: 'technical',
    question: 'How many styles are available?',
    answer: 'We offer 18+ professional styles across four categories: Professional (Corporate, LinkedIn, Executive, Legal, Medical), Creative (Startup, Speaker, Influencer), Artistic (Noir, Neon, Golden Hour, High Fashion), and Specialty (Dating, Actor, Real Estate).'
  },
  {
    category: 'technical',
    question: 'Can I process multiple photos at once?',
    answer: 'Yes! Our Business plan includes batch processing, allowing you to upload and process multiple photos efficiently. This is perfect for teams or anyone needing multiple headshots at once.'
  }
];

export function FAQ() {
  const [activeCategory, setActiveCategory] = useState('general');
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);

  const filteredFaqs = faqs.filter(faq => faq.category === activeCategory);

  return (
    <section className="py-24 relative overflow-hidden" id="faq">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
            <span className="material-symbols-outlined text-blue-400 text-sm">quiz</span>
            <span className="text-sm text-blue-300">Got Questions?</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-lg text-zinc-400">
            Everything you need to know about SnapStudio
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {faqCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
                setOpenQuestion(null);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeCategory === category.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{category.icon}</span>
              {category.name}
            </button>
          ))}
        </div>

        {/* FAQ accordion */}
        <div className="space-y-3">
          {filteredFaqs.map((faq, index) => (
            <div
              key={index}
              className={`rounded-xl border overflow-hidden transition-all ${
                openQuestion === index
                  ? 'border-indigo-500/50 bg-zinc-900/80'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <button
                onClick={() => setOpenQuestion(openQuestion === index ? null : index)}
                className="w-full p-5 flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
              >
                <span className="font-medium text-left pr-4">{faq.question}</span>
                <span className={`material-symbols-outlined flex-shrink-0 transition-transform ${
                  openQuestion === index ? 'rotate-180 text-indigo-400' : 'text-zinc-500'
                }`}>
                  expand_more
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${
                openQuestion === index ? 'max-h-96' : 'max-h-0'
              }`}>
                <div className="p-5 pt-0">
                  <p className="text-zinc-400 leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="mt-12 p-8 rounded-2xl bg-zinc-800/50 border border-zinc-700 text-center">
          <span className="material-symbols-outlined text-4xl text-indigo-400 mb-4 block">support_agent</span>
          <h3 className="text-xl font-bold mb-2">Still have questions?</h3>
          <p className="text-zinc-400 mb-6">
            Can&apos;t find what you&apos;re looking for? Our support team is here to help.
          </p>
          <button className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors">
            <span className="material-symbols-outlined">mail</span>
            Contact Support
          </button>
        </div>
      </div>
    </section>
  );
}
