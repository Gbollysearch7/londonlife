import { Navbar } from '@/components/landing/navbar';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { BeforeAfter } from '@/components/landing/before-after';
import { StyleShowcase } from '@/components/landing/style-showcase';
import { UseCases } from '@/components/landing/use-cases';
import { Features } from '@/components/landing/features';
import { Comparison } from '@/components/landing/comparison';
import { Testimonials } from '@/components/landing/testimonials';
import { Pricing } from '@/components/landing/pricing';
import { FAQ } from '@/components/landing/faq';
import { FinalCTA } from '@/components/landing/final-cta';
import { Footer } from '@/components/landing/footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <Hero />
      <HowItWorks />
      <BeforeAfter />
      <StyleShowcase />
      <UseCases />
      <Features />
      <Comparison />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
