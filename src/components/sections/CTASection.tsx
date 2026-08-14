"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function CTASection() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        textRef.current,
        { y: 60, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            toggleActions: "play none none reverse",
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-40 border-t border-white/5 overflow-hidden"
    >
      {/* Big background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span className="text-[20vw] font-black text-white/[0.02] tracking-[-0.05em] select-none">
          NFT
        </span>
      </div>

      <div ref={textRef} className="relative max-w-4xl mx-auto px-6 text-center opacity-0">
        <h2 className="text-5xl md:text-8xl font-black tracking-[-0.04em] mb-8 leading-[0.9]">
          START
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-green-400">
            COLLECTING
          </span>
        </h2>

        <p className="text-sm text-white/40 max-w-md mx-auto mb-12 leading-relaxed">
          Join the multi-chain NFT revolution. Explore, mint, and trade
          digital assets across the entire blockchain ecosystem.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="#chains"
            className="px-10 py-5 bg-white text-black font-bold text-xs tracking-[0.2em] hover:bg-purple-500 hover:text-white transition-all duration-300"
          >
            EXPLORE NOW
          </a>
          <a
            href="https://developers.stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="px-10 py-5 border-2 border-white/20 text-white font-bold text-xs tracking-[0.2em] hover:border-white hover:bg-white hover:text-black transition-all duration-300"
          >
            READ DOCS
          </a>
        </div>
      </div>
    </section>
  );
}
