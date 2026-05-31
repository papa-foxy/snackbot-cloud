const uploadImage = async (file) => {
  const fileName = `menu/${Date.now()}_${file.name}`;

  const { error } = await supabase.storage
    .from('menu-images') // 🔥 change to your bucket
    .upload(fileName, file);

  if (error) {
    console.error(error);
    throw error;
  }

  const { data } = supabase.storage
    .from('menu-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
};

/**
 * MenuManagement.tsx
 *
 * CHANGELOG
 * ─────────────────────────────────────────────────────────────────────────────
 * v3.2.0  2026-03-04
 * CHNG Updated merchant data fetching to match Dashboard logic.
 * CHNG Integrated useImpersonation context and localStorage fallback.
 * CHNG Made data loader cache key dynamic based on activeMerchantId.
 * * v3.1.0  2026-03-04
 * NEW  Multi-Branch / Multi-Business Support.
 * CHNG Added merchant_id filtering to all data fetching queries.
 * CHNG Included merchant_id in all insert payloads (CRUD + CSV Import).
 * CHNG Scoped schedule slots and assignments by parent IDs to prevent data leaks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Search, Loader2, X, Image as ImageIcon,
  Sparkles, Utensils, Info, Upload, FileSpreadsheet, CheckCircle2,
  Filter, Tag, Scale, Clock, Calendar, Eye, EyeOff,
  ToggleLeft, ToggleRight, ChevronDown, Moon, Sun, Sunrise, Sunset,
  LayoutTemplate, AlarmClock, Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTranslation } from '../contexts/TranslationContext';
import { cn } from '../utils/cn';
import { GoogleGenAI } from '@google/genai';
import { useDataLoader } from '../hooks/useDataLoader';
import { useTaxConfig } from '../hooks/useTaxConfig';
import { useImpersonation } from '../contexts/ImpersonationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type PriceType    = 'fixed' | 'dynamic';
type ScheduleScope = 'menu' | 'category';

const DAYS     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as const;
const DAY_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] as const;

interface TimeSlot {
  id?:          string;
  schedule_id?: string;
  day_of_week:  number;   // 0–6
  start_time:   string;   // "HH:MM"
  end_time:     string;
}

interface ScheduleTemplate {
  id:         string;
  name:       string;
  color:      string;   // tailwind color token e.g. "indigo"
  slots:      TimeSlot[];
  created_at: string;
}

interface ScheduleAssignment {
  target_type: ScheduleScope;
  target_id:   string;
  schedule_id: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_COLORS = [
  { token: 'indigo',  bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300',  dot: 'bg-indigo-500'  },
  { token: 'amber',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500'   },
  { token: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  { token: 'rose',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-500'    },
  { token: 'purple',  bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-300',  dot: 'bg-purple-500'  },
  { token: 'sky',     bg: 'bg-sky-100',     text: 'text-sky-700',     border: 'border-sky-300',     dot: 'bg-sky-500'     },
  { token: 'orange',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500'  },
  { token: 'teal',    bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300',    dot: 'bg-teal-500'    },
];

const PRESET_SLOTS = [
  { label: 'Breakfast', icon: Sunrise, days: [0,1,2,3,4,5,6], slots: [{ start_time:'07:00', end_time:'11:00' }] },
  { label: 'Lunch',     icon: Sun,     days: [0,1,2,3,4,5,6], slots: [{ start_time:'11:00', end_time:'15:00' }] },
  { label: 'Dinner',    icon: Sunset,  days: [0,1,2,3,4,5,6], slots: [{ start_time:'17:00', end_time:'22:00' }] },
  { label: 'Happy Hour',icon: Moon,    days: [1,2,3,4,5],     slots: [{ start_time:'16:00', end_time:'19:00' }] },
  { label: 'Weekend',   icon: Calendar,days: [0,6],           slots: [{ start_time:'10:00', end_time:'22:00' }] },
  { label: 'All Day',   icon: Zap,     days: [0,1,2,3,4,5,6], slots: [{ start_time:'00:00', end_time:'23:59' }] },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pure Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getColor(token: string) {
  return TEMPLATE_COLORS.find(c => c.token === token) ?? TEMPLATE_COLORS[0];
}

function checkAvailableNow(slots: TimeSlot[], now?: Date): boolean {
  const d   = now ?? new Date();
  const dow = d.getDay();
  const cur = d.getHours() * 60 + d.getMinutes();
  return slots.some(s => {
    if (s.day_of_week !== dow) return false;
    const [sh,sm] = s.start_time.split(':').map(Number);
    const [eh,em] = s.end_time.split(':').map(Number);
    const st = sh*60+sm, en = eh*60+em;
    return en < st ? (cur >= st || cur < en) : (cur >= st && cur < en);
  });
}

function formatPrice(item: any): string {
  if (item.price_type === 'dynamic') {
    const u = item.price_unit ? ` / ${item.price_unit}` : '';
    if (item.price_min != null && item.price_max != null)
      return `RM ${Number(item.price_min).toFixed(2)} – ${Number(item.price_max).toFixed(2)}${u}`;
    if (item.price_min != null) return `From RM ${Number(item.price_min).toFixed(2)}${u}`;
    return `Market price${u}`;
  }
  return `RM ${Number(item.base_price ?? 0).toFixed(2)}`;
}

function slotSummary(slots: TimeSlot[]): string {
  if (!slots.length) return 'No slots defined';
  const bySlotKey: Record<string, number[]> = {};
  slots.forEach(s => {
    const k = `${s.start_time}–${s.end_time}`;
    if (!bySlotKey[k]) bySlotKey[k] = [];
    bySlotKey[k].push(s.day_of_week);
  });
  return Object.entries(bySlotKey).map(([time, days]) => {
    const sorted = [...days].sort();
    const dayStr = sorted.length === 7 ? 'Every day'
      : sorted.length === 1 ? DAYS[sorted[0]]
      : sorted.map(d => DAYS[d]).join(', ');
    return `${dayStr} · ${time}`;
  }).join('  |  ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function PriceTypeBadge({ type }: { type: PriceType }) {
  return type === 'dynamic' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <Scale className="w-2.5 h-2.5" /> Dynamic
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 border border-gray-200 dark:border-[var(--sb-border)]">
      <Tag className="w-2.5 h-2.5" /> Fixed
    </span>
  );
}

function TemplatePill({ tpl, liveNow }: { tpl: ScheduleTemplate; liveNow: boolean; key?: React.Key }) {
  const c = getColor(tpl.color);
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border',
      c.bg, c.text, c.border
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', liveNow ? c.dot : 'bg-gray-300')} />
      {tpl.name}
    </span>
  );
}

// ── TimeSlot Editor ───────────────────────────────────────────────────────────
function SlotEditor({ slots, onChange }: { slots: TimeSlot[]; onChange: (s: TimeSlot[]) => void }) {
  const addSlot  = (day: number) => onChange([...slots, { day_of_week: day, start_time:'09:00', end_time:'22:00' }]);
  const remove   = (idx: number) => onChange(slots.filter((_,i) => i !== idx));
  const update   = (idx: number, f: 'start_time'|'end_time', v: string) =>
    onChange(slots.map((s,i) => i===idx ? {...s,[f]:v} : s));
  const toggleDay = (day: number) =>
    slots.some(s => s.day_of_week===day) ? onChange(slots.filter(s => s.day_of_week!==day)) : addSlot(day);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-2">Active Days</p>
        <div className="flex gap-1.5">
          {DAYS.map((d,i) => {
            const active = slots.some(s => s.day_of_week===i);
            return (
              <button key={d} type="button" onClick={() => toggleDay(i)}
                className={cn('w-9 h-9 rounded-xl text-xs font-bold border-2 transition-all',
                  active ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white dark:bg-[var(--sb-card)] text-gray-400 dark:text-neutral-500 border-gray-200 dark:border-[var(--sb-border)] hover:border-indigo-300')}>
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {DAYS.map((d, dayIdx) => {
        const ds = slots.map((s,i)=>({...s,_i:i})).filter(s=>s.day_of_week===dayIdx);
        if (!ds.length) return null;
        return (
          <div key={d} className="bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-[var(--sb-border)] p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300">{DAY_FULL[dayIdx]}</p>
              <button type="button" onClick={() => addSlot(dayIdx)} className="text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5">
                <Plus className="w-3 h-3"/> Add slot
              </button>
            </div>
            <div className="space-y-2">
              {ds.map(slot => {
                const overnight = slot.end_time < slot.start_time;
                return (
                  <div key={slot._i} className="flex items-center gap-2">
                    <input type="time" value={slot.start_time} onChange={e=>update(slot._i,'start_time',e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[var(--sb-card)]"/>
                    <span className="text-gray-400 dark:text-neutral-500 text-xs">–</span>
                    <input type="time" value={slot.end_time} onChange={e=>update(slot._i,'end_time',e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-[var(--sb-border)] rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[var(--sb-card)]"/>
                    {overnight && (
                      <span title="Overnight slot">
                        <Moon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      </span>
                    )}
                    <button type="button" onClick={() => remove(slot._i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {!slots.length && (
        <div className="py-5 text-center text-sm text-gray-400 dark:text-neutral-500 border-2 border-dashed border-gray-200 dark:border-[var(--sb-border)] rounded-xl">
          Click a day above to add time slots
        </div>
      )}
    </div>
  );
}

// ── Schedule Template CRUD Modal ──────────────────────────────────────────────
interface TemplateCrudModalProps {
  template: Partial<ScheduleTemplate> | null; 
  onSave:  (t: Partial<ScheduleTemplate>) => Promise<void>;
  onClose: () => void;
  saving:  boolean;
}

function TemplateCrudModal({ template, onSave, onClose, saving }: TemplateCrudModalProps) {
  const isNew = !template?.id;
  const [name,  setName]  = useState(template?.name  ?? '');
  const [color, setColor] = useState(template?.color ?? 'indigo');
  const [slots, setSlots] = useState<TimeSlot[]>(template?.slots ?? []);

  const applyPreset = (p: typeof PRESET_SLOTS[0]) => {
    const s: TimeSlot[] = [];
    p.days.forEach(day => p.slots.forEach(sl => s.push({ day_of_week:day, start_time:sl.start_time, end_time:sl.end_time })));
    setSlots(s);
    if (!name) setName(p.label);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ ...template, name: name.trim(), color, slots });
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-indigo-600"/>
            <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100">
              {isNew ? 'New Schedule Template' : 'Edit Schedule Template'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-5 h-5"/></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-1">Schedule Name <span className="text-red-500">*</span></label>
              <input
                type="text" value={name} onChange={e=>setName(e.target.value)} required
                placeholder="e.g. Breakfast Hours, Lunch Special, Happy Hour…"
                className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Label Colour</label>
              <div className="flex gap-2 flex-wrap">
                {TEMPLATE_COLORS.map(c => (
                  <button key={c.token} type="button" onClick={()=>setColor(c.token)}
                    className={cn('w-7 h-7 rounded-full transition-all border-2',
                      c.dot,
                      color===c.token ? 'border-gray-700 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                    )}/>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Quick Presets</label>
              <div className="grid grid-cols-3 gap-2">
                {PRESET_SLOTS.map(p => {
                  const Icon = p.icon;
                  return (
                    <button key={p.label} type="button" onClick={()=>applyPreset(p)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-neutral-800/50 hover:bg-indigo-50 border border-gray-200 dark:border-[var(--sb-border)] hover:border-indigo-300 rounded-xl text-xs font-semibold text-gray-600 dark:text-neutral-400 hover:text-indigo-700 transition-all">
                      <Icon className="w-3.5 h-3.5 shrink-0"/> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-300 mb-2">Time Slots</label>
              <SlotEditor slots={slots} onChange={setSlots}/>
            </div>

            {name && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-gray-500 dark:text-neutral-500">Preview:</span>
                <TemplatePill tpl={{ id:'prev', name, color, slots, created_at:'' }} liveNow={checkAvailableNow(slots)}/>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-gray-200 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
              {isNew ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Assign Schedule Modal ─────────────────────────────────────────────────────
interface AssignScheduleModalProps {
  targetId:    string;
  targetName:  string;
  targetType:  ScheduleScope;
  templates:   ScheduleTemplate[];
  assigned:    string[];           
  onSave:      (ids: string[]) => Promise<void>;
  onClose:     () => void;
  saving:      boolean;
}

function AssignScheduleModal({
  targetId, targetName, targetType, templates, assigned, onSave, onClose, saving,
}: AssignScheduleModalProps) {
  const [selected, setSelected] = useState<string[]>(assigned);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
          <div>
            <div className="flex items-center gap-2">
              <AlarmClock className="w-5 h-5 text-indigo-600"/>
              <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100">Assign Schedule</h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 mt-0.5 ml-7">
              {targetType === 'category' ? '📂 Category' : '🍽 Item'}: <span className="font-semibold text-gray-700 dark:text-neutral-300">{targetName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <label className={cn(
            'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
            selected.length === 0
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600 bg-white dark:bg-[var(--sb-card)]'
          )}>
            <input type="checkbox"
              checked={selected.length === 0}
              onChange={() => setSelected([])}
              className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 dark:border-neutral-600 rounded focus:ring-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-neutral-300">Always Available</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Default</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-0.5">No restrictions — visible on the menu at all times.</p>
            </div>
          </label>

          {templates.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400 dark:text-neutral-500 border-2 border-dashed border-gray-200 dark:border-[var(--sb-border)] rounded-xl">
              No schedule templates yet.<br/>
              <span className="text-indigo-500 font-medium">Go to the Schedules tab to create one.</span>
            </div>
          )}

          {templates.map(tpl => {
            const c       = getColor(tpl.color);
            const checked = selected.includes(tpl.id);
            const live    = checkAvailableNow(tpl.slots);

            return (
              <label key={tpl.id} className={cn(
                'flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all',
                checked
                  ? `border-current ${c.border} ${c.bg}`
                  : 'border-gray-200 dark:border-[var(--sb-border)] hover:border-gray-300 dark:border-neutral-600 bg-white dark:bg-[var(--sb-card)]'
              )}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(tpl.id)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 dark:border-neutral-600 rounded focus:ring-indigo-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm font-semibold', checked ? c.text : 'text-gray-800 dark:text-neutral-200')}>{tpl.name}</span>
                    {live ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                        Live now
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 border border-gray-200 dark:border-[var(--sb-border)]">
                        Off-hours
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-neutral-500 mt-1 leading-relaxed">
                    {slotSummary(tpl.slots)}
                  </p>

                  <div className="flex gap-1 mt-2 flex-wrap">
                    {DAYS.map((d,i) => {
                      const hasDay = tpl.slots.some(s => s.day_of_week===i);
                      return (
                        <span key={d} className={cn(
                          'text-[9px] font-bold px-1.5 py-0.5 rounded border',
                          hasDay
                            ? cn(c.bg, c.text, c.border)
                            : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-300 border-gray-200 dark:border-[var(--sb-border)]'
                        )}>{d}</span>
                      );
                    })}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50 shrink-0">
          <p className="text-xs text-gray-500 dark:text-neutral-500 mb-3">
            {selected.length === 0
              ? '✅ Always available — no restrictions.'
              : `📅 ${selected.length} schedule${selected.length>1?'s':''} assigned: ${templates.filter(t=>selected.includes(t.id)).map(t=>t.name).join(', ')}`
            }
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">
              Cancel
            </button>
            <button onClick={() => onSave(selected)} disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin"/>}
              Save Assignment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Preview Modal ────────────────────────────────────────────────────
interface PreviewModalProps {
  items:              any[];
  categories:         any[];
  templates:          ScheduleTemplate[];
  itemAssignments:    Record<string, string[]>;
  categoryAssignments:Record<string, string[]>;
  onClose: () => void;
}

function PreviewModal({ items, categories, templates, itemAssignments, categoryAssignments, onClose }: PreviewModalProps) {
  const now = new Date();
  const [previewDay,  setPreviewDay]  = useState(now.getDay());
  const [previewTime, setPreviewTime] = useState(
    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
  );

  const previewDate = (() => {
    const [h,m] = previewTime.split(':').map(Number);
    const d = new Date();
    d.setDate(d.getDate() + ((previewDay - d.getDay() + 7) % 7));
    d.setHours(h,m,0,0);
    return d;
  })();

  const slotsForIds = (ids: string[]) =>
    templates.filter(t=>ids.includes(t.id)).flatMap(t=>t.slots);

  const isItemVisible = (item: any) => {
    if (item.is_available === false) return false;
    const iIds = itemAssignments[item.id] ?? [];
    if (iIds.length > 0) {
      const slots = slotsForIds(iIds);
      return checkAvailableNow(slots, previewDate);
    }
    const cIds = categoryAssignments[item.category_id] ?? [];
    if (cIds.length > 0) {
      const slots = slotsForIds(cIds);
      return checkAvailableNow(slots, previewDate);
    }
    return true;
  };

  const visibleCount = items.filter(isItemVisible).length;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600"/>
            <h3 className="text-base font-semibold text-gray-900 dark:text-neutral-100">Schedule Preview</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:text-neutral-400"><X className="w-5 h-5"/></button>
        </div>

        <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-indigo-700">Day:</label>
            <select value={previewDay} onChange={e=>setPreviewDay(Number(e.target.value))}
              className="text-sm border border-indigo-200 rounded-lg px-2 py-1 bg-white dark:bg-[var(--sb-card)] focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {DAY_FULL.map((d,i)=><option key={i} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-indigo-700">Time:</label>
            <input type="time" value={previewTime} onChange={e=>setPreviewTime(e.target.value)}
              className="text-sm border border-indigo-200 rounded-lg px-2 py-1 bg-white dark:bg-[var(--sb-card)] focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          <span className="text-xs text-indigo-600 font-semibold ml-auto">{visibleCount} / {items.length} items visible</span>
        </div>

        <div className="overflow-y-auto flex-1">
          {categories.map(cat => {
            const cItems  = items.filter(i=>i.category_id===cat.id);
            const cIds    = categoryAssignments[cat.id] ?? [];
            const catLive = !cIds.length || checkAvailableNow(slotsForIds(cIds), previewDate);
            return (
              <div key={cat.id} className="border-b border-gray-100 dark:border-[var(--sb-border)] last:border-0">
                <div className={cn('px-5 py-3 flex items-center gap-3', !catLive && 'bg-red-50/50')}>
                  <span className="font-semibold text-gray-800 dark:text-neutral-200 text-sm">{cat.name}</span>
                  {cIds.length > 0 && (
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border',
                      catLive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200')}>
                      {catLive ? '● Available' : '○ Unavailable'}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 dark:text-neutral-500 ml-auto">{cItems.filter(isItemVisible).length}/{cItems.length}</span>
                </div>
                {cItems.map(item => {
                  const vis = isItemVisible(item);
                  const hasItemSched = (itemAssignments[item.id]??[]).length > 0;
                  return (
                    <div key={item.id} className={cn('px-5 py-2.5 flex items-center gap-3 border-t border-gray-50', !vis && 'opacity-40 bg-gray-50 dark:bg-neutral-800/50')}>
                      <div className={cn('w-2 h-2 rounded-full shrink-0', vis ? 'bg-emerald-500' : 'bg-gray-300')}/>
                      <span className="text-sm text-gray-800 dark:text-neutral-200 flex-1">{item.name}</span>
                      {hasItemSched && <Clock className="w-3.5 h-3.5 text-indigo-400"/>}
                      {!vis && <EyeOff className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500"/>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-gray-50 dark:bg-neutral-800/50 border-t border-gray-200 dark:border-[var(--sb-border)] flex items-center gap-2">
          <Info className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0"/>
          <p className="text-xs text-gray-500 dark:text-neutral-500">Priority: Manual Disable → Item Schedule → Category Schedule → Always shown</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export function MenuManagement() {
  const { t } = useTranslation();
  
  // 👉 REVISED: Fetch active merchant ID matching the Dashboard logic
  const { isImpersonating, merchantId: impersonatedMerchantId } = useImpersonation();
  const getLocalMerchantId = () => {
    try { return JSON.parse(localStorage.getItem('snackbot_user') || '{}')?.merchant_id ?? null; }
    catch { return null; }
  };
  const activeMerchantId = isImpersonating ? impersonatedMerchantId : getLocalMerchantId();

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const addonFileInputRef = useRef<HTMLInputElement>(null);

  type MainTab = 'items' | 'categories' | 'addons' | 'schedules';
  const [activeTab, setActiveTab] = useState<MainTab>('items');

  // Core modal
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [editingItem,  setEditingItem]  = useState<any>(null);
  const [formData,     setFormData]     = useState<any>({});
  const [saving,       setSaving]       = useState(false);
  const [alert,        setAlert]        = useState<{type:'success'|'error';message:string}|null>(null);

  // Addons / Ingredients
  const [selectedAddons,      setSelectedAddons]      = useState<string[]>([]);
  const [addonSearch,         setAddonSearch]         = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState<any[]>([]);
  const [ingredientSearch,    setIngredientSearch]    = useState('');

  // AI
  const [suggesting,           setSuggesting]           = useState(false);
  const [suggestions,          setSuggestions]          = useState<any[]>([]);
  const [showSuggestions,      setShowSuggestions]      = useState(false);
  const [suggestingIngredients,setSuggestingIngredients] = useState(false);
  const [suggestingAddons,     setSuggestingAddons]     = useState(false);
  const [addonSuggestions,     setAddonSuggestions]     = useState<any[]>([]);
  const [showAddonSuggestions, setShowAddonSuggestions]= useState(false);

  // Image / CSV
  const [imageUploadLoading, setImageUploadLoading] = useState(false);
  const [csvUploading,       setCsvUploading]       = useState(false);
  const [showCsvGuide,       setShowCsvGuide]       = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery,    setSearchQuery]    = useState('');

  // Tax
  const [itemTaxOverrides,  setItemTaxOverrides]  = useState<Record<string,string>>({});
  const [categoryTaxRules,  setCategoryTaxRules]  = useState<Record<string,string>>({});
  const [taxSaving,         setTaxSaving]         = useState<string|null>(null);
  const { configs: taxConfigs } = useTaxConfig(activeMerchantId ?? undefined);

  // Schedule state
  const [templates,             setTemplates]            = useState<ScheduleTemplate[]>([]);
  const [itemAssignments,       setItemAssignments]      = useState<Record<string,string[]>>({});
  const [categoryAssignments,  setCategoryAssignments] = useState<Record<string,string[]>>({});

  const [tplModal,    setTplModal]    = useState<Partial<ScheduleTemplate>|null|false>(false); 
  const [tplSaving,   setTplSaving]   = useState(false);
  const [tplDelete,   setTplDelete]   = useState<ScheduleTemplate|null>(null);

  const [assignTarget, setAssignTarget] = useState<{ id:string; name:string; type:ScheduleScope }|null>(null);
  const [assignSaving, setAssignSaving] = useState(false);

  const [showPreview,   setShowPreview]  = useState(false);
  const [overrideSaving,setOverrideSaving]= useState<string|null>(null);
  const [deleteModal,   setDeleteModal]  = useState<{isOpen:boolean;id:string;name:string}|null>(null);

  useEffect(() => {
    if (alert) { const t = setTimeout(()=>setAlert(null),4000); return ()=>clearTimeout(t); }
  }, [alert]);
  useEffect(()=>{ setFilterCategory('all'); setSearchQuery(''); }, [activeTab]);

  // ── Audit ───────────────────────────────────────────────────────────────────
  const writeAudit = async (event: string, details: string) => {
    if (!activeMerchantId) return;
    try { await supabase.from('audit_logs').insert([{ event, details, status:'success', merchant_id: activeMerchantId }]); } catch {}
  };

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!activeMerchantId) return { categories: [], items: [], addons: [], inventory: [] };

    // Filter main tables by activeMerchantId
    const [catRes, itemRes, addonRes, invRes, tplRes] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('merchant_id', activeMerchantId).order('sort_order'),
      supabase.from('menu').select(`
        id, name, description, base_price, price_type, price_unit, price_min, price_max,
        image_url, category_id, is_available, is_featured, prep_time_min, created_at,
        menu_categories!menu_category_id_fkey(id, name),
        menu_item_ingredients!menu_item_ingredients_menu_item_id_fkey(
          inventory_id, quantity, inventory:inventory_id(id, name, unit, quantity)
        )
      `).eq('merchant_id', activeMerchantId).is('deleted_at', null).order('name'),
      supabase.from('addons').select('*').eq('merchant_id', activeMerchantId).order('name'),
      supabase.from('inventory').select('*').eq('merchant_id', activeMerchantId).order('name'),
      supabase.from('schedule_templates').select('*').eq('merchant_id', activeMerchantId).order('created_at'),
    ]);

    if (catRes.error)  throw catRes.error;
    if (itemRes.error) throw itemRes.error;

    const templateIds = (tplRes.data || []).map(t => t.id);
    
    let slotRes = { data: [] as any[] };
    let assignRes = { data: [] as any[] };
    
    if (templateIds.length > 0) {
      const [fetchedSlots, fetchedAssigns] = await Promise.all([
        supabase.from('schedule_slots').select('*').in('schedule_id', templateIds),
        supabase.from('schedule_assignments').select('*').in('schedule_id', templateIds)
      ]);
      slotRes = fetchedSlots;
      assignRes = fetchedAssigns;
    }

    const items = (itemRes.data??[]).map(item => ({
      ...item,
      price_type:    (item as any).price_type ?? 'fixed',
      category_name: (item.menu_categories as any)?.name ?? 'Uncategorized',
      ingredients:   item.menu_item_ingredients || [],
    }));

    const slotsByTpl: Record<string,TimeSlot[]> = {};
    for (const s of slotRes.data??[]) {
      if (!slotsByTpl[s.schedule_id]) slotsByTpl[s.schedule_id] = [];
      slotsByTpl[s.schedule_id].push(s);
    }
    const tpls: ScheduleTemplate[] = (tplRes.data??[]).map(t => ({
      ...t,
      slots: slotsByTpl[t.id] ?? [],
    }));
    setTemplates(tpls);

    const iAssign: Record<string,string[]> = {};
    const cAssign: Record<string,string[]> = {};
    for (const a of assignRes.data??[]) {
      if (a.target_type === 'menu') {
        if (!iAssign[a.target_id]) iAssign[a.target_id] = [];
        iAssign[a.target_id].push(a.schedule_id);
      } else {
        if (!cAssign[a.target_id]) cAssign[a.target_id] = [];
        cAssign[a.target_id].push(a.schedule_id);
      }
    }
    setItemAssignments(iAssign);
    setCategoryAssignments(cAssign);

    const itemIds = items.map(i => i.id);
    const catIds = (catRes.data || []).map(c => c.id);

    let ioRes = { data: [] as any[] };
    let crRes = { data: [] as any[] };

    if (itemIds.length > 0) {
       const res = await supabase.from('tax_item_override').select('menu_item_id, tax_config_id, is_exempt').in('menu_item_id', itemIds);
       ioRes = res;
    }
    if (catIds.length > 0) {
       const res = await supabase.from('tax_category_rule').select('category_id, tax_config_id, is_exempt').in('category_id', catIds);
       crRes = res;
    }

    const itm: Record<string,string> = {};
    for (const r of ioRes.data??[]) itm[r.menu_item_id] = r.is_exempt ? 'exempt' : r.tax_config_id;
    const cat: Record<string,string> = {};
    for (const r of crRes.data??[]) cat[r.category_id] = r.is_exempt ? 'exempt' : r.tax_config_id;
    setItemTaxOverrides(itm);
    setCategoryTaxRules(cat);

    return { categories: catRes.data||[], items, addons: addonRes.data||[], inventory: invRes.data||[] };
  };

  // 👉 REVISED: Data loader key forces refresh when impersonation merchant changes
  const { data, loading, refetch } = useDataLoader(`menu_management_${activeMerchantId}`, fetchData);

  // 👉 REVISED: Refetch explicitly when active merchant changes
  useEffect(() => {
    if (activeMerchantId) refetch();
  }, [activeMerchantId]);

  const categories = data?.categories || [];
  const items      = data?.items      || [];
  const addons     = data?.addons     || [];
  const inventory  = data?.inventory  || [];

  // ── Template CRUD ───────────────────────────────────────────────────────────
  const saveTemplate = async (tpl: Partial<ScheduleTemplate>) => {
    if (!activeMerchantId) return;
    setTplSaving(true);
    try {
      const isNew = !tpl.id;
      let tplId = tpl.id;

      if (isNew) {
        const { data: created, error } = await supabase
          .from('schedule_templates')
          .insert([{ name: tpl.name, color: tpl.color, merchant_id: activeMerchantId }])
          .select().single();
        if (error) throw error;
        tplId = created.id;
      } else {
        const { error } = await supabase
          .from('schedule_templates')
          .update({ name: tpl.name, color: tpl.color })
          .eq('id', tplId);
        if (error) throw error;
      }

      await supabase.from('schedule_slots').delete().eq('schedule_id', tplId);
      if ((tpl.slots??[]).length > 0) {
        const { error } = await supabase.from('schedule_slots').insert(
          (tpl.slots??[]).map(s => ({
            schedule_id:  tplId,
            day_of_week:  s.day_of_week,
            start_time:   s.start_time,
            end_time:     s.end_time,
            merchant_id:  activeMerchantId,
          }))
        );
        if (error) throw error;
      }

      await writeAudit(
        isNew ? 'Schedule Template Created' : 'Schedule Template Updated',
        `${isNew ? 'Created' : 'Updated'} template "${tpl.name}" with ${(tpl.slots??[]).length} slot(s)`,
      );
      setTplModal(false);
      refetch();
      setAlert({ type:'success', message:`Template "${tpl.name}" ${isNew?'created':'updated'}!` });
    } catch (e:any) {
      setAlert({ type:'error', message: e.message || 'Failed to save template.' });
    } finally { setTplSaving(false); }
  };

  const deleteTemplate = async (tpl: ScheduleTemplate) => {
    setTplDelete(null);
    try {
      await supabase.from('schedule_slots').delete().eq('schedule_id', tpl.id);
      await supabase.from('schedule_assignments').delete().eq('schedule_id', tpl.id);
      await supabase.from('schedule_templates').delete().eq('id', tpl.id);
      await writeAudit('Schedule Template Deleted', `Deleted template "${tpl.name}"`);
      refetch();
      setAlert({ type:'success', message:`Template "${tpl.name}" deleted.` });
    } catch (e:any) { setAlert({ type:'error', message: e.message }); }
  };

  // ── Assign schedules ────────────────────────────────────────────────────────
  const saveAssignment = async (scheduleIds: string[]) => {
    if (!assignTarget) return;
    setAssignSaving(true);
    try {
      const { id, type, name } = assignTarget;
      await supabase.from('schedule_assignments').delete()
        .eq('target_type', type).eq('target_id', id);

      if (scheduleIds.length > 0) {
        const { error } = await supabase.from('schedule_assignments').insert(
          scheduleIds.map(sid => ({ target_type: type, target_id: id, schedule_id: sid }))
        );
        if (error) throw error;
      }

      const names = templates.filter(t=>scheduleIds.includes(t.id)).map(t=>t.name).join(', ');
      if (type === 'menu') setItemAssignments(p => ({ ...p, [id]: scheduleIds }));
      else setCategoryAssignments(p => ({ ...p, [id]: scheduleIds }));

      await writeAudit(
        'Schedule Assignment Updated',
        scheduleIds.length > 0
          ? `Assigned schedules [${names}] to ${type} "${name}"`
          : `Cleared schedule assignments for ${type} "${name}"`,
      );

      setAssignTarget(null);
      setAlert({ type:'success', message:`Schedule updated for "${name}"` });
    } catch (e:any) {
      setAlert({ type:'error', message: e.message || 'Failed to save assignment.' });
    } finally { setAssignSaving(false); }
  };

  // ── Manual override ─────────────────────────────────────────────────────────
  const toggleManualOverride = async (item: any) => {
    setOverrideSaving(item.id);
    const newVal = item.is_available === false;
    try {
      await supabase.from('menu').update({ is_available: newVal }).eq('id', item.id);
      await writeAudit(
        newVal ? 'Menu Item Enabled' : 'Menu Item Disabled',
        `Manual override: "${item.name}" → ${newVal ? 'available' : 'unavailable'}`,
      );
      refetch();
      setAlert({ type:'success', message:`"${item.name}" ${newVal?'enabled':'disabled'}.` });
    } catch (e:any) { setAlert({ type:'error', message: e.message }); }
    finally { setOverrideSaving(null); }
  };

  // ── Tax ─────────────────────────────────────────────────────────────────────
  const saveTaxOverride = async (type:'item'|'category', id:string, value:string) => {
    setTaxSaving(id);
    const table = type==='item' ? 'tax_item_override' : 'tax_category_rule';
    const idCol = type==='item' ? 'menu_item_id'     : 'category_id';
    if (!value) {
      await supabase.from(table).delete().eq(idCol, id);
      if (type==='item') setItemTaxOverrides(p=>{ const n={...p}; delete n[id]; return n; });
      else setCategoryTaxRules(p=>{ const n={...p}; delete n[id]; return n; });
    } else if (value==='exempt') {
      await supabase.from(table).upsert({ [idCol]:id, tax_config_id:null, is_exempt:true }, { onConflict:idCol });
      if (type==='item') setItemTaxOverrides(p=>({...p,[id]:'exempt'}));
      else setCategoryTaxRules(p=>({...p,[id]:'exempt'}));
    } else {
      await supabase.from(table).upsert({ [idCol]:id, tax_config_id:value, is_exempt:false }, { onConflict:idCol });
      if (type==='item') setItemTaxOverrides(p=>({...p,[id]:value}));
      else setCategoryTaxRules(p=>({...p,[id]:value}));
    }
    setTaxSaving(null);
  };

  // ── Modal open/close ────────────────────────────────────────────────────────
  const handleOpenModal = async (item: any = null, prefill: any = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({ ...item, price_type: item.price_type ?? 'fixed', price_unit: item.price_unit??'', price_min: item.price_min??'', price_max: item.price_max??'' });
      if (activeTab === 'items') {
        try {
          const { data: ad } = await supabase.from('menu_item_addons').select('addon_id').eq('menu_item_id', item.id);
          setSelectedAddons(ad?.map((d:any)=>d.addon_id)||[]);
          const { data: ing } = await supabase.from('menu_item_ingredients').select('quantity, inventory_id, inventory:inventory_id(id, name, unit)').eq('menu_item_id', item.id);
          setSelectedIngredients((ing??[]).map((i:any) => ({ inventory_id:i.inventory_id, quantity:i.quantity, name:i.inventory?.name||'', unit:i.inventory?.unit||'' })));
        } catch { setSelectedAddons([]); setSelectedIngredients(item.ingredients||[]); }
      }
    } else {
      const base = prefill ? { price_type:'fixed', price_unit:'', price_min:'', price_max:'', ...prefill } : { price_type:'fixed', price_unit:'', price_min:'', price_max:'' };
      setFormData(base);
      setSelectedAddons([]);
      setSelectedIngredients([]);
    }
    setAddonSearch('');
    setIngredientSearch('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false); setEditingItem(null); setFormData({});
    setSelectedAddons([]); setSelectedIngredients([]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((p:any) => ({ ...p, [name]: type==='number' ? (value===''?'':parseFloat(value)) : value }));
  };

  const handlePriceTypeChange = (pt: PriceType) =>
    setFormData((p:any) => ({ ...p, price_type:pt, ...(pt==='fixed' ? { price_unit:'', price_min:'', price_max:'' } : { base_price:'' }) }));

  // ── Save item/cat/addon ─────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMerchantId) return;

    if (activeTab==='items' && formData.price_type==='dynamic') {
      if (!formData.price_unit?.trim()) { setAlert({ type:'error', message:'Enter a price unit.' }); return; }
      if (formData.price_min!=='' && formData.price_max!=='' && Number(formData.price_min) > Number(formData.price_max)) {
        setAlert({ type:'error', message:'Min price cannot exceed max.' }); return;
      }
    }
    setSaving(true);
    try {
      const table = activeTab==='items' ? 'menu' : activeTab==='categories' ? 'menu_categories' : 'addons';
      
      const dataToSave = { ...formData, merchant_id: activeMerchantId };
      
      if (table==='menu') {
        delete dataToSave.menu_categories; delete dataToSave.menu_item_ingredients;
        delete dataToSave.ingredients; delete dataToSave.category_name;
        dataToSave.addon_ids = selectedAddons;delete dataToSave._previewUrl;
        if (dataToSave.image_url?.startsWith('data:image/')) {
          delete dataToSave.image_url;
        }
        
        dataToSave.addon_ids = selectedAddons;

        if (dataToSave.price_type==='dynamic') {
          dataToSave.base_price = dataToSave.price_min!=='' ? Number(dataToSave.price_min) : 0;
          dataToSave.price_min  = dataToSave.price_min!=='' ? Number(dataToSave.price_min)  : null;
          dataToSave.price_max  = dataToSave.price_max!=='' ? Number(dataToSave.price_max)  : null;
        } else {
          dataToSave.price_type='fixed'; dataToSave.price_unit=null; dataToSave.price_min=null; dataToSave.price_max=null;
        }
      }
      if (table==='menu_categories') {
        for (const f of ['price_max','price_min','price_type','price_unit','base_price',
                         'addon_ids','category_id','category_name','is_available','is_featured',
                         'prep_time_min','menu_categories','menu_item_ingredients','ingredients']) {
          delete dataToSave[f];
        }
      }

      if (table==='addons') {
        for (const f of ['price_max','price_min','price_type','price_unit',
                        'addon_ids','category_id','category_name','is_featured',
                        'prep_time_min','menu_categories','menu_item_ingredients',
                        'ingredients','description','image_url','_previewUrl']) {
          delete dataToSave[f];
        }
      }
      let savedId = editingItem?.id;
      if (editingItem) {
        const { error } = await supabase.from(table).update(dataToSave).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { data: saved, error } = await supabase.from(table).insert([dataToSave]).select().single();
        if (error) throw error;
        if (saved) savedId = saved.id;
      }
      if (table==='menu' && savedId) {
        await supabase.from('menu_item_addons').delete().eq('menu_item_id', savedId);
        if (selectedAddons.length > 0)
          await supabase.from('menu_item_addons').insert(selectedAddons.map(id=>({ menu_item_id:savedId, addon_id:id })));
        await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', savedId);
        if (selectedIngredients.length > 0)
          await supabase.from('menu_item_ingredients').insert(
            selectedIngredients.map(i=>({ menu_item_id:savedId, inventory_id:i.inventory_id, quantity:i.quantity }))
          );
      }
      await writeAudit(
        `${editingItem?'Updated':'Created'} ${activeTab==='items'?'Menu Item':activeTab==='categories'?'Category':'Add-on'}`,
        `${editingItem?'Updated':'Created'}: ${formData.name}`,
      );
      handleCloseModal(); refetch();
      setAlert({ type:'success', message:'Saved successfully!' });
    } catch (e:any) { setAlert({ type:'error', message: e.message||'Failed to save.' }); }
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    setImageUploadLoading(true);

    // Show a local object URL for preview only — never saved to DB
    const previewUrl = URL.createObjectURL(file);
    setFormData((p: any) => ({ ...p, _previewUrl: previewUrl }));

    // Upload to Supabase and get the real public URL
    const uploadedUrl = await uploadImage(file);

    // Save ONLY the real Supabase URL into image_url
    setFormData((p: any) => ({ ...p, image_url: uploadedUrl, _previewUrl: undefined }));

    // Clean up the object URL
    URL.revokeObjectURL(previewUrl);

  } catch (err) {
    console.error('Upload failed:', err);
    setAlert({ type: 'error', message: 'Image upload failed. Please try again.' });
  } finally {
    setImageUploadLoading(false);
  }
};

  // ── AI ──────────────────────────────────────────────────────────────────────
  const getAI = () => {
    const key = (import.meta.env as any).VITE_GEMINI_API_KEY;
    if (!key) { setAlert({ type:'error', message:'AI service not configured.' }); return null; }
    return new GoogleGenAI({ apiKey:key });
  };

  const handleSuggestItems = async () => {
    setSuggesting(true);
    try {
      const ai = getAI(); if (!ai) return;
      await writeAudit('ai_menu_item_suggestion_started', `Requested AI menu item suggestions for ${items.length} existing items`);
      const r = await ai.models.generateContent({
        model:'gemini-3-flash-preview',
        contents:`Suggest 3 new F&B menu items based on: ${items.map(i=>i.name).join(', ')}. Categories: ${categories.map(c=>c.name).join(', ')}. JSON array: name, description, estimated_price, suggested_category.`,
        config:{ responseMimeType:'application/json' },
      });
      setSuggestions(JSON.parse(r.text||'[]')); setShowSuggestions(true);
      await writeAudit('ai_menu_item_suggestion_success', 'AI menu item suggestions generated successfully');
    } catch (err: any) {
      console.error('AI menu item suggestion failed:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      await writeAudit(isQuota ? 'ai_menu_item_suggestion_quota_exceeded' : 'ai_menu_item_suggestion_failed', err?.message || String(err));
      setAlert({ type:'error', message: isQuota ? 'AI quota exceeded. Please try again later.' : 'AI suggestion failed.' });
    }
    finally { setSuggesting(false); }
  };

  const handleSuggestAddons = async () => {
    setSuggestingAddons(true);
    try {
      const ai = getAI(); if (!ai) return;
      await writeAudit('ai_menu_addon_suggestion_started', `Requested AI add-on suggestions for ${items.length} existing items`);
      const r = await ai.models.generateContent({
        model:'gemini-3-flash-preview',
        contents:`Suggest 4 add-ons for: ${items.map(i=>i.name).join(', ')}. JSON array: name, estimated_price.`,
        config:{ responseMimeType:'application/json' },
      });
      setAddonSuggestions(JSON.parse(r.text||'[]')); setShowAddonSuggestions(true);
      await writeAudit('ai_menu_addon_suggestion_success', 'AI add-on suggestions generated successfully');
    } catch (err: any) {
      console.error('AI add-on suggestion failed:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      await writeAudit(isQuota ? 'ai_menu_addon_suggestion_quota_exceeded' : 'ai_menu_addon_suggestion_failed', err?.message || String(err));
      setAlert({ type:'error', message: isQuota ? 'AI quota exceeded. Please try again later.' : 'AI suggestion failed.' });
    }
    finally { setSuggestingAddons(false); }
  };

  const handleSuggestIngredients = async () => {
    if (!formData.name) { setAlert({ type:'error', message:'Enter item name first.' }); return; }
    setSuggestingIngredients(true);
    try {
      const ai = getAI(); if (!ai) return;
      await writeAudit('ai_menu_ingredient_suggestion_started', `Requested AI ingredient suggestions for item "${formData.name}"`);
      const r = await ai.models.generateContent({
        model:'gemini-3-flash-preview',
        contents:`Suggest ingredients for "${formData.name}" from: ${JSON.stringify(inventory.map(i=>({ id:i.id, name:i.name, unit:i.unit })))}. JSON array: inventory_id, quantity.`,
        config:{ responseMimeType:'application/json' },
      });
      const result = JSON.parse(r.text||'[]');
      setSelectedIngredients(result.map((x:any) => {
        const inv = inventory.find((i:any) => i.id===x.inventory_id);
        return inv ? { inventory_id:inv.id, name:inv.name, unit:inv.unit, quantity:x.quantity } : null;
      }).filter(Boolean));
      await writeAudit('ai_menu_ingredient_suggestion_success', `AI ingredient suggestions generated for "${formData.name}"`);
    } catch (err: any) {
      console.error('AI ingredient suggestion failed:', err);
      const isQuota = err?.status === 429 || err?.statusCode === 429 ||
        String(err).includes('429') || String(err).toLowerCase().includes('quota') || String(err).toLowerCase().includes('resourceexhausted');
      await writeAudit(isQuota ? 'ai_menu_ingredient_suggestion_quota_exceeded' : 'ai_menu_ingredient_suggestion_failed', err?.message || String(err));
      setAlert({ type:'error', message: isQuota ? 'AI quota exceeded. Please try again later.' : 'AI ingredient suggestion failed.' });
    }
    finally { setSuggestingIngredients(false); }
  };

  // ── CSV ─────────────────────────────────────────────────────────────────────
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>, type:'items'|'addons') => {
    const file = e.target.files?.[0]; if (!file || !activeMerchantId) return;
    setCsvUploading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
      const itemsIns: any[] = [], addonsIns: any[] = [];
      for (let i=1; i<lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(',').map(v=>v.trim());
        const row: any = {}; headers.forEach((h,idx)=>{ row[h]=vals[idx]; });
        const rt = row.type || type;
        if (rt==='item') itemsIns.push({ 
          merchant_id: activeMerchantId,
          name:row.name, 
          base_price:parseFloat(row.price||'0'), 
          description:row.description||'', 
          price_type:row.price_type||'fixed', 
          price_unit:row.price_unit||null, 
          price_min:row.price_min?parseFloat(row.price_min):null, 
          price_max:row.price_max?parseFloat(row.price_max):null, 
          category_id:categories.find((c:any)=>c.name.toLowerCase()===row.category?.toLowerCase())?.id 
        });
        else addonsIns.push({ 
          merchant_id: activeMerchantId,
          name:row.name, 
          price:parseFloat(row.price||'0') 
        });
      }
      if (itemsIns.length>0) { const { error } = await supabase.from('menu').insert(itemsIns); if (error) throw error; }
      if (addonsIns.length>0) { const { error } = await supabase.from('addons').insert(addonsIns); if (error) throw error; }
      await writeAudit('CSV Import', `Imported ${itemsIns.length} menu items, ${addonsIns.length} add-ons`);
      setAlert({ type:'success', message:`Imported ${itemsIns.length} items and ${addonsIns.length} add-ons.` });
      setShowCsvGuide(false); refetch();
    } catch (e:any) { setAlert({ type:'error', message:`CSV import failed: ${e.message}` }); }
    finally { setCsvUploading(false); if (fileInputRef.current) fileInputRef.current.value=''; if (addonFileInputRef.current) addonFileInputRef.current.value=''; }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteModal) return;
    const { id, name } = deleteModal; setDeleteModal(null);
    try {
      const table = activeTab==='items' ? 'menu' : activeTab==='categories' ? 'menu_categories' : 'addons';

if (table==='menu') {
  // Soft delete — sets deleted_at instead of removing the row.
  // This avoids the order_items FK violation while preserving order history.
  const { error } = await supabase
    .from('menu')
    .update({ deleted_at: new Date().toISOString(), is_available: false })
    .eq('id', id);
  if (error) throw error;
  // Junction tables are safe to hard-delete
  await supabase.from('menu_item_addons').delete().eq('menu_item_id', id);
  await supabase.from('menu_item_ingredients').delete().eq('menu_item_id', id);
  await supabase.from('schedule_assignments').delete().eq('target_type','menu').eq('target_id', id);
} else {
  if (table==='menu_categories')
    await supabase.from('schedule_assignments').delete().eq('target_type','category').eq('target_id', id);
  if (table==='addons')
    await supabase.from('menu_item_addons').delete().eq('addon_id', id);
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
      await writeAudit(`Deleted ${activeTab==='items'?'Menu Item':activeTab==='categories'?'Category':'Add-on'}`, `Deleted: ${name}`);
      refetch(); setAlert({ type:'success', message:'Deleted successfully!' });
    } catch (e:any) { setAlert({ type:'error', message: e.message||'Failed to delete.' }); }
  };

  // ── Derived filtered lists ──────────────────────────────────────────────────
  const filteredItems      = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) && (filterCategory==='all'||i.category_id===filterCategory));
  const filteredAddons     = addons.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredCategories = categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredTemplates  = templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredAddonSearch = addons.filter(a => a.name.toLowerCase().includes(addonSearch.toLowerCase()));
  const isDynamic = formData.price_type === 'dynamic';

  const calculateServings = (item: any) => {
    const ings = item.ingredients || []; if (!ings.length) return null;
    let min = Infinity;
    ings.forEach((ing:any) => {
      const inv = inventory.find((i:any) => i.id===ing.inventory_id);
      if (inv) min = Math.min(min, Math.floor(inv.quantity/ing.quantity)); else min=0;
    });
    return min===Infinity ? 0 : min;
  };

  const getAssignedTemplates = (targetId: string, type: ScheduleScope) => {
    const ids = type==='menu' ? (itemAssignments[targetId]??[]) : (categoryAssignments[targetId]??[]);
    return templates.filter(t=>ids.includes(t.id));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('menu.title','Menu Management')}</h1>
          <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">{t('menu.subtitle','Manage categories, items, schedules, and add-ons.')}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setShowPreview(true)}
            className="flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] text-gray-600 dark:text-neutral-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-neutral-800/50">
            <Eye className="w-4 h-4 mr-2"/> Preview Schedule
          </button>
          {activeTab !== 'categories' && activeTab !== 'schedules' && (
            <button onClick={() => setShowCsvGuide(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-gray-200 dark:border-[var(--sb-border)] text-gray-600 dark:text-neutral-400 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-neutral-800/50">
              <Upload className="w-4 h-4 mr-2"/> Import CSV
            </button>
          )}
          {activeTab === 'items' && (
            <button onClick={handleSuggestItems} disabled={suggesting}
              className="flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
              {suggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
              AI Suggestions
            </button>
          )}
          {activeTab === 'addons' && (
            <button onClick={handleSuggestAddons} disabled={suggestingAddons}
              className="flex items-center px-4 py-2 bg-white dark:bg-[var(--sb-card)] border border-indigo-200 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
              {suggestingAddons ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
              AI Suggestions
            </button>
          )}
          {activeTab === 'schedules' ? (
            <button onClick={() => setTplModal({})}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2"/> New Template
            </button>
          ) : (
            <button onClick={() => handleOpenModal()}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2"/> Add New
            </button>
          )}
        </div>
      </div>

      {/* ── Preview Modal ── */}
      {showPreview && (
        <PreviewModal
          items={items} categories={categories} templates={templates}
          itemAssignments={itemAssignments} categoryAssignments={categoryAssignments}
          onClose={()=>setShowPreview(false)}
        />
      )}

      {/* ── CSV Guide ── */}
      {showCsvGuide && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-indigo-600"/> CSV Import Guide</h3>
              <button onClick={()=>setShowCsvGuide(false)} className="text-gray-400 dark:text-neutral-500 hover:text-gray-500 dark:text-neutral-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-[10px] text-emerald-400 overflow-x-auto">
                {activeTab==='items' ? <>type, name, price, category, description, price_type, price_unit, price_min, price_max<br/>item, Nasi Lemak, 12.50, Main, Rice dish, fixed,,,<br/>item, Siakap, 0, Seafood, Fresh fish, dynamic, per kg, 35, 80</> : <>name, price<br/>Extra Egg, 1.50<br/>Cheese, 2.00</>}
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <input type="file" ref={activeTab==='items'?fileInputRef:addonFileInputRef} accept=".csv" className="hidden"
                  onChange={e=>handleCsvUpload(e, activeTab==='items'?'items':'addons')}/>
                <button onClick={()=>(activeTab==='items'?fileInputRef:addonFileInputRef).current?.click()} disabled={csvUploading}
                  className="w-full py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center">
                  {csvUploading ? <Loader2 className="w-3 h-3 mr-2 animate-spin"/> : <Upload className="w-3 h-3 mr-2"/>} Select CSV File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI suggestions ── */}
      {showSuggestions && activeTab==='items' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2"><Sparkles className="w-5 h-5"/> AI Suggestions</h3>
            <button onClick={()=>setShowSuggestions(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {suggestions.map((s,i)=>(
              <div key={i} className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-lg border border-indigo-100 shadow-sm">
                <h4 className="font-bold text-gray-900 dark:text-neutral-100 mb-1">{s.name}</h4>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mb-2 line-clamp-2">{s.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-600">RM {s.estimated_price}</span>
                  <button onClick={()=>{ const cat=categories.find((c:any)=>c.name.toLowerCase()===s.suggested_category?.toLowerCase()); handleOpenModal(null,{ name:s.name, description:s.description, base_price:s.estimated_price, category_id:cat?.id||'' }); setSuggestions(p=>p.filter(x=>x.name!==s.name)); }}
                    className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3"/> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddonSuggestions && activeTab==='addons' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-indigo-900 flex items-center gap-2"><Sparkles className="w-5 h-5"/> AI Add-on Suggestions</h3>
            <button onClick={()=>setShowAddonSuggestions(false)} className="text-indigo-400 hover:text-indigo-600"><X className="w-5 h-5"/></button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {addonSuggestions.map((s,i)=>(
              <div key={i} className="bg-white dark:bg-[var(--sb-card)] p-4 rounded-lg border border-indigo-100">
                <h4 className="font-bold text-gray-900 dark:text-neutral-100 mb-3">{s.name}</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-indigo-600">+RM {s.estimated_price}</span>
                  <button onClick={()=>{ handleOpenModal(null,{ name:s.name, price:s.estimated_price }); setAddonSuggestions(p=>p.filter(x=>x.name!==s.name)); }}
                    className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1">
                    <Plus className="w-3 h-3"/> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Alert ── */}
      {alert && (
        <div className={cn('px-4 py-3 rounded-lg text-sm font-medium border',
          alert.type==='success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200')}>
          {alert.message}
        </div>
      )}

      {/* ── Table Card ── */}
      <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl border border-gray-200 dark:border-[var(--sb-border)] shadow-sm overflow-hidden">

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-[var(--sb-border)]">
          <div className="flex items-center px-6 py-3 gap-6 overflow-x-auto">
            {(['items','categories','addons','schedules'] as const).map(tab=>(
              <button key={tab} onClick={()=>setActiveTab(tab)}
                className={cn('text-sm font-medium pb-3 border-b-2 -mb-[13px] transition-colors whitespace-nowrap flex items-center gap-1.5',
                  activeTab===tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 dark:text-neutral-500 hover:text-gray-700 dark:text-neutral-300')}>
                {tab==='schedules' && <LayoutTemplate className="w-3.5 h-3.5"/>}
                {tab==='items' ? 'Menu Items' : tab==='categories' ? 'Categories' : tab==='addons' ? 'Add-ons' : 'Schedules'}
                {tab==='schedules' && templates.length>0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">{templates.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-[var(--sb-border)] bg-gray-50 dark:bg-neutral-800/50/50 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500"/>
            <input type="text" placeholder="Search..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
          </div>
          {activeTab==='items' && categories.length>0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 dark:text-neutral-500 shrink-0"/>
              <div className="flex flex-wrap gap-2">
                <button onClick={()=>setFilterCategory('all')} className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', filterCategory==='all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600 hover:border-indigo-300')}>All</button>
                {categories.map((cat:any)=>(
                  <button key={cat.id} onClick={()=>setFilterCategory(cat.id)} className={cn('px-3 py-1 rounded-full text-xs font-medium border transition-colors', filterCategory===cat.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[var(--sb-card)] text-gray-600 dark:text-neutral-400 border-gray-300 dark:border-neutral-600 hover:border-indigo-300')}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            TABLE BODY
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">

            {/* ── SCHEDULES tab ── */}
            {activeTab==='schedules' && (
              <>
                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-medium border-b border-gray-200 dark:border-[var(--sb-border)]">
                  <tr>
                    <th className="px-6 py-3">Template Name</th>
                    <th className="px-6 py-3">Time Slots</th>
                    <th className="px-6 py-3">Status Now</th>
                    <th className="px-6 py-3">Used By</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>Loading...</td></tr>
                  ) : filteredTemplates.length===0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <LayoutTemplate className="w-10 h-10 text-gray-300 mx-auto mb-3"/>
                        <p className="text-sm font-semibold text-gray-500 dark:text-neutral-500 mb-1">No schedule templates yet</p>
                        <p className="text-xs text-gray-400 dark:text-neutral-500 mb-4">Create reusable schedules then assign them to menu items or categories.</p>
                        <button onClick={()=>setTplModal({})} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                          <Plus className="w-4 h-4"/> Create First Template
                        </button>
                      </td>
                    </tr>
                  ) : filteredTemplates.map(tpl => {
                    const c    = getColor(tpl.color);
                    const live = checkAvailableNow(tpl.slots);
                    const usedBy = [
                      ...Object.entries(itemAssignments).filter(([,ids])=>(ids as string[]).includes(tpl.id)).map(([id])=>items.find((i:any)=>i.id===id)?.name).filter(Boolean),
                      ...Object.entries(categoryAssignments).filter(([,ids])=>(ids as string[]).includes(tpl.id)).map(([id])=>categories.find((c:any)=>c.id===id)?.name).filter(Boolean),
                    ] as string[];
                    return (
                      <tr key={tpl.id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn('w-3 h-3 rounded-full shrink-0', c.dot)}/>
                            <span className="font-semibold text-gray-900 dark:text-neutral-100">{tpl.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 dark:text-neutral-500 max-w-xs">
                          <p className="truncate">{slotSummary(tpl.slots)}</p>
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {DAYS.map((d,i) => {
                              const active = tpl.slots.some(s=>s.day_of_week===i);
                              return (
                                <span key={d} className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border',
                                  active ? cn(c.bg,c.text,c.border) : 'bg-gray-50 dark:bg-neutral-800/50 text-gray-300 border-gray-200 dark:border-[var(--sb-border)]')}>{d}</span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {tpl.slots.length===0 ? (
                            <span className="text-xs text-gray-400 dark:text-neutral-500 italic">No slots</span>
                          ) : live ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> Live Now
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-full border border-gray-200 dark:border-[var(--sb-border)]">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/> Off-Hours
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {usedBy.length===0 ? (
                            <span className="text-xs text-gray-400 dark:text-neutral-500 italic">Not assigned</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {usedBy.slice(0,3).map((n,i)=>(
                                <span key={i} className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 rounded-full">{n}</span>
                              ))}
                              {usedBy.length>3 && <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-500 rounded-full">+{usedBy.length-3}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={()=>setTplModal(tpl)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={()=>setTplDelete(tpl)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}

            {/* ── CATEGORIES tab ── */}
            {activeTab==='categories' && (
              <>
                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-medium border-b border-gray-200 dark:border-[var(--sb-border)]">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Schedule</th>
                    <th className="px-6 py-3">Tax Override</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>Loading...</td></tr>
                  ) : filteredCategories.length===0 ? (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500">No categories found.</td></tr>
                  ) : filteredCategories.map((cat:any) => {
                    const assigned = getAssignedTemplates(cat.id, 'category');
                    const allSlots = assigned.flatMap(t=>t.slots);
                    const liveNow  = allSlots.length>0 && checkAvailableNow(allSlots);
                    return (
                      <tr key={cat.id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-neutral-100">{cat.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {assigned.length===0 ? (
                              <span className="text-xs text-gray-400 dark:text-neutral-500 italic">Always available</span>
                            ) : (
                              assigned.map(tpl=>(
                                <TemplatePill key={tpl.id} tpl={tpl} liveNow={checkAvailableNow(tpl.slots)}/>
                              ))
                            )}
                            <button
                              onClick={()=>setAssignTarget({ id:cat.id, name:cat.name, type:'category' })}
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-all">
                              <AlarmClock className="w-3 h-3"/> Assign
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select value={categoryTaxRules[cat.id]??''} onChange={e=>saveTaxOverride('category',cat.id,e.target.value)}
                              className="text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-lg px-2 py-1.5 text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] focus:ring-2 focus:ring-indigo-500">
                              <option value="">Default (global)</option>
                              <option value="exempt">🚫 Exempt</option>
                              {taxConfigs.filter((t:any)=>t.is_active).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {taxSaving===cat.id && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={()=>handleOpenModal(cat)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={()=>setDeleteModal({ isOpen:true, id:cat.id, name:cat.name })} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}

            {/* ── ITEMS tab ── */}
            {activeTab==='items' && (
              <>
                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-medium border-b border-gray-200 dark:border-[var(--sb-border)]">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3">Schedule</th>
                    <th className="px-6 py-3">Availability</th>
                    <th className="px-6 py-3">Tax</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>Loading...</td></tr>
                  ) : filteredItems.length===0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500">No items found.</td></tr>
                  ) : filteredItems.map((item:any) => {
                    const assigned = getAssignedTemplates(item.id, 'menu');
                    const allSlots = assigned.flatMap(t=>t.slots);
                    const liveNow  = allSlots.length>0 && checkAvailableNow(allSlots);
                    const isDisabled = item.is_available===false;
                    const servings   = calculateServings(item);
                    return (
                      <tr key={item.id} className={cn('hover:bg-gray-50 dark:bg-neutral-800/50', isDisabled && 'opacity-60 bg-red-50/20')}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900 dark:text-neutral-100">{item.name}</span>
                            <div className="flex gap-1 flex-wrap">
                              <PriceTypeBadge type={item.price_type??'fixed'}/>
                              {isDisabled && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                  <EyeOff className="w-2.5 h-2.5"/> Disabled
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 dark:text-neutral-500">{item.category_name}</td>
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-neutral-100">{formatPrice(item)}</td>

                        {/* Schedule cell */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {assigned.length===0 ? (
                              <span className="text-xs text-gray-400 dark:text-neutral-500 italic">Always on</span>
                            ) : (
                              assigned.map(tpl=>(
                                <TemplatePill key={tpl.id} tpl={tpl} liveNow={checkAvailableNow(tpl.slots)}/>
                              ))
                            )}
                            <button
                              onClick={()=>setAssignTarget({ id:item.id, name:item.name, type:'menu' })}
                              className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-all">
                              <AlarmClock className="w-3 h-3"/> Assign
                            </button>
                          </div>
                        </td>

                        {/* Availability */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button onClick={()=>toggleManualOverride(item)} disabled={overrideSaving===item.id}
                              title={isDisabled?'Enable item':'Disable item (manual override)'}
                              className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                                isDisabled
                                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200')}>
                              {overrideSaving===item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : isDisabled ? <ToggleLeft className="w-3.5 h-3.5"/> : <ToggleRight className="w-3.5 h-3.5"/>}
                              {isDisabled?'Off':'On'}
                            </button>
                            {servings!==null && (
                              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                                servings>10?'bg-emerald-100 text-emerald-800':servings>0?'bg-amber-100 text-amber-800':'bg-red-100 text-red-800')}>
                                {servings} servings
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tax */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select value={itemTaxOverrides[item.id]??''} onChange={e=>saveTaxOverride('item',item.id,e.target.value)}
                              className="text-xs border border-gray-200 dark:border-[var(--sb-border)] rounded-lg px-2 py-1.5 text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] focus:ring-2 focus:ring-indigo-500">
                              <option value="">Default</option>
                              <option value="exempt">🚫 Exempt</option>
                              {taxConfigs.filter((t:any)=>t.is_active).map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {taxSaving===item.id && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                          </div>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={()=>handleOpenModal(item)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={()=>setDeleteModal({ isOpen:true, id:item.id, name:item.name })} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </>
            )}

            {/* ── ADD-ONS tab ── */}
            {activeTab==='addons' && (
              <>
                <thead className="bg-gray-50 dark:bg-neutral-800/50 text-gray-500 dark:text-neutral-500 font-medium border-b border-gray-200 dark:border-[var(--sb-border)]">
                  <tr>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Price</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/>Loading...</td></tr>
                  ) : filteredAddons.length===0 ? (
                    <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-neutral-500">No add-ons found.</td></tr>
                  ) : filteredAddons.map((addon:any)=>(
                    <tr key={addon.id} className="hover:bg-gray-50 dark:bg-neutral-800/50">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-neutral-100">{addon.name}</td>
                      <td className="px-6 py-4 text-gray-900 dark:text-neutral-100">RM {addon.price?.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={()=>handleOpenModal(addon)} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-indigo-600"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={()=>setDeleteModal({ isOpen:true, id:addon.id, name:addon.name })} className="p-1 text-gray-400 dark:text-neutral-500 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}

          </table>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════════════════ */}

      {/* ── Template CRUD modal ── */}
      {tplModal !== false && (
        <TemplateCrudModal
          template={tplModal}
          onSave={saveTemplate}
          onClose={()=>setTplModal(false)}
          saving={tplSaving}
        />
      )}

      {/* ── Assign Schedule modal ── */}
      {assignTarget && (
        <AssignScheduleModal
          targetId={assignTarget.id}
          targetName={assignTarget.name}
          targetType={assignTarget.type}
          templates={templates}
          assigned={assignTarget.type==='menu' ? (itemAssignments[assignTarget.id]??[]) : (categoryAssignments[assignTarget.id]??[])}
          onSave={saveAssignment}
          onClose={()=>setAssignTarget(null)}
          saving={assignSaving}
        />
      )}

      {/* ── Template delete confirmation ── */}
      {tplDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600"/></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 text-center mb-1">Delete Template</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-500 text-center mb-6">
              Delete <span className="font-semibold text-gray-900 dark:text-neutral-100">"{tplDelete.name}"</span>?
              All assignments using this template will be removed.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setTplDelete(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
              <button onClick={()=>deleteTemplate(tplDelete)} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item / Category / Addon edit modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={cn('bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full overflow-hidden flex flex-col max-h-[90vh]', activeTab==='items'?'max-w-4xl':'max-w-md')}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-[var(--sb-border)] shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100">
                {editingItem?'Edit':'Add'} {activeTab==='items'?'Menu Item':activeTab==='categories'?'Category':'Add-on'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 dark:text-neutral-500 hover:text-gray-500 dark:text-neutral-500"><X className="w-5 h-5"/></button>
            </div>
            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className={cn('p-4 overflow-y-auto', activeTab==='items'?'grid grid-cols-1 md:grid-cols-2 gap-6':'space-y-4')}>
                {/* Left column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Name</label>
                    <input type="text" name="name" value={formData.name||''} onChange={handleChange} required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                  </div>

                  {activeTab==='items' && ( <> <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Category</label> <select name="category_id" value={formData.category_id||''} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"> <option value="">Select a category</option> {categories.map((cat:any)=><option key={cat.id} value={cat.id}>{cat.name}</option>)} </select> </div> <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-2">Price Type</label> <div className="grid grid-cols-2 gap-2"> <button type="button" onClick={()=>handlePriceTypeChange('fixed')} className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold', !isDynamic?'border-indigo-600 bg-indigo-50 text-indigo-700':'border-gray-200 dark:border-[var(--sb-border)] bg-white dark:bg-[var(--sb-card)] text-gray-500 dark:text-neutral-500')}> <Tag className="w-4 h-4"/> Fixed </button> <button type="button" onClick={()=>handlePriceTypeChange('dynamic')} className={cn('flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold', isDynamic?'border-amber-500 bg-amber-50 text-amber-700':'border-gray-200 dark:border-[var(--sb-border)] bg-white dark:bg-[var(--sb-card)] text-gray-500 dark:text-neutral-500')}> <Scale className="w-4 h-4"/> Dynamic </button> </div> </div> {!isDynamic && ( <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Price (RM)</label> <input type="number" name="base_price" step="0.01" value={formData.base_price||''} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/> </div> )} {isDynamic && ( <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3"> <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Price Unit <span className="text-red-500">*</span></label> <input type="text" name="price_unit" value={formData.price_unit||''} onChange={handleChange} placeholder="e.g. per kg" className="w-full px-3 py-2 border border-amber-200 bg-white dark:bg-[var(--sb-card)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"/> </div> <div className="grid grid-cols-2 gap-3"> <div><label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Min (RM)</label><input type="number" name="price_min" step="0.01" value={formData.price_min??''} onChange={handleChange} className="w-full px-3 py-2 border border-amber-200 bg-white dark:bg-[var(--sb-card)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"/></div> <div><label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Max (RM)</label><input type="number" name="price_max" step="0.01" value={formData.price_max??''} onChange={handleChange} className="w-full px-3 py-2 border border-amber-200 bg-white dark:bg-[var(--sb-card)] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"/></div> </div> <p className="text-xs font-semibold text-amber-800 border-t border-amber-200 pt-2">{formatPrice(formData)}</p> </div> )} <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Description</label> <textarea name="description" value={formData.description||''} onChange={handleChange} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"/> </div> <div> <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1 flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Image</label> <div className="flex flex-col gap-3"> <div className="flex items-center gap-3"> <label className="flex-1 cursor-pointer bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:bg-neutral-800/50 text-gray-700 dark:text-neutral-300 py-2 px-3 rounded-lg text-sm font-medium text-center"> {imageUploadLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto"/> : 'Upload'} <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={imageUploadLoading}/> </label> <span className="text-gray-400 dark:text-neutral-500 text-sm">or</span> <input type="url" name="image_url" value={formData.image_url||''} onChange={handleChange} placeholder="https://…" className="flex-[2] px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"/> </div> {(formData._previewUrl || formData.image_url) && (
                    <div className="relative w-24 h-24 rounded-lg border border-gray-200 dark:border-[var(--sb-border)] overflow-hidden bg-gray-50 dark:bg-neutral-800/50">
                      <img src={formData._previewUrl || formData.image_url} alt="Preview" className="w-full h-full object-cover"/>
                      <button type="button" onClick={()=>setFormData((p:any)=>({...p,image_url:'',_previewUrl:undefined}))} className="absolute top-1 right-1 p-1 bg-white dark:bg-[var(--sb-card)]/80 rounded-full text-red-600"><X className="w-3 h-3"/></button>
                    </div>
                  )} </div> </div> </> )}

                  {activeTab==='addons' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Price (RM)</label>
                      <input type="number" name="price" step="0.01" value={formData.price||''} onChange={handleChange} required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                  )}
                  {activeTab==='categories' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">Sort Order</label>
                      <input type="number" name="sort_order" value={formData.sort_order||0} onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
                    </div>
                  )}
                </div>

                {/* Right column — items only */}
                {activeTab==='items' && (
                  <div className="space-y-6">
                    {/* Recipe */}
                    <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)]">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-medium text-gray-900 dark:text-neutral-100 flex items-center gap-2"><Utensils className="w-4 h-4"/> Recipe / Ingredients</label>
                        <button type="button" onClick={handleSuggestIngredients} disabled={suggestingIngredients}
                          className="text-xs font-medium text-indigo-600 flex items-center bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 disabled:opacity-50">
                          {suggestingIngredients ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <Sparkles className="w-3 h-3 mr-1"/>} Auto-suggest
                        </button>
                      </div>
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500"/>
                        <input type="text" placeholder="Search inventory…" value={ingredientSearch} onChange={e=>setIngredientSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[var(--sb-card)]"/>
                      </div>
                      {selectedIngredients.length>0 && (
                        <div className="mb-3 space-y-2 max-h-40 overflow-y-auto pr-1">
                          {selectedIngredients.map(ing=>(
                            <div key={ing.inventory_id} className="flex items-center gap-2 bg-white dark:bg-[var(--sb-card)] p-2 rounded-lg border border-gray-200 dark:border-[var(--sb-border)]">
                              <span className="text-sm font-medium text-gray-900 dark:text-neutral-100 flex-1 truncate">{ing.name}</span>
                              <input type="number" value={ing.quantity}
                                onChange={e=>setSelectedIngredients(p=>p.map(i=>i.inventory_id===ing.inventory_id?{...i,quantity:parseFloat(e.target.value)}:i))}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-neutral-600 rounded text-sm focus:outline-none"/>
                              <span className="text-xs text-gray-500 dark:text-neutral-500 w-6">{ing.unit}</span>
                              <button type="button" onClick={()=>setSelectedIngredients(p=>p.filter(i=>i.inventory_id!==ing.inventory_id))} className="text-gray-400 dark:text-neutral-500 hover:text-red-600"><X className="w-4 h-4"/></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-[var(--sb-border)] rounded-lg divide-y divide-gray-100 bg-white dark:bg-[var(--sb-card)]">
                        {inventory.filter((i:any)=>i.name.toLowerCase().includes(ingredientSearch.toLowerCase())).map((inv:any)=>(
                          <button key={inv.id} type="button"
                            onClick={()=>{ if (!selectedIngredients.find(i=>i.inventory_id===inv.id)) setSelectedIngredients(p=>[...p,{ inventory_id:inv.id, quantity:1, name:inv.name, unit:inv.unit }]); }}
                            className="w-full flex items-center p-2 hover:bg-gray-50 dark:bg-neutral-800/50 text-left">
                            <Plus className="w-3 h-3 mr-2 text-indigo-600"/>
                            <span className="text-sm text-gray-900 dark:text-neutral-100 flex-1 truncate">{inv.name}</span>
                            <span className="text-xs text-gray-500 dark:text-neutral-500">{inv.quantity} {inv.unit}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Add-ons */}
                    <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-200 dark:border-[var(--sb-border)]">
                      <label className="block text-sm font-medium text-gray-900 dark:text-neutral-100 mb-2">Assign Add-ons</label>
                      <div className="relative mb-3">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-neutral-500"/>
                        <input type="text" placeholder="Search add-ons…" value={addonSearch} onChange={e=>setAddonSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[var(--sb-card)]"/>
                      </div>
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-[var(--sb-border)] rounded-lg divide-y divide-gray-100 bg-white dark:bg-[var(--sb-card)]">
                        {filteredAddonSearch.map((addon:any)=>(
                          <label key={addon.id} className="flex items-center p-3 hover:bg-gray-50 dark:bg-neutral-800/50 cursor-pointer">
                            <input type="checkbox" checked={selectedAddons.includes(addon.id)} onChange={()=>setSelectedAddons(p=>p.includes(addon.id)?p.filter(id=>id!==addon.id):[...p,addon.id])}
                              className="w-4 h-4 text-indigo-600 border-gray-300 dark:border-neutral-600 rounded"/>
                            <span className="ml-3 text-sm text-gray-900 dark:text-neutral-100 flex-1">{addon.name}</span>
                            <span className="text-sm text-gray-500 dark:text-neutral-500">+RM {addon.price?.toFixed(2)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-[var(--sb-border)] flex justify-end gap-3 shrink-0 bg-gray-50 dark:bg-neutral-800/50">
                <button type="button" onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {deleteModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--sb-card)] rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-600"/></div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-neutral-100 text-center mb-1">Delete Item</h3>
            <p className="text-sm text-gray-500 dark:text-neutral-500 text-center mb-6">
              Delete <span className="font-semibold text-gray-900 dark:text-neutral-100">"{deleteModal.name}"</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteModal(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-neutral-300 bg-white dark:bg-[var(--sb-card)] border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:bg-neutral-800/50">Cancel</button>
              <button onClick={handleDeleteConfirm} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}