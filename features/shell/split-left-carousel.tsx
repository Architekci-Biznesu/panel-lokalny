"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export type CarouselSlide = {
  src: string;
  alt: string;
};

const INTERVAL_MS = 5500;

export function SplitLeftCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="split-carousel" aria-roledescription="karuzela">
      {slides.map((slide, i) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={slide.alt}
          fill
          priority={i === 0}
          className={`split-left-image split-carousel-slide${
            i === index ? " is-active" : ""
          }`}
          sizes="(max-width: 900px) 100vw, 50vw"
        />
      ))}
      {slides.length > 1 ? (
        <div className="split-carousel-dots" role="tablist" aria-label="Slajdy">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Slajd ${i + 1}`}
              className={`split-carousel-dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
