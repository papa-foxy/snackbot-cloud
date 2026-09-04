import React from 'react';

interface AmbientCanvasProps {
  children: React.ReactNode;
}

export function AmbientCanvas({ children }: AmbientCanvasProps) {
  return (
    <div
      className="login-bg relative min-h-screen flex items-center justify-center p-4 md:p-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F0E0D 0%, #181412 25%, #0F0E0D 50%, #15110E 75%, #0F0E0D 100%)',
      }}
    >
      {/* ── Grain texture overlay ──────────────────────────────────────────────── */}
      <div
        className="grain pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '200px 200px',
          mixBlendMode: 'overlay',
        }}
      />

      {/* ── Restaurant spotlight beams ─────────────────────────────────────────── */}
      <div
        className="beam pointer-events-none absolute top-0 left-1/4 h-full z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(194,142,56,0.15) 0%, transparent 70%)',
          width: '180px',
          marginLeft: '-90px',
        }}
      />
      <div
        className="beam pointer-events-none absolute top-0 right-1/4 h-full z-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(146,64,14,0.12) 0%, transparent 65%)',
          width: '220px',
          marginRight: '-110px',
          animationDelay: '6s',
        }}
      />

      {/* ── Candlelight glowing orbs ───────────────────────────────────────────── */}
      {/* Top-left burnished gold — open candle flame */}
      <div
        className="orb-1 pointer-events-none absolute -top-32 -left-32 z-0 rounded-full blur-3xl"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(194,142,56,0.28) 0%, rgba(146,64,14,0.15) 50%, transparent 70%)',
        }}
      />
      {/* Bottom-right smoked bronze — ember glow on the pass */}
      <div
        className="orb-2 pointer-events-none absolute -bottom-40 -right-40 z-0 rounded-full blur-3xl"
        style={{
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(146,64,14,0.25) 0%, rgba(67,40,24,0.15) 50%, transparent 70%)',
        }}
      />
      {/* Centre-top vintage brass — backlit espresso bar shelves */}
      <div
        className="orb-3 pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-0 rounded-full blur-3xl"
        style={{
          width: '700px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(217,142,56,0.10) 0%, rgba(180,83,9,0.05) 50%, transparent 70%)',
        }}
      />

      {children}
    </div>
  );
}
