"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const OceanScene = dynamic(() => import("@/components/3d/OceanScene"), { ssr: false });
const PhotoRain = dynamic(() => import("@/components/PhotoRain"), { ssr: false });

export default function Home() {
  return (
    <div>Hello</div>
  );
}