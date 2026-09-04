/**
 * TableOrderPage.tsx
 *
 * Route this component at:
 *   /order            → reads ?table=T01&token=xxx   (static QR)
 *   /qr/:shortCode    → resolves short code → redirects to /order?table=...
 *
 * Drop both routes into your React Router config:
 *
 *   <Route path="/order"        element={<TableOrderPage />} />
 *   <Route path="/qr/:shortCode" element={<QrRedirect />} />  ← tiny resolver below
 */

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

// ─── Native URL helpers (no React Router needed) ─────────────────────────────
function getSearchParam(key: string): string {
  return new URLSearchParams(window.location.search).get(key) ?? '';
}

function navigateTo(url: string, replace = false) {
  if (replace) {
    window.history.replaceState(null, '', url);
    // Force a page reload so App.tsx re-evaluates the new path
    window.location.replace(url);
  } else {
    window.location.href = url;
  }
}

// ─── tiny helpers ────────────────────────────────────────────────────────────
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface TableInfo {
  id: string;
  table_number: string;
  floor: string;
  area?: string;
  capacity?: number;
  status: 'available' | 'occupied' | 'reserved';
  is_active: boolean;
  floor_qr_disabled: boolean;
}

interface QrConfig {
  id: string;
  table_id: string;
  qr_type: 'static' | 'dynamic';
  token: string | null;
  token_expires_at: string | null;
  session_timeout_mins: number;
  qr_disabled: boolean;
  scan_count: number;
  short_code: string;
}

interface Session {
  id: string;
  table_id: string;
  started_at: string;
  status: 'active' | 'closed';
}

type PageState =
  | 'loading'
  | 'error'
  | 'disabled'        // QR or floor is disabled
  | 'inactive'        // table is_active = false
  | 'token_expired'   // static QR token expired
  | 'ready'           // validated — show welcome + CTA
  | 'entering';       // animating out

interface ErrorInfo {
  title: string;
  message: string;
  icon: string;
}

