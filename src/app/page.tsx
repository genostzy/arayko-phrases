"use client";

import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import MarketplaceSection from "@/components/sections/MarketplaceSection";
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
        <AboutSection />
        <MarketplaceSection />
      </main>
      <Footer />
    </>
  );
}