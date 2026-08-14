"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { chains, Chain } from "@/lib/chains";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function ChainCard({ chain, index }: { chain: Chain; index: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group relative border border-white/10 p-8 transition-all duration-500 cursor-pointer"
      style={{
        opacity: 0,
        animation: `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Color accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-500"
        style={{
          background: hovered ? chain.color : "transparent",
        }}
      />

      <div className="flex items-start justify-between mb-6">
        <div>
          <span
            className="text-3xl mb-3 block transition-transform duration-300"
            style={{ transform: hovered ? "scale(1.1)" : "scale(1)" }}
          >
            {chain.icon}
          </span>
          <h3 className="text-lg font-bold tracking-[0.1em]">{chain.name}</h3>
          <span
            className="text-[0.6rem] tracking-[0.15em] font-medium"
            style={{ color: chain.color }}
          >
            {chain.ecosystem}
          </span>
        </div>
        <span className="text-[0.6rem] tracking-[0.15em] text-white/20 border border-white/10 px-2 py-1">
          {chain.type.toUpperCase()}
        </span>
      </div>

      <p className="text-sm text-white/30 leading-relaxed mb-6">
        {chain.description}
      </p>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
        <div>
          <span className="text-[0.55rem] tracking-[0.15em] text-white/20 block mb-1">
            NFTS
          </span>
          <span className="text-sm font-bold">{chain.nftCount}</span>
        </div>
        <div>
          <span className="text-[0.55rem] tracking-[0.15em] text-white/20 block mb-1">
            VOLUME
          </span>
          <span className="text-sm font-bold">{chain.volume}</span>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <a
          href={chain.explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 border border-white/10 text-[0.65rem] tracking-[0.15em] text-white/40 hover:text-white hover:border-white/30 transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          EXPLORE
        </a>
        <a
          href={chain.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center py-2 text-[0.65rem] tracking-[0.15em] transition-all"
          style={{
            background: hovered ? chain.color : "transparent",
            border: `1px solid ${hovered ? chain.color : "rgba(255,255,255,0.1)"}`,
            color: hovered ? "white" : "rgba(255,255,255,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          WEBSITE
        </a>
      </div>
    </div>
  );
}

export default function ChainsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [filter, setFilter] = useState<"all" | "evm" | "non-evm">("all");

  const filteredChains =
    filter === "all" ? chains : chains.filter((c) => c.type === filter);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".chains-title",
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 70%",
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
      id="chains"
      className="relative min-h-screen flex flex-col justify-center py-32 border-t border-white/5 scroll-mt-16 snap-start"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="chains-title">
            <span className="text-[0.65rem] tracking-[0.3em] text-purple-500 font-bold block mb-4">
              03 / ECOSYSTEM
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-0.03em]">
              BROWSE
              <br />
              EVERY CHAIN
            </h2>
          </div>

          {/* Filter */}
          <div className="flex gap-2">
            {(["all", "evm", "non-evm"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-[0.65rem] tracking-[0.15em] font-bold border transition-all ${
                  filter === f
                    ? "border-white bg-white text-black"
                    : "border-white/10 text-white/40 hover:border-white/30"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5" key={filter}>
          {filteredChains.map((chain, i) => (
            <ChainCard key={chain.id} chain={chain} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