// ─── QR Short-code Redirect ───────────────────────────────────────────────────
// Mount at /qr/:shortCode
export function QrRedirect() {
  const shortCode = window.location.pathname.split('/').pop() ?? '';
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!shortCode) { setErr('Invalid QR code.'); return; }
    supabase
      .from('qr_config')
      .select('*, tables(table_number)')
      .eq('short_code', shortCode)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setErr('QR code not found.'); return; }
        const tableNum = (data as any).tables?.table_number;
        if (!tableNum) { setErr('Table not found.'); return; }
        // Native redirect — no React Router needed
        window.location.replace(`/order?table=${encodeURIComponent(tableNum)}&sc=${shortCode}`);
      });
  }, [shortCode]);

  if (err) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <p className="text-[var(--muted)] font-mono text-sm">{err}</p>
    </div>
  );
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--text)] animate-spin" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function TableOrderPage() {
  const tableNum = getSearchParam('table');
  const token    = getSearchParam('token');

  const [state, setState]     = useState<PageState>('loading');
  const [tableInfo, setTable] = useState<TableInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [errorInfo, setError] = useState<ErrorInfo | null>(null);
  const [dots, setDots]       = useState(0);
  const [scanLogged, setScanLogged] = useState(false);
  const enterRef = useRef(false);

  // Animated dots for loading state
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);

  // ── Main validation flow ──────────────────────────────────────────────────
  useEffect(() => {
    if (!tableNum) {
      setError({ title: 'No table specified', message: 'Please scan the QR code at your table.', icon: '⚠️' });
      setState('error');
      return;
    }

    async function validate() {
      // 1. Fetch table row
      const { data: tableData, error: tErr } = await supabase
        .from('tables')
        .select('*')
        .eq('table_number', tableNum)
        .single();

      if (tErr || !tableData) {
        setError({ title: 'Table not found', message: `Table "${tableNum}" doesn't exist. Please scan the correct QR code.`, icon: '🔍' });
        setState('error');
        return;
      }

      const tbl = tableData as TableInfo;
      setTable(tbl);

      // 2. Check floor master switch
      if (tbl.floor_qr_disabled) {
        setError({ title: 'Floor temporarily closed', message: 'This floor is currently closed. Please ask a staff member for assistance.', icon: '🏢' });
        setState('disabled');
        return;
      }

      // 3. Check table active
      if (!tbl.is_active) {
        setError({ title: 'Table unavailable', message: 'This table is currently not available for ordering. Please ask a staff member for assistance.', icon: '🚫' });
        setState('inactive');
        return;
      }

      // 4. Fetch QR config
      const { data: cfgData } = await supabase
        .from('qr_config')
        .select('*')
        .eq('table_id', tbl.id)
        .single();

      const cfg = cfgData as QrConfig | null;

      // 5. Check if QR is disabled
      if (cfg?.qr_disabled) {
        setError({ title: 'QR code disabled', message: 'This QR code is temporarily disabled. Please ask a staff member to assist you.', icon: '🔒' });
        setState('disabled');
        return;
      }

      // 6. Validate token for static QR
      if (cfg?.qr_type === 'static' && token) {
        if (cfg.token && cfg.token !== token) {
          setError({ title: 'QR code expired', message: 'This QR code is no longer valid. Please ask your server for an updated QR code.', icon: '⏰' });
          setState('token_expired');
          return;
        }
        if (cfg.token_expires_at && new Date(cfg.token_expires_at) < new Date()) {
          setError({ title: 'QR code expired', message: 'This QR code has expired. Please ask your server for an updated QR code.', icon: '⏰' });
          setState('token_expired');
          return;
        }
      }

      // 7. Check for existing active session on this table
      const { data: existingSession } = await supabase
        .from('qr_sessions')
        .select('*')
        .eq('table_id', tbl.id)
        .eq('status', 'active')
        .single();

      let activeSession: Session | null = existingSession as Session | null;

      // 8. Create session if none exists
      if (!activeSession) {
        const timeoutMins = cfg?.session_timeout_mins ?? 30;
        const { data: newSession } = await supabase
          .from('qr_sessions')
          .insert({
            table_id:   tbl.id,
            started_at: new Date().toISOString(),
            status:     'active',
            expires_at: new Date(Date.now() + timeoutMins * 60 * 1000).toISOString(),
          })
          .select()
          .single();
        activeSession = newSession as Session | null;

        // Mark table as occupied
        await supabase.from('tables').update({ status: 'occupied' }).eq('id', tbl.id);
      }

      setSession(activeSession);

      // 9. Log scan (once per page load)
      if (!scanLogged && cfg) {
        setScanLogged(true);
        const device = getDeviceType();
        await supabase.from('qr_config').update({
          scan_count:      (cfg.scan_count ?? 0) + 1,
          last_scan_at:    new Date().toISOString(),
          last_scan_device: device,
        }).eq('id', cfg.id);
      }

      setState('ready');
    }

    validate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNum, token]);

  function getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/iPhone/i.test(ua))  return 'iPhone';
    if (/iPad/i.test(ua))    return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Mac/i.test(ua))     return 'Mac';
    return 'Unknown';
  }

  function handleEnterOrdering() {
    if (enterRef.current) return;
    enterRef.current = true;
    setState('entering');
    // Navigate to your menu page — update this path to match your app's menu route
    setTimeout(() => {
      window.location.href = `/menu?table=${encodeURIComponent(tableNum)}&session=${session?.id ?? ''}`;
    }, 800);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:      #f9fafb;
          --surface: #ffffff;
          --border:  rgba(0,0,0,0.08);
          --accent:  #d4f57a;
          --muted:   rgba(0,0,0,0.5);
          --text:    rgba(0,0,0,0.90);
          --serif:   'Fraunces', Georgia, serif;
          --sans:    'DM Sans', system-ui, sans-serif;
          
          --border-strong: rgba(0,0,0,0.1);
          --accent-bg: rgba(212,245,122,0.15);
          --accent-border: rgba(212,245,122,0.4);
          --accent-glow: rgba(212,245,122,0.2);
          --accent-text: rgba(150,180,50,0.8);
          --bg-subtle: rgba(0,0,0,0.03);
          --accent-bg-subtle: rgba(212,245,122,0.1);
          --accent-border-subtle: rgba(212,245,122,0.3);
          --accent-text-strong: rgba(120,150,30,0.9);
          --border-light: rgba(0,0,0,0.15);
          --accent-shadow: rgba(212,245,122,0.4);
          --bg-hover: rgba(0,0,0,0.04);
          --text-faint: rgba(0,0,0,0.3);
          --bg-active: rgba(0,0,0,0.08);
          --accent-active: rgba(212,245,122,0.7);
          --text-faint-2: rgba(0,0,0,0.25);
        }

        html.dark {
          --bg:      #0c0d0e;
          --surface: #161718;
          --border:  rgba(255,255,255,0.08);
          --accent:  #d4f57a;
          --muted:   rgba(255,255,255,0.35);
          --text:    rgba(255,255,255,0.90);
          
          --border-strong: rgba(255,255,255,0.1);
          --accent-bg: rgba(212,245,122,0.08);
          --accent-border: rgba(212,245,122,0.2);
          --accent-glow: rgba(212,245,122,0.12);
          --accent-text: rgba(212,245,122,0.6);
          --bg-subtle: rgba(255,255,255,0.03);
          --accent-bg-subtle: rgba(212,245,122,0.06);
          --accent-border-subtle: rgba(212,245,122,0.15);
          --accent-text-strong: rgba(212,245,122,0.7);
          --border-light: rgba(255,255,255,0.15);
          --accent-shadow: rgba(212,245,122,0.3);
          --bg-hover: rgba(255,255,255,0.04);
          --text-faint: rgba(255,255,255,0.2);
          --bg-active: rgba(255,255,255,0.12);
          --accent-active: rgba(212,245,122,0.5);
          --text-faint-2: rgba(255,255,255,0.18);
        }

        .page {
          min-height: 100svh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-family: var(--sans);
          color: var(--text);
          overflow: hidden;
          position: relative;
          padding: 24px 20px;
        }

        /* Ambient glow */
        .page::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,245,122,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 40% 60% at 80% 80%, rgba(100,180,255,0.04) 0%, transparent 60%);
          pointer-events: none;
        }

        /* Subtle grid texture */
        .page::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
          background-size: 40px 40px;
          pointer-events: none;
        }

        .card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 24px;
          overflow: hidden;
          animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        @keyframes enterOut {
          to { opacity: 0; transform: scale(0.96) translateY(-8px); }
        }

        .card.exiting {
          animation: enterOut 0.5s cubic-bezier(0.4,0,1,1) forwards;
        }

        /* Header strip */
        .card-header {
          padding: 28px 28px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .logo-mark {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: var(--accent);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 20px;
        }

        .brand-name {
          font-family: var(--serif);
          font-size: 18px;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.3px;
        }

        .brand-sub {
          font-size: 12px;
          color: var(--muted);
          margin-top: 1px;
          font-weight: 300;
        }

        /* Main body */
        .card-body {
          padding: 28px;
        }

        /* Loading spinner */
        .spinner {
          width: 36px; height: 36px;
          border: 2px solid var(--border-strong);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto 20px;
        }

        .loading-text {
          text-align: center;
          font-size: 14px;
          color: var(--muted);
          font-weight: 300;
        }

        /* Table badge */
        .table-hero {
          text-align: center;
          margin-bottom: 28px;
        }

        .table-badge {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: var(--accent-bg);
          border: 1px solid var(--accent-border);
          border-radius: 20px;
          padding: 18px 32px;
          margin-bottom: 12px;
          position: relative;
          overflow: hidden;
        }

        .table-badge::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, var(--accent-glow), transparent);
        }

        .table-label {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent-text);
          position: relative;
        }

        .table-number {
          font-family: var(--serif);
          font-size: 42px;
          font-weight: 700;
          color: var(--accent);
          line-height: 1;
          position: relative;
          letter-spacing: -1px;
        }

        .welcome-text {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 300;
          font-style: italic;
          color: var(--text);
          line-height: 1.3;
        }

        .welcome-sub {
          font-size: 13px;
          color: var(--muted);
          margin-top: 6px;
          font-weight: 300;
          line-height: 1.6;
        }

        /* Info grid */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 24px;
        }

        .info-cell {
          background: var(--bg-subtle);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px 14px;
        }

        .info-cell-label {
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 4px;
        }

        .info-cell-value {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        /* Session pill */
        .session-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--accent-bg-subtle);
          border: 1px solid var(--accent-border-subtle);
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 20px;
          font-size: 12px;
          color: var(--accent-text-strong);
        }

        .session-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: pulse 2s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* CTA Button */
        .cta-btn {
          width: 100%;
          padding: 16px 24px;
          background: var(--accent);
          color: #0c0d0e;
          font-family: var(--sans);
          font-size: 15px;
          font-weight: 500;
          border: none;
          border-radius: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
          position: relative;
          overflow: hidden;
          letter-spacing: -0.1px;
        }

        .cta-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--border-light) 0%, transparent 60%);
        }

        .cta-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px var(--accent-shadow);
          background: #dcf97d;
        }

        .cta-btn:active {
          transform: translateY(0);
          box-shadow: none;
        }

        .cta-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .cta-arrow {
          font-size: 16px;
          transition: transform 0.2s;
        }

        .cta-btn:hover .cta-arrow {
          transform: translateX(3px);
        }

        /* Error / disabled states */
        .status-icon {
          font-size: 40px;
          text-align: center;
          margin-bottom: 12px;
          display: block;
          animation: fadeIn 0.4s ease both;
        }

        .status-title {
          font-family: var(--serif);
          font-size: 22px;
          font-weight: 700;
          color: var(--text);
          text-align: center;
          margin-bottom: 8px;
          font-style: italic;
          animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        .status-message {
          font-size: 13px;
          color: var(--muted);
          text-align: center;
          line-height: 1.6;
          font-weight: 300;
          animation: slideUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s both;
        }

        .staff-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 8px 14px;
          font-size: 12px;
          color: var(--muted);
          margin-top: 20px;
          width: 100%;
          justify-content: center;
        }

        /* Footer */
        .card-footer {
          border-top: 1px solid var(--border);
          padding: 14px 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .footer-text {
          font-size: 11px;
          color: var(--text-faint);
          font-weight: 300;
        }

        .footer-dots {
          display: flex;
          gap: 4px;
        }

        .footer-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: var(--bg-active);
        }

        .footer-dot.active {
          background: var(--accent-active);
        }
      `}</style>

      <main className="page">
        <div className={cn('card', state === 'entering' ? 'exiting' : '')}>

          {/* ── Card Header ── */}
          <div className="card-header">
            <div className="logo-mark">🍽️</div>
            <div>
              <div className="brand-name">Table Order</div>
              <div className="brand-sub">Contactless Dining</div>
            </div>
          </div>

          {/* ── Card Body ── */}
          <div className="card-body">

            {/* LOADING */}
            {state === 'loading' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div className="spinner" />
                <p className="loading-text">
                  Verifying your table{'.'.repeat(dots)}
                </p>
              </div>
            )}

            {/* READY OR ENTERING */}
            {(state === 'ready' || state === 'entering') && tableInfo && (
              <>
                <div className="table-hero">
                  <div className="table-badge">
                    <span className="table-label">Your Table</span>
                    <span className="table-number">{tableInfo.table_number}</span>
                  </div>
                  <div className="welcome-text">Welcome in, enjoy your visit.</div>
                  <div className="welcome-sub">
                    Browse our menu and order directly from your phone — no waiting needed.
                  </div>
                </div>

                <div className="info-grid">
                  {tableInfo.floor && (
                    <div className="info-cell">
                      <div className="info-cell-label">Floor</div>
                      <div className="info-cell-value">{tableInfo.floor}</div>
                    </div>
                  )}
                  {tableInfo.area && (
                    <div className="info-cell">
                      <div className="info-cell-label">Area</div>
                      <div className="info-cell-value" style={{ textTransform: 'capitalize' }}>{tableInfo.area}</div>
                    </div>
                  )}
                  {tableInfo.capacity && (
                    <div className="info-cell">
                      <div className="info-cell-label">Seats</div>
                      <div className="info-cell-value">{tableInfo.capacity}</div>
                    </div>
                  )}
                  <div className="info-cell">
                    <div className="info-cell-label">Status</div>
                    <div className="info-cell-value" style={{ color: 'var(--accent)', fontSize: 13 }}>● Ready to order</div>
                  </div>
                </div>

                {session && (
                  <div className="session-pill">
                    <span className="session-dot" />
                    Session started · {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}

                <button className="cta-btn" onClick={handleEnterOrdering} disabled={state === 'entering'}>
                  View Menu & Order
                  <span className="cta-arrow">→</span>
                </button>
              </>
            )}

            {/* ENTERING (transitional) */}
            {state === 'entering' && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div className="spinner" />
                <p className="loading-text">Opening your menu…</p>
              </div>
            )}

            {/* ERROR STATES */}
            {(state === 'error' || state === 'disabled' || state === 'inactive' || state === 'token_expired') && errorInfo && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <span className="status-icon">{errorInfo.icon}</span>
                <div className="status-title">{errorInfo.title}</div>
                <p className="status-message">{errorInfo.message}</p>
                <div className="staff-badge">
                  <span>🔔</span> Please ask a staff member for help
                </div>
              </div>
            )}
          </div>

          {/* ── Card Footer ── */}
          <div className="card-footer">
            <span className="footer-text">Scan · Dine · Enjoy</span>
            <div className="footer-dots">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('footer-dot', i === (state === 'ready' ? 2 : state === 'loading' ? 0 : 1) ? 'active' : '')} />
              ))}
            </div>
          </div>
        </div>

        {/* Below card note */}
        {state === 'ready' && (
          <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-faint-2)', textAlign: 'center', fontFamily: 'var(--sans)' }}>
            Having trouble? Flag down a server or ask at the counter.
          </p>
        )}
      </main>
    </>
  );
}

export default TableOrderPage;

/**
 * ─── React Router setup (in your App.tsx or routes file) ────────────────────
 *
 * import { TableOrderPage, QrRedirect } from './pages/TableOrderPage';
 *
 * <Routes>
 *   ...your existing routes...
 *   <Route path="/order"         element={<TableOrderPage />} />
 *   <Route path="/qr/:shortCode" element={<QrRedirect />} />
 * </Routes>
 *
 * ─── Supabase tables used ───────────────────────────────────────────────────
 *
 * tables          → id, table_number, floor, area, capacity, status,
 *                   is_active, floor_qr_disabled
 *
 * qr_config       → id, table_id, qr_type, token, token_expires_at,
 *                   session_timeout_mins, qr_disabled, scan_count,
 *                   last_scan_at, last_scan_device, short_code
 *
 * qr_sessions     → id, table_id, started_at, status, expires_at
 *
 * Make sure qr_sessions has an `expires_at` column (optional but recommended):
 * alter table qr_sessions add column if not exists expires_at timestamptz;
 *
 * ─── What this page does ────────────────────────────────────────────────────
 *
 * 1. Reads ?table=T01&token=xxx from URL
 * 2. Validates: table exists → floor online → table active → QR enabled → token valid
 * 3. Checks for existing active session (rejoins if already open)
 * 4. Creates a new session if none exists, marks table as occupied
 * 5. Logs the scan (count + device + timestamp) to qr_config
 * 6. Shows a beautiful welcome screen with table info
 * 7. Navigates to /menu?table=T01&session=<id> on button press
 */