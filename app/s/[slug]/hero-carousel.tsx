"use client";

import { useEffect, useRef, useState } from "react";
import { carouselIndexFromPosition, nextCarouselIndex, scrollCarouselTo } from "@/lib/carousel";

type HeroSlide = { imageUrl?: string; alt: string };

export function HeroCarousel({ slides, fallback, autoplay }: { slides: HeroSlide[]; fallback: string; autoplay: boolean }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const [interactionVersion, setInteractionVersion] = useState(0);

  useEffect(() => {
    if (!autoplay || hovered || interacting || slides.length < 2) return;
    const timer = window.setTimeout(() => {
      const next = nextCarouselIndex(active, slides.length);
      setActive(next);
      scrollCarouselTo(trackRef.current, next);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [active, autoplay, hovered, interacting, interactionVersion, slides.length]);

  function restartAutoplay() {
    setInteractionVersion((current) => current + 1);
  }

  function goTo(index: number) {
    setActive(index);
    restartAutoplay();
    scrollCarouselTo(trackRef.current, index);
  }

  function finishInteraction() {
    setInteracting(false);
    restartAutoplay();
  }

  return <section className="public-hero" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <div
      className="public-hero-track"
      ref={trackRef}
      onPointerDown={() => setInteracting(true)}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
      onScroll={(event) => {
        const clientWidth = event.currentTarget.clientWidth;
        const scrollLeft = event.currentTarget.scrollLeft;
        const index = carouselIndexFromPosition(clientWidth, scrollLeft);
        if (index !== null) setActive(index);
      }}
    >
      {slides.map((slide, index) => <div key={index}><img src={slide.imageUrl || fallback} alt={slide.alt}/><i>{index + 1} / {slides.length}</i></div>)}
    </div>
    <nav className="public-hero-dots" aria-label="轮播切换">
      {slides.map((_, index) => <button type="button" className={active === index ? "active" : ""} aria-label={`第 ${index + 1} 张`} onClick={() => goTo(index)} key={index}/>)}
    </nav>
  </section>;
}
