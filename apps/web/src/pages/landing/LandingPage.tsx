import { Hero } from './Hero';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { Pricing } from './Pricing';
import { Testimonials } from './Testimonials';
import { FinalCTA } from './FinalCTA';

export function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FinalCTA />
    </>
  );
}
