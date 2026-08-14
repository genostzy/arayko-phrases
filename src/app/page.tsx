"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import IntroSection from "@/components/sections/IntroSection";
import FeaturesSection from "@/components/sections/FeaturesSection";
import ChainsSection from "@/components/sections/ChainsSection";
import Web3Section from "@/components/sections/Web3Section";
import CTASection from "@/components/sections/CTASection";
import Footer from "@/components/sections/Footer";

const OceanScene = dynamic(() => import("@/components/3d/OceanScene"), { ssr: false });
const PhotoRain = dynamic(() => import("@/components/PhotoRain"), { ssr: false });

export default function Home() {
  return (
    <>
      <OceanScene />
      <PhotoRain />
      <Navbar />
      <main className="relative z-10">
        <HeroSection />
        <IntroSection />
        <FeaturesSection />
        <ChainsSection />
        <Web3Section />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}