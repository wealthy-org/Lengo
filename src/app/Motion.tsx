"use client";
import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export default function Motion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.09 });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const ctx = gsap.context(() => {
      // section heads: lines slide up from a mask
      gsap.utils.toArray<HTMLElement>("[data-split] > span").forEach((el) => {
        gsap.from(el, { yPercent: 100, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 88%" } });
      });
      // generic reveal
      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      });
      // staggered children
      gsap.utils.toArray<HTMLElement>("[data-stagger]").forEach((el) => {
        gsap.from(el.children, { y: 24, opacity: 0, duration: 0.8, stagger: 0.07, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 82%" } });
      });
      // hatched rules draw in
      gsap.utils.toArray<HTMLElement>("[data-rule]").forEach((el) => {
        gsap.from(el, { scaleX: 0, transformOrigin: "left", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } });
      });
      // horizontal roadmap
      const track = document.querySelector<HTMLElement>("[data-htrack]");
      const wrap = document.querySelector<HTMLElement>("[data-hwrap]");
      if (track && wrap && window.innerWidth > 900) {
        gsap.to(track, {
          x: () => -(track.scrollWidth - wrap.clientWidth),
          ease: "none",
          scrollTrigger: { trigger: wrap, start: "top 18%", end: () => "+=" + (track.scrollWidth - wrap.clientWidth), pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
      }
      // hero parallax
      gsap.to("[data-hero-mark]", { yPercent: 18, scale: 0.92, ease: "none", scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: true } });
    });
    return () => { ctx.revert(); gsap.ticker.remove(raf); lenis.destroy(); };
  }, []);
  return null;
}
