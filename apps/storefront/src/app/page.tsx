import "./home.css";
import "./sp-home.css";
import { SpRobotHero } from "@/components/sp-robot-hero";
import { SpChannelStory } from "@/components/sp-channel-story";
import { SpDemoSection } from "@/components/sp-demo-section";
import { SpProductIntelligence } from "@/components/sp-product-intelligence";
import { SpHumanHandoff } from "@/components/sp-human-handoff";
import { SpMerchantVisibility } from "@/components/sp-merchant-visibility";
import { SpPricingAndFaq } from "@/components/sp-pricing-faq";
import { SpFinalCTA } from "@/components/sp-final-cta";

export default function HomePage() {
  return (
    <main className="sp-home">
      {/* 1. Hero — 3D Robot */}
      <SpRobotHero />

      {/* 2. Problem / Channel Story */}
      <SpChannelStory />

      {/* 3. See SellPilot in Action — Phone Demo */}
      <SpDemoSection />

      {/* 4. Product Intelligence */}
      <SpProductIntelligence />

      {/* 5. Human Handoff */}
      <SpHumanHandoff />

      {/* 6. Merchant Visibility */}
      <SpMerchantVisibility />

      {/* 7. Pricing + FAQ */}
      <SpPricingAndFaq />

      {/* 8. Final CTA */}
      <SpFinalCTA />
    </main>
  );
}
