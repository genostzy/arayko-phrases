"use client";

import { useEffect, useState } from "react";

const PHOTOS = [
  "/images/Malupiton1-removebg-preview.png",
  "/images/Malupiton2-removebg-preview.png",
  "/images/Malupiton3-removebg-preview.png",
  "/images/Malupiton4-removebg-preview.png",
  "/images/Malupiton5-removebg-preview.png",
  "/images/Malupiton6-removebg-preview.png",
];

interface FallingPhoto {
  id: number;
  src: string;
  x: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
  swayAmount: number;
  opacity: number;
}

function createPhoto(index: number, id: number): FallingPhoto {
  return {
    id,
    src: PHOTOS[index % PHOTOS.length],
    x: Math.random() * 100,
    size: 40 + Math.random() * 60,
    delay: Math.random() * 20,
    duration: 12 + Math.random() * 10,
    rotation: Math.random() * 360,
    swayAmount: 20 + Math.random() * 40,
    opacity: 0.15 + Math.random() * 0.25,
  };
}

export default function PhotoRain() {
  const [photos, setPhotos] = useState<FallingPhoto[]>([]);

  useEffect(() => {
    const initial: FallingPhoto[] = [];
    for (let i = 0; i < 18; i++) {
      initial.push(createPhoto(i, i));
    }
    setPhotos(initial);

    let nextId = 18;
    const interval = setInterval(() => {
      setPhotos((prev) => {
        const updated = prev.slice(1);
        updated.push(createPhoto(nextId % PHOTOS.length, nextId));
        nextId++;
        return updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="absolute"
          style={{
            left: `${photo.x}%`,
            top: "-80px",
            width: photo.size,
            height: photo.size,
            opacity: photo.opacity,
            animation: `photoFall ${photo.duration}s linear ${photo.delay}s infinite`,
            "--sway": `${photo.swayAmount}px`,
            "--rot": `${photo.rotation}deg`,
          } as React.CSSProperties}
        >
          <img
            src={photo.src}
            alt=""
            className="w-full h-full object-contain drop-shadow-lg"
            style={{
              filter: "saturate(0.7) brightness(0.8)",
              transform: `rotate(${photo.rotation}deg)`,
            }}
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}
