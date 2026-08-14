"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export default function IntroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        textRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
            end: "top 30%",
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
      className="relative min-h-screen flex items-center py-32 scroll-mt-16 snap-start"
    >
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div ref={textRef} className="opacity-0">
          <span className="text-[0.65rem] tracking-[0.3em] text-purple-500 font-bold block mb-4">
            01 / INTRODUCTION
          </span>
          <h2 className="text-4xl md:text-6xl font-black leading-[0.95] tracking-[-0.03em] mb-6">
            THE FUTURE
            <br />
            OF DIGITAL
            <br />
            OWNERSHIP
          </h2>
          <p className="text-white/40 text-sm leading-relaxed max-w-md">
            We believe in a world where digital art, collectibles, and assets
            live across multiple blockchains. Our platform unifies the
            fragmented NFT landscape into one seamless experience.
          </p>
        </div>

        <div className="relative">
          <div className="aspect-square border border-white/10 relative overflow-hidden">
            {/* Decorative grid */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="border border-white/5"
                  style={{
                    opacity: ((i * 37) % 50) / 100 + 0.1,
                    background:
                      i % 3 === 0
                        ? "rgba(108, 92, 231, 0.1)"
                        : i % 5 === 0
                        ? "rgba(0, 184, 148, 0.1)"
                        : "transparent",
                  }}
                />
              ))}
            </div>
            {/* Center accent */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border-2 border-purple-500/30 rotate-45" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
