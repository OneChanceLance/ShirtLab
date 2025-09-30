// Text effects helpers: per-character transforms + spacing adjustments
// Usage: call getEffectTransform() for each character index when laying out text.

import type { EffectName, EffectOptions } from '../../shirtlab/types';

export type EffectAlias = 'pull up' | 'spread out';

export type EffectMeta = {
    key: EffectName;
    label: string;
    desc: string;
    // Reasonable UI defaults per effect
    defaults: Partial<EffectOptions>;
};

export interface CharTransform {
    x: number; // offset (px)
    y: number; // offset (px)
    rotation: number; // radians
    scaleX: number;
    scaleY: number;
}

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const normT = (i: number, n: number) => (n <= 1 ? 0 : (i / (n - 1)) * 2 - 1);

// Public: metadata for your UI
export const EFFECTS: EffectMeta[] = [
    { key: 'none', label: 'None', desc: 'No distortion', defaults: {} },
    { key: 'curve', label: 'Curve', desc: 'Lay text along a circular arc', defaults: { radius: 300, strength: 1, invert: false } },
    { key: 'arch', label: 'Arch', desc: 'Arched baseline (smile/frown)', defaults: { radius: 300, strength: 1, invert: true } },
    { key: 'bulge', label: 'Bulge', desc: 'Thicker in middle, thinner at ends', defaults: { strength: 1, power: 2 } },
    { key: 'pinch', label: 'Pinch', desc: 'Thinner in middle, thicker at ends', defaults: { strength: 1, power: 2 } },
    { key: 'wave', label: 'Wave', desc: 'Sine-wave vertical baseline', defaults: { amplitude: 15, frequency: 1, phase: 0, strength: 1 } },
    { key: 'pullUp', label: 'Pull Up', desc: 'Lift the center upward', defaults: { strength: 1 } },
    { key: 'spreadOut', label: 'Spread', desc: 'Increase spacing across the word', defaults: { trackingPx: 1, invert: false, strength: 1 } },
    { key: 'twist', label: 'Twist', desc: 'Rotate progressively across text', defaults: { twistDeg: 10, strength: 1 } },
];

// Alias mapping so UI strings like "pull up" work
export function normalizeEffectName(name: string): EffectName {
    const s = name.trim().toLowerCase();
    if (s === 'pull up') return 'pullUp';
    if (s === 'spread out') return 'spreadOut';
    const hit = EFFECTS.find(e => e.key.toLowerCase() === s || e.label.toLowerCase() === s);
    return (hit?.key || 'none') as EffectName;
}

// Provide robust defaults merged with per-effect defaults
export function withDefaults(name: EffectName, opts?: Partial<EffectOptions>): EffectOptions {
    const base: EffectOptions = {
        strength: 1,
        radius: 300,
        amplitude: 10,
        frequency: 1,
        twistDeg: 0,
        trackingPx: 0,
        phase: 0,
        power: 2,
        invert: false,
    };
    const eff = EFFECTS.find(e => e.key === name);
    const merged = { ...base, ...(eff?.defaults || {}), ...(opts || {}) } as EffectOptions;
    return merged;
}

// Main API: compute per-character transform for a given effect
// i: glyph index, n: total glyphs, opts: effect-specific options from withDefaults()
export function getEffectTransform(name: EffectName, i: number, n: number, opts: EffectOptions): CharTransform {
    const t = normT(i, n); // -1..1 across the string
    switch (name) {
        case 'curve': return curveTransform(t, n, opts);
        case 'arch': return archTransform(t, n, opts);
        case 'bulge': return bulgeTransform(t, n, opts);
        case 'pinch': return pinchTransform(t, n, opts);
        case 'wave': return waveTransform(i, n, opts);
        case 'pullUp': return pullUpTransform(t, n, opts);
        case 'twist': return twistTransform(t, n, opts);
        case 'spreadOut': return spreadOutTransform(t, n, opts);
        case 'none':
        default:
            return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
    }
}
// ---------- helpers ----------

// getEffectTransform chooses these by name
function curveTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    // “CURVE” in the pic: baseline arcs UP and letters tilt along the arc
    const s = (opts.strength ?? 1) / 6;               // global strength scaling
    const R = Math.max(1, opts.radius);
    const sweepDeg = 36 * s;                          // total sweep across -1..1
    const a = (t * sweepDeg) * DEG2RAD;

    // up by default; invert flips down
    const bendDir = opts.invert ? 1 : -1;
    const y = bendDir * (R - Math.cos(a) * R);

    // tangent rotation so letters actually “curve”
    const rotation = a;
    return { x: 0, y, rotation, scaleX: 1, scaleY: 1 };
}

function archTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    // “ARCH” in the pic: baseline arcs UP, letters stay upright, and we squeeze toward center
    const s = (opts.strength ?? 1) / 6;
    const R = Math.max(1, opts.radius);
    const sweepDeg = 40 * s;
    const a = (t * sweepDeg) * DEG2RAD;

    // up by default (your EFFECTS default has invert:true; this keeps that visual)
    const bendDir = opts.invert ? -1 : 1;
    const y = bendDir * (R - Math.cos(a) * R);

    // pinch-like squeeze toward middle (subtle, like the tile)
    const k = 1 - Math.abs(t);
    const p = Math.max(0.1, opts.power ?? 2);
    const amt = (s) * Math.pow(k, p);                 // scale by strength
    const scaleY = 1 - amt;                            // shorter in the middle
    const scaleX = 1 + amt * 0.5;                      // slight widen to keep weight

    return { x: 0, y, rotation: 0, scaleX, scaleY };
}

function bulgeTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    // “BULGE”: center gets taller/fatter; ends normal
    const s = (opts.strength ?? 1) / 6;
    const k = clamp(1 - Math.abs(t), 0, 1);
    const p = Math.max(0.1, opts.power ?? 2);
    const amt = s * Math.pow(k, p);

    const scaleY = 1 + amt;          // taller in middle
    const scaleX = 1 - amt * 0.5;    // a bit narrower to balance
    return { x: 0, y: 0, rotation: 0, scaleX, scaleY };
}

function pinchTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    // “PINCH”: center gets thinner/shorter; ends a hair wider
    const s = (opts.strength ?? 1) / 6;
    const k = clamp(1 - Math.abs(t), 0, 1);
    const p = Math.max(0.1, opts.power ?? 2);
    const amt = s * Math.pow(k, p);

    const scaleY = 1 - amt;          // shorter in middle
    const scaleX = 1 + amt * 0.5;    // slightly wider to compensate
    return { x: 0, y: 0, rotation: 0, scaleX, scaleY };
}

function waveTransform(i: number, n: number, opts: EffectOptions): CharTransform {
    // “WAVE”: gentle sine baseline, letters upright
    const s = (opts.strength ?? 1) / 6;
    const amp = (opts.amplitude ?? 10) * (0.75 + s);  // strength nudges amplitude
    const freq = Math.max(0.0001, opts.frequency ?? 1);
    const phase = opts.phase ?? 0;

    const t01 = n <= 1 ? 0 : i / (n - 1);
    const y = Math.sin((t01 * TAU * freq) + phase) * amp;
    return { x: 0, y, rotation: 0, scaleX: 1, scaleY: 1 };
}

function pullUpTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    const s = (opts.strength ?? 1) / 6;          // global divide-by-6
    const p = Math.max(0.1, opts.power ?? 2);    // same falloff knob you use for pinch/bulge
    const k = 1 - Math.abs(t);                   // 1 at center → 0 at edges
    const amt = s * Math.pow(k, p);              // how much to stretch at this glyph

    // stretch only: keep baseline fixed (y=0), upright letters
    const scaleY = 1 + amt;                      // taller in the middle
    const scaleX = 1 - amt * 0.15;               // tiny counter-squash so weight feels consistent

    return { x: 0, y: 0, rotation: 0, scaleX, scaleY };
}

function twistTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    // “TWIST”: progressive rotation across the word, no vertical move
    const s = (opts.strength ?? 1) / 6;
    const deg = (opts.twistDeg ?? 18) * s;
    const rotation = (deg * t) * DEG2RAD;
    return { x: 0, y: 0, rotation, scaleX: 1, scaleY: 1 };
}

// Spread Out: stretch (scaleY) toward the center; no baseline shift, no rotation.
// Spread Out: stretch toward the center; pivot handled in draw loop.
function spreadOutTransform(t: number, _n: number, opts: EffectOptions): CharTransform {
    const s = (opts.strength ?? 1) / 6;
    const p = Math.max(0.1, opts.power ?? 2);
    const k = 1 - Math.abs(t);
    const amt = s * Math.pow(k, p);      // strongest at center

    // stretch only; no vertical offset here
    const scaleY = 1 + amt;              // taller in the middle
    const scaleX = 1 - amt * 0.15;       // tiny counter-squash to keep weight

    return { x: 0, y: 0, rotation: 0, scaleX, scaleY };
}
export function getEffectAdvance(name: EffectName): number {
    return 0; // Spread Out doesn't add tracking anymore
}
// Convenience: apply a transform to a canvas 2D context before drawing a glyph
// Call inside your per-glyph render: ctx.save(); applyToContext(ctx, baseX, baseY, transform); draw; ctx.restore();
// effectsList.ts
export function applyToContext(
    ctx: CanvasRenderingContext2D,
    baseX: number,
    baseY: number,
    tr: CharTransform,
    originX = 0,
    originY = 0
) {
    ctx.translate(baseX + tr.x, baseY + tr.y);
    if (originX || originY) ctx.translate(originX, originY);   // <-- move to pivot
    if (tr.rotation) ctx.rotate(tr.rotation);
    if (tr.scaleX !== 1 || tr.scaleY !== 1) ctx.scale(tr.scaleX, tr.scaleY);
    if (originX || originY) ctx.translate(-originX, -originY); // <-- move back
}
// Example driver (pseudo-code):
// const name = normalizeEffectName(userEffect);
// const opts = withDefaults(name, userKnobs);
// for (let i=0;i<n;i++) {
//   const tr = getEffectTransform(name, i, n, opts);
//   const extra = getEffectAdvance(name, i, n, opts);
//   const x = cursorX; const y = baselineY;
//   ctx.save(); applyToContext(ctx, x, y, tr, glyphOriginX, glyphOriginY); drawGlyph(); ctx.restore();
//   cursorX += baseAdvance + extra;
// }
