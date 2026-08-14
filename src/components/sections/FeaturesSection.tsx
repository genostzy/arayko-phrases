"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const features = [
  {
    number: "01",
    title: "MULTI-CHAIN",
    description: "Browse NFTs across Ethereum, Solana, Stellar, Polygon, Base, and Bitcoin. One interface for all chains.",
    icon: "⬡",
  },
  {
    number: "02",
    title: "REAL-TIME",
    description: "Live metadata, floor prices, and ownership data synced across all supported blockchains.",
    icon: "◈",
  },
  {
    number: "03",
    title: "SECURE",
    description: "Non-custodial wallet integration. Your keys, your assets. We never hold your funds.",
    icon: "◆",
  },
  {
    number: "04",
    title: "OPEN",
    description: "Built on open standards. IPFS metadata, on-chain provenance, and decentralized storage.",
    icon: "◇",
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.children;
      if (!cards) return;

      gsap.fromTo(
        Array.from(cards),
        { y: 80, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            end: "top 20%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="relative min-h-screen flex flex-col justify-center py-32 border-t border-white/5 scroll-mt-16 snap-start">
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-20">
          <span className="text-[0.65rem] tracking-[0.3em] text-green-500 font-bold block mb-4">
            02 / FEATURES
          </span>
          <h2 className="text-4xl md:text-6xl font-black tracking-[-0.03em]">
            BUILT FOR
            <br />
            THE ECOSYSTEM
          </h2>
        </div>

        <div ref={cardsRef} className="grid md:grid-cols-2 gap-px bg-white/5">
          {features.map((feature) => (
            <div
              key={feature.number}
              className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors duration-500"
            >
              <div className="flex items-start justify-between mb-8">
                <span className="text-[0.6rem] tracking-[0.2em] text-white/20">
                  {feature.number}
                </span>
                <span className="text-2xl text-white/20 group-hover:text-purple-500 transition-colors duration-300">
                  {feature.icon}
                </span>
              </div>
              <h3 className="text-xl font-bold tracking-[0.1em] mb-4">
                {feature.title}
              </h3>
              <p className="text-sm text-white/30 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
