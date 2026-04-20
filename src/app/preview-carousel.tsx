"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const slides = [
  {
    src: "/dashboard-preview.jpg",
    alt: "Atlas Dashboard — task overview, events, and care alerts",
  },
  {
    src: "/preview-serve.jpg",
    alt: "Serve — scheduling, staffing, and volunteer management",
  },
  {
    src: "/preview-canvas-editor.jpg",
    alt: "Atlas AI — visual workflow canvas editor",
  },
  {
    src: "/preview-ministry-hub.jpg",
    alt: "Ministry Hub — manage all your church ministries",
  },
  {
    src: "/preview-calendar.jpg",
    alt: "Calendar — all your events in one place",
  },
];

/*
 * Layout: the carousel fills 100 % of its parent's height.
 * Each slide image takes up SLIDE_H % of the panel, centered vertically.
 * Adjacent slides peek into the top / bottom zones, dimmed.
 *
 * Scroll direction: top → bottom (new slides enter from above).
 */
const SLIDE_H = 36; // % of container — wider/more rectangular for detail
const GAP = 6; // % gap between slides
const STEP = SLIDE_H + GAP; // distance between adjacent slide positions
const CENTER = (100 - SLIDE_H) / 2; // top offset to center a slide (25%)

export function PreviewCarousel() {
  const [current, setCurrent] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const total = slides.length;

  /* Auto-advance: 4 s rest, then scroll to next */
  useEffect(() => {
    if (isScrolling) return;
    const id = setTimeout(() => setIsScrolling(true), 4000);
    return () => clearTimeout(id);
  }, [isScrolling, current]);

  /* After CSS transition finishes, commit the index change */
  useEffect(() => {
    if (!isScrolling) return;
    const id = setTimeout(() => {
      setCurrent((c) => (c + 1) % total);
      setIsScrolling(false);
    }, 600);
    return () => clearTimeout(id);
  }, [isScrolling, total]);

  return (
    <div className="absolute inset-0 animate-fade-in-delay-1">
      {/* Slide strip — full panel */}
      <div className="relative h-full w-full">
        {slides.map((slide, i) => {
          /* Signed circular distance: +1 = next (above), −1 = prev (below) */
          const fwd = (i - current + total) % total;
          const bwd = (current - i + total) % total;
          const diff = fwd <= bwd ? fwd : -bwd;

          if (Math.abs(diff) > 2) return null;

          const baseTop = CENTER - diff * STEP;
          const top = isScrolling ? baseTop + STEP : baseTop;

          const distFromCenter = Math.abs(top - CENTER);
          const opacity =
            distFromCenter < 1 ? 1 : distFromCenter <= STEP ? 0.25 : 0;

          return (
            <div
              key={i}
              className="absolute inset-x-0 px-8 xl:px-12"
              style={{
                height: `${SLIDE_H}%`,
                top: `${top}%`,
                opacity,
                transition: isScrolling
                  ? "top 600ms cubic-bezier(0.33, 1, 0.68, 1), opacity 600ms cubic-bezier(0.33, 1, 0.68, 1)"
                  : "none",
              }}
            >
              <div className="relative h-full w-full overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/5">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  className="object-cover object-top"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  priority={i === 0}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Gradient fades at top and bottom edges */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[18%] bg-gradient-to-b from-surface to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[18%] bg-gradient-to-t from-surface to-transparent" />

      {/* Dot indicators — anchored to the bottom */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 bg-[#5CE1A5]"
                : "w-2 bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
