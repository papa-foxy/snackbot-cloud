import React, { useState, useEffect } from 'react';
import { cn } from '../../../utils/cn';
import type { CarouselSlide } from '../types';

const DEFAULT_SLIDES: CarouselSlide[] = [
  {
    img: '/login-food-showcase.jpg',
    alt: 'Artisan pasta carbonara and bruschetta',
    tag: '● Live Kitchen Telemetry',
    head: 'Crafted for culinary flow.',
    body: 'From table ordering to automated kitchen routing, keep every dish moving and every station synced in real time.',
  },
  {
    img: '/login-food-slide2.jpg',
    alt: 'Seared wagyu steak with herb butter',
    tag: '● Real-Time Orders',
    head: 'Every order. Every station.',
    body: 'Tickets fly from table to kitchen in milliseconds. No missed orders, no cold plates, no wasted service.',
  },
  {
    img: '/login-food-slide3.jpg',
    alt: 'Latte art and fresh croissants at a café',
    tag: '● Multi-Branch Control',
    head: 'One cloud. All your outlets.',
    body: 'Manage menus, staff, inventory and reports across every branch from a single unified dashboard.',
  },
];

interface FoodCarouselProps {
  slides?: CarouselSlide[];
  intervalMs?: number;
}

export function FoodCarousel({
  slides = DEFAULT_SLIDES,
  intervalMs = 4000,
}: FoodCarouselProps) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  const current = slides[slide];

  return (
    <div className="relative h-full min-h-[580px] rounded-2xl overflow-hidden flex flex-col justify-end p-8 text-white">
      {/* Cross-fading image stack */}
      {slides.map((s, i) => (
        <img
          key={s.img}
          src={s.img}
          alt={s.alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-700',
            i === slide ? 'opacity-100' : 'opacity-0'
          )}
        />
      ))}

      {/* Dark gradient scrim for strong text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0F0E0D] via-[#0F0E0D]/60 to-transparent" />

      {/* Content overlay */}
      <div className="relative z-10">
        {/* Slide indicator dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i === slide ? 'w-8 bg-white' : 'w-3 bg-white/40 hover:bg-white/60'
              )}
            />
          ))}
        </div>

        {/* Category tag */}
        <span
          key={`tag-${slide}`}
          className="inline-block bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase mb-3 text-[#FDE68A] border border-white/20 animate-fadeIn"
        >
          {current.tag}
        </span>

        {/* Headline */}
        <h2 key={`head-${slide}`} className="text-2xl font-bold leading-snug animate-fadeIn text-white">
          {current.head}
        </h2>

        {/* Supporting copy */}
        <p key={`body-${slide}`} className="text-xs text-slate-200 mt-2 leading-relaxed max-w-xs animate-fadeIn">
          {current.body}
        </p>
      </div>
    </div>
  );
}
