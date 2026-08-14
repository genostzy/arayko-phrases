"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const PHRASE_IMAGES = [
  "/images/Phrase%231.jpg",
  "/images/Phrase%232.jpg",
  "/images/Phrase%233.jpg",
  "/images/Phrase%234.jpg",
  "/images/Phrase%235.jpg",
  "/images/Phrase%236.jpg",
];

export default function AboutSection() {
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
      id="about"
      ref={sectionRef}
      className="relative py-24 md:py-32 scroll-mt-16"
    >
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div ref={textRef} className="opacity-0">
          <span className="text-sm tracking-[0.3em] text-purple-500 font-bold block mb-4">
            01 / ABOUT
          </span>
          <h2 className="text-4xl md:text-6xl font-black leading-[0.95] tracking-[-0.03em] mb-6">
            SIX PHRASES.
            <br />
            ONE COLLECTION.
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-md">
            ArayKoPo NFT is a collection of iconic Phrases, minted fully
            on-chain on the Stellar network. Each token is a piece of the
            story — non-custodial, verifiable, and yours to keep, trade, or
            pass on.
          </p>
        </div>

        <div className="relative">
          <div className="grid grid-cols-3 gap-2 border border-white/10 p-2">
            {PHRASE_IMAGES.map((src) => (
              <div key={src} className="aspect-square overflow-hidden">
                <img
                  src={src}
                  alt="ArayKoPo Phrase NFT"
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
