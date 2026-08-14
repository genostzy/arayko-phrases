"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { scrollToSection } from "@/lib/scrollToSection";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { y: 80, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.3 }
      );
      gsap.fromTo(
        subRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: "power3.out", delay: 0.6 }
      );
      gsap.fromTo(
        ctaRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.9 }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden scroll-mt-16"
    >
      {/* Gradient overlays */}
      <div className="absolute inset-0 z-[1]">
        <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="absolute top-0 left-0 right-0 h-[20%] bg-gradient-to-b from-[#0a0a0a]/50 to-transparent" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-sm tracking-[0.2em] text-white/60 mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            ARAYKOPO NFT COLLECTION
          </div>
        </div>

        <h1
          ref={titleRef}
          className="text-[clamp(3rem,12vw,9rem)] font-black leading-[0.85] tracking-[-0.04em] mb-8 opacity-0"
        >
          <span className="block">ARAYKOPO</span>
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-green-400">
            PHRASES
          </span>
          <span className="block">COLLECTION</span>
        </h1>

        <p
          ref={subRef}
          className="text-base md:text-lg text-white/50 tracking-[0.1em] uppercase max-w-xl mx-auto mb-12 opacity-0"
        >
          Mint, own, and trade iconic Phrase NFTs, fully on-chain on the
          Stellar network.
        </p>

        <div ref={ctaRef} className="flex gap-4 justify-center flex-wrap opacity-0">
          <a
            href="#marketplace"
            onClick={(e) => scrollToSection(e, "marketplace")}
            className="px-8 py-4 bg-white text-black font-bold text-sm tracking-[0.2em] hover:bg-purple-500 hover:text-white transition-all duration-300"
          >
            MINT NOW
          </a>
          <a
            href="#marketplace"
            onClick={(e) => scrollToSection(e, "marketplace")}
            className="px-8 py-4 border-2 border-white/20 text-white font-bold text-sm tracking-[0.2em] hover:border-white hover:bg-white hover:text-black transition-all duration-300"
          >
            CONNECT WALLET
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <span className="text-xs tracking-[0.3em] text-white/40">SCROLL</span>
        <div className="w-[1px] h-8 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
      </div>
    </section>
  );
}
