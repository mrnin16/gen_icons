/**
 * Professional animated icon builder.
 *
 * Each icon ships with:
 *  - svgContent  : CSS-animated SVG (renders in-browser with no JS)
 *  - animationData (JSON):
 *      lottie     : full Lottie 5.x JSON for lottie-web playback + editor
 *      frames     : static SVG frames for server-side GIF encoding
 *      durationMs : loop duration
 *      colors     : default color palette (editable in the UI)
 *
 * Design philosophy:
 *  - stroke-dasharray/dashoffset for smooth path-drawing effects
 *  - cubic-bezier easing on every keyframe
 *  - staggered delays for multi-element animations
 *  - Lottie JSON uses real shape layers (ellipse, rect, trim-paths)
 *    so lottie-web renders them identically to the CSS version
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const NS  = 'xmlns="http://www.w3.org/2000/svg"';
const VB  = 'viewBox="0 0 24 24"';
const SVG = (body: string, extra = '') =>
  `<svg ${NS} ${VB} fill="none"${extra ? ' ' + extra : ''}>${body}</svg>`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnimatedIconSpec = {
  name: string;
  category: string;
  tags: string[];
  slug: string;
  build: () => AnimatedIconOutput;
};

export type AnimatedIconOutput = {
  svgContent: string;
  animationData: string;
};

type AnimData = {
  lottie: object;
  frames: string[];
  durationMs: number;
  colors: string[];
};

// ─── Lottie JSON helpers ──────────────────────────────────────────────────────

const FR = 60;
function ms2f(ms: number) { return Math.round((ms / 1000) * FR); }

type Ease = { i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } };
const EASE_OUT   : Ease = { i: { x: [0.25], y: [1]  }, o: { x: [0.42], y: [0] } };
const EASE_IN_OUT: Ease = { i: { x: [0.42], y: [1]  }, o: { x: [0.58], y: [0] } };
const EASE_SPRING: Ease = { i: { x: [0.18], y: [1.4]}, o: { x: [0.65], y: [0] } };
const EASE_LINEAR: Ease = { i: { x: [0.5],  y: [0.5]}, o: { x: [0.5],  y: [0.5]} };

function kf(t: number, s: number[], e?: number[] | Ease, ease: Ease = EASE_IN_OUT) {
  return { t, s, e, ...ease };
}

function animProp(keyframes: ReturnType<typeof kf>[]) {
  return { a: 1, k: keyframes };
}
type ShapePathInfo = { i: number[][]; o: number[][]; v: number[][]; c: boolean };
function staticProp(v: number[] | number | ShapePathInfo) {
  return { a: 0, k: v };
}

function colorKV(hex: string): number[] {
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  return [r, g, b, 1];
}

function lottieBase(name: string, durationMs: number, layers: object[]): object {
  return {
    v: '5.7.4', fr: FR, ip: 0, op: ms2f(durationMs),
    w: 24, h: 24, nm: name, ddd: 0, assets: [], layers,
  };
}

function shapeLayer(name: string, shapes: object[], transforms: object, ip = 0, op = 60): object {
  return {
    ddd: 0, ind: 0, ty: 4, nm: name,
    sr: 1, ks: transforms, ao: 0, ip, op, st: 0, bm: 0,
    shapes,
  };
}

function ellipseShape(cx: number, cy: number, w: number, h: number): object {
  return { ty: 'el', p: staticProp([cx, cy]), s: staticProp([w, h]), nm: 'Ellipse' };
}
function rectShape(cx: number, cy: number, w: number, h: number, r = 0): object {
  return { ty: 'rc', p: staticProp([cx, cy]), s: staticProp([w, h]), r: staticProp(r), nm: 'Rect' };
}

function strokeShape(color: string, width: number, lc = 2, lj = 2): object {
  return {
    ty: 'st', nm: 'Stroke',
    c: staticProp(colorKV(color)),
    o: staticProp(100),
    w: staticProp(width),
    lc, lj, ml: 4, d: [],
  };
}
function fillShape(color: string, opacity = 100): object {
  return {
    ty: 'fl', nm: 'Fill',
    c: staticProp(colorKV(color)),
    o: staticProp(opacity),
    r: 1,
  };
}
function trimShape(startProp: object, endProp: object, offsetProp?: object): object {
  return {
    ty: 'tm', nm: 'Trim',
    s: startProp,
    e: endProp,
    o: offsetProp ?? staticProp(0),
    m: 1,
  };
}
function groupShape(it: object[]): object {
  return { ty: 'gr', nm: 'Group', it, np: it.length, cix: 2, bm: 0, hd: false };
}

function baseKS(extra: Partial<Record<'r'|'p'|'s'|'o', object>> = {}): object {
  return {
    o: staticProp(100),
    r: staticProp(0),
    p: staticProp([12, 12, 0]),
    a: staticProp([0, 0, 0]),
    s: staticProp([100, 100, 100]),
    ...extra,
  };
}

// ─── Frame generators (static SVGs for GIF) ───────────────────────────────────

function dashFrames(
  inner: (dash: number, offset: number) => string,
  totalLen: number,
  count = 12,
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / count;
    const offset = totalLen * t;
    return inner(totalLen, offset);
  });
}

function rotFrames(inner: (deg: number) => string, count = 12): string[] {
  return Array.from({ length: count }, (_, i) =>
    inner((360 / count) * i)
  );
}

function scaleFrames(
  make: (s: number, op: number) => string,
  scales: number[],
  opacities: number[] = [],
): string[] {
  return scales.map((s, i) => make(s, opacities[i] ?? 1));
}

// ─── 1. Arc Spinner  (iOS / Material style) ──────────────────────────────────
//   Spinning arc with conic sweep — the arc itself rotates and the trailing
//   segment length oscillates, giving the classic "chasing dash" effect.

function arcSpinner(color = '#6d28d9', dur = 1400): AnimatedIconSpec {
  const C = 2 * Math.PI * 9; // circumference r=9 → ≈56.5
  const svgContent = SVG(
    `<style>
      @keyframes _aS{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes _aD{0%,100%{stroke-dashoffset:${(C*0.75).toFixed(1)}}50%{stroke-dashoffset:${(C*0.1).toFixed(1)}}}
    </style>
    <circle cx="12" cy="12" r="9"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}"
      style="transform-origin:50% 50%;
             animation:_aS ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite,
                       _aD ${dur * 1.2}ms cubic-bezier(0.42,0,0.58,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Arc Spinner', dur, [
    shapeLayer('ring', [
      groupShape([
        ellipseShape(0, 0, 18, 18),
        strokeShape(color, 2.5),
        trimShape(
          animProp([kf(0,[10],[10],EASE_LINEAR), kf(Math.round(op/2),[80],[80],EASE_LINEAR), kf(op,[10],[10],EASE_LINEAR)]),
          animProp([kf(0,[90],[90],EASE_LINEAR), kf(Math.round(op/2),[100],[100],EASE_LINEAR), kf(op,[90],[90],EASE_LINEAR)]),
          animProp([kf(0,[0],[360],EASE_LINEAR), kf(op,[360],[360],EASE_LINEAR)]),
        ),
      ]),
    ], baseKS({ r: animProp([kf(0,[0],[360],EASE_LINEAR), kf(op,[360],[360],EASE_LINEAR)]) }), 0, op),
  ]);
  const frames = rotFrames(deg => SVG(
    `<circle cx="12" cy="12" r="9" stroke="${color}" stroke-width="2.5" stroke-linecap="round"
       stroke-dasharray="${(C*0.7).toFixed(1)} ${(C*0.3).toFixed(1)}"
       transform="rotate(${deg},12,12)"/>`
  ), 12);
  return {
    name: 'Arc Spinner', category: 'animated', tags: ['loader','spinner','loading'],
    slug: 'arc-spinner-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 2. Checkmark Draw ───────────────────────────────────────────────────────
//   Circle closes in, then checkmark draws itself from left-to-right.

function checkmarkDraw(color = '#10b981', dur = 1200): AnimatedIconSpec {
  const cirLen = 2 * Math.PI * 10; // r=10 → ≈62.8
  const ckLen  = 18; // approx path length of "m5 12 4 4 8-8"
  const delay  = dur * 0.35;
  const svgContent = SVG(
    `<style>
      @keyframes _cC{0%{stroke-dashoffset:${cirLen.toFixed(1)}}60%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
      @keyframes _cK{0%,35%{stroke-dashoffset:${ckLen}}100%{stroke-dashoffset:0}}
    </style>
    <circle cx="12" cy="12" r="10"
      stroke="${color}" stroke-width="2" stroke-linecap="round"
      stroke-dasharray="${cirLen.toFixed(1)}"
      style="transform-origin:50% 50%;transform:rotate(-90deg);
             animation:_cC ${dur}ms cubic-bezier(0.16,1,0.3,1) forwards"/>
    <path d="m5 12 4 4 8-8"
      stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="${ckLen}" stroke-dashoffset="${ckLen}"
      style="animation:_cK ${dur}ms cubic-bezier(0.16,1,0.3,1) ${delay.toFixed(0)}ms forwards"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Checkmark Draw', dur, [
    shapeLayer('circle', [groupShape([ellipseShape(0,0,20,20), strokeShape(color,2), trimShape(animProp([kf(0,[0],[100],EASE_SPRING)]),staticProp([100]))])], baseKS({ r: staticProp(-90) }), 0, op),
    shapeLayer('check', [groupShape([{ ty:'sh', ks: staticProp({ i:[[0,0],[0,0],[0,0]], o:[[0,0],[0,0],[0,0]], v:[[-7,0],[0,4],[8,-8]], c:false }), nm:'Check' }, strokeShape(color,2.2), trimShape(animProp([kf(Math.round(op*0.35),[0],[100],EASE_SPRING)]), staticProp([100]))])], baseKS(), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const cOff=Math.max(0,cirLen*(1-t*1.5)).toFixed(1);
    const kOff=Math.max(0,ckLen*(1-Math.max(0,(t-0.35)/0.65))).toFixed(1);
    return SVG(`<circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${cirLen.toFixed(1)}" stroke-dashoffset="${cOff}" transform="rotate(-90,12,12)"/><path d="m5 12 4 4 8-8" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${ckLen}" stroke-dashoffset="${kOff}"/>`);
  });
  return {
    name: 'Checkmark Draw', category: 'animated', tags: ['success','check','done'],
    slug: 'checkmark-draw-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 3. Heartbeat Pulse ──────────────────────────────────────────────────────
//   Heart with double-thump ECG timing (lub-dub rhythm).

function heartbeatPulse(color = '#ef4444', dur = 1000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _hb{
        0%,100%{transform:scale(1)}
        8%{transform:scale(1.35)}
        16%{transform:scale(1)}
        28%{transform:scale(1.2)}
        40%{transform:scale(1)}
      }
    </style>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
      fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 50%;animation:_hb ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Heartbeat', dur, [
    shapeLayer('heart', [groupShape([
      { ty:'sh', ks: staticProp({ i:[[-3.5,1.5],[-3.5,-1.5],[0,3],[0,-1.5],[0,-3],[0,1.5],[3.5,-1.5],[3.5,1.5]], o:[[3.5,-1.5],[0,-3],[0,1.5],[3.5,-1.5],[-3.5,-1.5],[0,3],[-3.5,1.5],[0,3]], v:[[0,-5],[-7,-1],[-7,2],[0,7],[7,2],[7,-1],[0,-5],[0,-5]], c:true }), nm:'Heart' },
      strokeShape(color, 2),
      fillShape(color, 15),
    ])], baseKS({ s: animProp([kf(0,[100,100,100]),kf(Math.round(op*0.08),[135,135,100],EASE_SPRING),kf(Math.round(op*0.16),[100,100,100]),kf(Math.round(op*0.28),[120,120,100],EASE_SPRING),kf(Math.round(op*0.40),[100,100,100]),kf(op,[100,100,100])]) }), 0, op),
  ]);
  const scales = [1,1.35,1,1.2,1,1,1,1,1,1,1,1];
  const frames = scaleFrames(
    (s) => SVG(`<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(${12*(1-s)},${12*(1-s)}) scale(${s})"/>`),
    scales,
  );
  return {
    name: 'Heartbeat Pulse', category: 'animated', tags: ['heart','pulse','love'],
    slug: 'heartbeat-pulse-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 4. Ripple Ping ──────────────────────────────────────────────────────────
//   Central dot with 3 staggered expanding rings that fade out.

function ripplePing(color = '#0ea5e9', dur = 2000): AnimatedIconSpec {
  const d2 = (dur * 0.33).toFixed(0);
  const d3 = (dur * 0.66).toFixed(0);
  const svgContent = SVG(
    `<style>
      @keyframes _rp{0%{r:2;opacity:1}85%{opacity:0.1}100%{r:10;opacity:0}}
    </style>
    <circle cx="12" cy="12" r="2" style="animation:_rp ${dur}ms cubic-bezier(0,0,0.2,1) infinite" stroke="${color}" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="2" style="animation:_rp ${dur}ms cubic-bezier(0,0,0.2,1) ${d2}ms infinite" stroke="${color}" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="2" style="animation:_rp ${dur}ms cubic-bezier(0,0,0.2,1) ${d3}ms infinite" stroke="${color}" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="12" r="2.5" fill="${color}"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Ripple Ping', dur, [
    ...[0, Math.round(op*0.33), Math.round(op*0.66)].map((st, idx) =>
      shapeLayer(`ring${idx}`, [groupShape([
        ellipseShape(0,0,4,4),
        strokeShape(color,1.5),
        trimShape(staticProp([0]),staticProp([100])),
      ])], baseKS({ s: animProp([kf(st,[100,100,100]),kf(Math.min(st+op,op*2),[500,500,100],EASE_OUT)]), o: animProp([kf(st,[100]),kf(Math.min(st+Math.round(op*0.85),op*2),[10]),kf(Math.min(st+op,op*2),[0])]) }), 0, op)
    ),
    shapeLayer('dot', [groupShape([ellipseShape(0,0,5,5), fillShape(color)])], baseKS(), 0, op),
  ]);
  const frames = Array.from({length:12},(_,i) => {
    const t=i/11;
    const r=(2+t*8).toFixed(1);
    const op2=(1-t).toFixed(2);
    return SVG(`<circle cx="12" cy="12" r="${r}" stroke="${color}" stroke-width="1.5" fill="none" opacity="${op2}"/><circle cx="12" cy="12" r="2.5" fill="${color}"/>`);
  });
  return {
    name: 'Ripple Ping', category: 'animated', tags: ['ping','ripple','signal'],
    slug: 'ripple-ping-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 5. Typing Indicator ─────────────────────────────────────────────────────
//   Chat bubble with 3 dots bouncing in staggered sequence.

function typingIndicator(color = '#8b5cf6', dur = 1400): AnimatedIconSpec {
  const d = [(dur*0.15).toFixed(0),(dur*0.30).toFixed(0)];
  const svgContent = SVG(
    `<style>
      @keyframes _td{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-3px);opacity:1}}
    </style>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
      fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="8"  cy="11.5" r="1.5" fill="${color}" style="animation:_td ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <circle cx="12" cy="11.5" r="1.5" fill="${color}" style="animation:_td ${dur}ms cubic-bezier(0.4,0,0.6,1) ${d[0]}ms infinite"/>
    <circle cx="16" cy="11.5" r="1.5" fill="${color}" style="animation:_td ${dur}ms cubic-bezier(0.4,0,0.6,1) ${d[1]}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Typing Indicator', dur, [
    ...[0, Math.round(op*0.15), Math.round(op*0.30)].map((delay, i) =>
      shapeLayer(`dot${i}`, [groupShape([ellipseShape(0,0,3,3), fillShape(color)])],
        baseKS({
          p: animProp([kf(delay,[i===0?8:i===1?12:16, 11.5, 0]),kf(delay+Math.round(op*0.30),[i===0?8:i===1?12:16,8.5,0],EASE_SPRING),kf(delay+Math.round(op*0.60),[i===0?8:i===1?12:16,11.5,0])]),
          o: animProp([kf(delay,[40]),kf(delay+Math.round(op*0.30),[100]),kf(delay+Math.round(op*0.60),[40])]),
        }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const offsets=[Math.sin(t*Math.PI*2)*3, Math.sin((t-0.15)*Math.PI*2)*3, Math.sin((t-0.30)*Math.PI*2)*3];
    return SVG(`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${[8,12,16].map((cx,j)=>`<circle cx="${cx}" cy="${(11.5+offsets[j]).toFixed(1)}" r="1.5" fill="${color}"/>`).join('')}`);
  });
  return {
    name: 'Typing Indicator', category: 'animated', tags: ['typing','chat','message'],
    slug: 'typing-indicator-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 6. Spinning Gear  ───────────────────────────────────────────────────────

function spinningGear(color = '#6d28d9', dur = 2000): AnimatedIconSpec {
  const GEAR = '<path d="M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/><path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
  const svgContent = SVG(
    `<style>@keyframes _sg{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    <g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 50%;animation:_sg ${dur}ms linear infinite">${GEAR}</g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Spinning Gear', dur, [
    shapeLayer('gear', [], baseKS({ r: animProp([kf(0,[0],[360],EASE_LINEAR),kf(op,[360],[360],EASE_LINEAR)]) }), 0, op),
  ]);
  const frames = rotFrames(deg => SVG(`<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${deg},12,12)">${GEAR}</g>`));
  return {
    name: 'Spinning Gear', category: 'animated', tags: ['gear','settings','loading'],
    slug: 'spinning-gear-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 7. Download Arrow ───────────────────────────────────────────────────────
//   Arrow bounces down, a progress bar fills beneath it.

function downloadArrow(color = '#0ea5e9', dur = 1600): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _da{0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
      @keyframes _dp{0%{width:0}60%,100%{width:14px}}
    </style>
    <path d="M12 3v13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="m7 11 5 5 5-5"  stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="animation:_da ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <line x1="3" y1="21" x2="21" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.25"/>
    <line x1="5" y1="21" x2="5" y2="21" stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      style="animation:_dp ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Download Arrow', dur, [
    shapeLayer('arrow', [], baseKS({ p: animProp([kf(0,[12,12,0]),kf(Math.round(op*0.5),[12,15,0],EASE_IN_OUT),kf(op,[12,12,0])]) }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dy=(Math.sin(t*Math.PI)*3).toFixed(1);
    const pw=Math.min(14,14*t*1.8).toFixed(1);
    return SVG(`<path d="M12 3v13" stroke="${color}" stroke-width="2" stroke-linecap="round"/><path d="m7 11 5 5 5-5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,${dy})"/><line x1="3" y1="21" x2="21" y2="21" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="0.25"/><line x1="5" y1="21" x2="${(5+parseFloat(pw)).toFixed(1)}" y2="21" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`);
  });
  return {
    name: 'Download Arrow', category: 'animated', tags: ['download','receive','save'],
    slug: 'download-arrow-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 8. Upload Arrow ─────────────────────────────────────────────────────────

function uploadArrow(color = '#6d28d9', dur = 1600): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _ua{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
      @keyframes _up2{0%,40%{stroke-dashoffset:14}100%{stroke-dashoffset:0}}
    </style>
    <path d="m7 10 5-5 5 5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="animation:_ua ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <path d="M12 5v13" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="M3 21h18" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-dasharray="14" stroke-dashoffset="14"
      style="animation:_up2 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Upload Arrow', dur, [
    shapeLayer('arrow', [], baseKS({ p: animProp([kf(0,[12,12,0]),kf(Math.round(op*0.5),[12,9,0],EASE_IN_OUT),kf(op,[12,12,0])]) }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dy=(-Math.sin(t*Math.PI)*3).toFixed(1);
    return SVG(`<path d="m7 10 5-5 5 5" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(0,${dy})"/><path d="M12 5v13" stroke="${color}" stroke-width="2" stroke-linecap="round"/><path d="M3 21h18" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`);
  });
  return {
    name: 'Upload Arrow', category: 'animated', tags: ['upload','send','transfer'],
    slug: 'upload-arrow-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 9. Notification Bell ────────────────────────────────────────────────────
//   Bell swings left-right with spring easing, then badge pulses.

function notificationBell(color = '#f59e0b', dur = 2000): AnimatedIconSpec {
  const phase = dur * 0.6;
  const svgContent = SVG(
    `<style>
      @keyframes _nb{0%,100%{transform:rotate(0deg);transform-origin:50% 0%}10%{transform:rotate(12deg);transform-origin:50% 0%}20%{transform:rotate(-10deg);transform-origin:50% 0%}30%{transform:rotate(7deg);transform-origin:50% 0%}40%,100%{transform:rotate(0deg);transform-origin:50% 0%}}
      @keyframes _bd{0%,60%,100%{transform:scale(1)}65%{transform:scale(1.3)}80%{transform:scale(0.9)}90%{transform:scale(1.1)}95%{transform:scale(0.98)}}
    </style>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:12px 0px;animation:_nb ${dur}ms cubic-bezier(0.175,0.885,0.32,1.275) infinite"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="18" cy="6" r="3" fill="${color}"
      style="transform-origin:18px 6px;animation:_bd ${dur}ms cubic-bezier(0.175,0.885,0.32,1.275) ${phase.toFixed(0)}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Notification Bell', dur, [
    shapeLayer('bell', [], baseKS({ r: animProp([kf(0,[0]),kf(Math.round(op*0.10),[12],EASE_SPRING),kf(Math.round(op*0.20),[-10]),kf(Math.round(op*0.30),[7]),kf(Math.round(op*0.40),[0])]) }), 0, op),
    shapeLayer('badge', [groupShape([ellipseShape(6,-6,6,6), fillShape(color)])], baseKS({ s: animProp([kf(Math.round(op*0.60),[100,100,100]),kf(Math.round(op*0.65),[130,130,100],EASE_SPRING),kf(Math.round(op*0.80),[90,90,100]),kf(Math.round(op*0.90),[110,110,100]),kf(Math.round(op*0.95),[100,100,100])]) }), 0, op),
  ]);
  const frames = Array.from({length:12},(_,i)=>{
    const t=i/11;
    const deg=(t<0.4?Math.sin(t*Math.PI*2.5)*12*(1-t/0.4):0).toFixed(1);
    return SVG(`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${deg},12,0)"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="6" r="3" fill="${color}"/>`);
  });
  return {
    name: 'Notification Bell', category: 'animated', tags: ['bell','notify','alert'],
    slug: 'notification-bell-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 10. Send Paper Plane ────────────────────────────────────────────────────
//   Plane flies from bottom-left to top-right, fades out, resets.

function sendPlane(color = '#0ea5e9', dur = 1800): AnimatedIconSpec {
  const PLANE = '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>';
  const svgContent = SVG(
    `<style>
      @keyframes _sp2{
        0%{transform:translate(0,0) scale(1);opacity:1}
        70%{transform:translate(8px,-8px) scale(0.7);opacity:0}
        71%{transform:translate(-6px,6px) scale(0.7);opacity:0}
        100%{transform:translate(0,0) scale(1);opacity:1}
      }
    </style>
    <g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      fill="${color}" fill-opacity="0.15"
      style="animation:_sp2 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite">${PLANE}</g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Send Plane', dur, [
    shapeLayer('plane', [], baseKS({
      p: animProp([kf(0,[12,12,0]),kf(Math.round(op*0.7),[20,4,0],EASE_OUT),kf(Math.round(op*0.71),[6,20,0]),kf(op,[12,12,0])]),
      o: animProp([kf(0,[100]),kf(Math.round(op*0.65),[100]),kf(Math.round(op*0.70),[0]),kf(Math.round(op*0.71),[0]),kf(op,[100])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const x=(t<0.7?(t/0.7)*8:8-8*((t-0.71)/0.29)).toFixed(1);
    const y=(t<0.7?(-t/0.7)*8:-8+8*((t-0.71)/0.29)).toFixed(1);
    const op2=(t<0.65?1:t<0.70?1-(t-0.65)/0.05:t<0.71?0:(t-0.71)/0.29).toFixed(2);
    return SVG(`<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="${color}" fill-opacity="0.15" transform="translate(${x},${y})" opacity="${op2}">${PLANE}</g>`);
  });
  return {
    name: 'Send Message', category: 'animated', tags: ['send','message','fly'],
    slug: 'send-message-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 11. Search Scan ─────────────────────────────────────────────────────────
//   Magnifier moves across, scan line sweeps inside.

function searchScan(color = '#6d28d9', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _ss{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
      @keyframes _sl{0%{y:7}100%{y:15}}
    </style>
    <circle cx="10" cy="10" r="7" stroke="${color}" stroke-width="2"/>
    <line x1="7" y1="10" x2="13" y2="10" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"
      style="animation:_sl ${dur*0.5}ms cubic-bezier(0.4,0,0.6,1) infinite alternate"/>
    <path d="m21 21-4.3-4.3" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="animation:_ss ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Search Scan', dur, [
    shapeLayer('lens', [], baseKS({ p: animProp([kf(0,[10,10,0]),kf(Math.round(op*0.5),[13,10,0]),kf(op,[10,10,0])]) }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dx=(Math.sin(t*Math.PI)*3).toFixed(1);
    const sy=(7+t*8).toFixed(1);
    return SVG(`<circle cx="10" cy="10" r="7" stroke="${color}" stroke-width="2"/><line x1="7" y1="${sy}" x2="13" y2="${sy}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/><path d="m21 21-4.3-4.3" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="translate(${dx},0)"/>`);
  });
  return {
    name: 'Search Scan', category: 'animated', tags: ['search','scan','find'],
    slug: 'search-scan-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 12. Star Favorite ───────────────────────────────────────────────────────
//   Star fills from center outward, then sparkles burst.

function starFavorite(color = '#f59e0b', dur = 1500): AnimatedIconSpec {
  const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';
  const svgContent = SVG(
    `<style>
      @keyframes _sf{0%{transform:scale(0.5);fill-opacity:0}50%{transform:scale(1.2);fill-opacity:0.4}100%{transform:scale(1);fill-opacity:0.15}}
      @keyframes _sk{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.05) rotate(5deg)}}
    </style>
    <path d="${STAR_PATH}"
      fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 50%;animation:_sf ${dur}ms cubic-bezier(0.175,0.885,0.32,1.275) forwards,_sk ${dur*1.5}ms cubic-bezier(0.4,0,0.6,1) ${dur}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Star Favorite', dur, [
    shapeLayer('star', [], baseKS({
      s: animProp([kf(0,[50,50,100]),kf(Math.round(op*0.5),[120,120,100],EASE_SPRING),kf(op,[100,100,100])]),
      o: animProp([kf(0,[0]),kf(Math.round(op*0.5),[100]),kf(op,[100])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const s=(0.5+t*0.5+(t<0.5?t*0.4:0)).toFixed(2);
    const fo=(t*0.15).toFixed(2);
    return SVG(`<path d="${STAR_PATH}" fill="${color}" fill-opacity="${fo}" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="translate(${12*(1-parseFloat(s))},${12*(1-parseFloat(s))}) scale(${s})"/>`);
  });
  return {
    name: 'Star Favorite', category: 'animated', tags: ['star','favorite','rating'],
    slug: 'star-favorite-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 13. Sparkle Burst ───────────────────────────────────────────────────────
//   Central star + 6 rays radiating outward, all fading.

function sparkleBurst(color = '#a855f7', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _sb2{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.12) rotate(20deg)}}
      @keyframes _sr{0%,100%{opacity:0;transform:scale(0.5)}40%,60%{opacity:1;transform:scale(1)}}
    </style>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
      fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="transform-origin:50% 50%;animation:_sb2 ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <line x1="12" y1="0" x2="12" y2="2.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" style="animation:_sr ${dur}ms ease-in-out infinite"/>
    <line x1="24" y1="12" x2="21.5" y2="12" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" style="animation:_sr ${dur}ms ease-in-out 0.1s infinite"/>
    <line x1="12" y1="24" x2="12" y2="21.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" style="animation:_sr ${dur}ms ease-in-out 0.2s infinite"/>
    <line x1="0" y1="12" x2="2.5" y2="12" stroke="${color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" style="animation:_sr ${dur}ms ease-in-out 0.3s infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Sparkle Burst', dur, [
    shapeLayer('star', [], baseKS({ r: animProp([kf(0,[0]),kf(op,[360],EASE_LINEAR)]), s: animProp([kf(0,[100,100,100]),kf(Math.round(op/2),[112,112,100]),kf(op,[100,100,100])]) }), 0, op),
  ]);
  const frames = rotFrames(deg => SVG(`<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="rotate(${deg},12,12)"/>`));
  return {
    name: 'Sparkle Burst', category: 'animated', tags: ['sparkle','magic','ai'],
    slug: 'sparkle-burst-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 14. WiFi Connect ────────────────────────────────────────────────────────
//   Bars light up from inner to outer in sequence.

function wifiConnect(color = '#0ea5e9', dur = 1800): AnimatedIconSpec {
  const delay = [(dur*0.2).toFixed(0),(dur*0.4).toFixed(0),(dur*0.6).toFixed(0)];
  const svgContent = SVG(
    `<style>
      @keyframes _wf{0%,100%{opacity:0.15}50%{opacity:1}}
    </style>
    <path d="M12 20h.01" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M8.5 16.429a5 5 0 0 1 7 0" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="animation:_wf ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <path d="M5 12.859a10 10 0 0 1 14 0" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="animation:_wf ${dur}ms cubic-bezier(0.4,0,0.6,1) ${delay[0]}ms infinite"/>
    <path d="M2 8.82a15 15 0 0 1 20 0" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="animation:_wf ${dur}ms cubic-bezier(0.4,0,0.6,1) ${delay[1]}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('WiFi Connect', dur, [
    ...[0, Math.round(op*0.2), Math.round(op*0.4)].map((delay2, i) =>
      shapeLayer(`arc${i}`, [], baseKS({ o: animProp([kf(delay2,[15]),kf(delay2+Math.round(op*0.3),[100]),kf(delay2+Math.round(op*0.5),[15])]) }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const o1=(Math.sin(t*Math.PI)).toFixed(2);
    const o2=(Math.sin(Math.max(0,(t-0.2))*Math.PI/0.8)).toFixed(2);
    const o3=(Math.sin(Math.max(0,(t-0.4))*Math.PI/0.6)).toFixed(2);
    return SVG(`<path d="M12 20h.01" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/><path d="M8.5 16.429a5 5 0 0 1 7 0" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${o1}"/><path d="M5 12.859a10 10 0 0 1 14 0" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${o2}"/><path d="M2 8.82a15 15 0 0 1 20 0" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${o3}"/>`);
  });
  return {
    name: 'WiFi Connect', category: 'animated', tags: ['wifi','connect','signal'],
    slug: 'wifi-connect-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 15. Orbit Planet ────────────────────────────────────────────────────────

function orbitPlanet(color = '#0ea5e9', dur = 3000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>@keyframes _op{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    <circle cx="12" cy="12" r="3.5" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="8" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/>
    <g style="transform-origin:50% 50%;animation:_op ${dur}ms linear infinite">
      <circle cx="20" cy="12" r="2.5" fill="${color}"/>
    </g>`,
  );
  const op = ms2f(dur);
  const frames = Array.from({length:12},(_,i)=>{
    const angle=(i/12)*2*Math.PI;
    const cx=(12+8*Math.cos(angle)).toFixed(2);
    const cy=(12+8*Math.sin(angle)).toFixed(2);
    return SVG(`<circle cx="12" cy="12" r="3.5" fill="${color}" fill-opacity="0.3" stroke="${color}" stroke-width="1.5"/><circle cx="12" cy="12" r="8" stroke="${color}" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="${color}"/>`);
  });
  const lottie = lottieBase('Orbit Planet', dur, [
    shapeLayer('orbit-dot', [groupShape([ellipseShape(8,0,5,5), fillShape(color)])], baseKS({ r: animProp([kf(0,[0],[360],EASE_LINEAR),kf(op,[360],[360],EASE_LINEAR)]) }), 0, op),
    shapeLayer('star', [groupShape([ellipseShape(0,0,7,7), fillShape(color,30), strokeShape(color,1.5)])], baseKS(), 0, op),
    shapeLayer('ring', [groupShape([ellipseShape(0,0,16,16), strokeShape(color,0.8)])], baseKS({ o: staticProp(40) }), 0, op),
  ]);
  return {
    name: 'Orbit Planet', category: 'animated', tags: ['orbit','planet','space'],
    slug: 'orbit-planet-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 16. Progress Bar ────────────────────────────────────────────────────────

function progressBar(color = '#10b981', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _pb{0%{width:0;opacity:0}10%{opacity:1}90%{opacity:1}100%{width:16px;opacity:0}}
    </style>
    <rect x="2" y="9" width="20" height="6" rx="3" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/>
    <rect x="2" y="9" width="0" height="6" rx="3" fill="${color}"
      style="animation:_pb ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Progress Bar', dur, [
    shapeLayer('track', [groupShape([rectShape(0,0,20,6,3), fillShape(color,15), strokeShape(color,1.5)])], baseKS(), 0, op),
    shapeLayer('fill', [groupShape([rectShape(-8,0,4,6,3), fillShape(color)])], baseKS({
      p: animProp([kf(0,[2,12,0]),kf(op,[18,12,0],EASE_OUT)]),
      s: animProp([kf(0,[0,100,100]),kf(op,[100,100,100])]),
      o: animProp([kf(0,[0]),kf(Math.round(op*0.1),[100]),kf(Math.round(op*0.9),[100]),kf(op,[0])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const w=Math.max(1,(i/9)*16).toFixed(1);
    const op2=(i===9?0:1).toFixed(2);
    return SVG(`<rect x="2" y="9" width="20" height="6" rx="3" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="1.5"/><rect x="2" y="9" width="${w}" height="6" rx="3" fill="${color}" opacity="${op2}"/>`);
  });
  return {
    name: 'Progress Bar', category: 'animated', tags: ['progress','loading','fill'],
    slug: 'progress-bar-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 17. Loading Dots ────────────────────────────────────────────────────────

function loadingDots(color = '#8b5cf6', dur = 1200): AnimatedIconSpec {
  const d = [(dur*0.15).toFixed(0),(dur*0.30).toFixed(0)];
  const svgContent = SVG(
    `<style>
      @keyframes _ld{0%,80%,100%{transform:scale(0.5);opacity:0.3}40%{transform:scale(1.2);opacity:1}}
    </style>
    <circle cx="5"  cy="12" r="2.5" fill="${color}" style="transform-origin:5px 12px;animation:_ld ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <circle cx="12" cy="12" r="2.5" fill="${color}" style="transform-origin:12px 12px;animation:_ld ${dur}ms cubic-bezier(0.4,0,0.6,1) ${d[0]}ms infinite"/>
    <circle cx="19" cy="12" r="2.5" fill="${color}" style="transform-origin:19px 12px;animation:_ld ${dur}ms cubic-bezier(0.4,0,0.6,1) ${d[1]}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Loading Dots', dur, [
    ...[5,12,19].map((cx,i) => shapeLayer(`dot${i}`, [groupShape([ellipseShape(cx-12,0,5,5), fillShape(color)])],
      baseKS({
        s: animProp([kf(Math.round(i*op*0.15),[50,50,100]),kf(Math.round((i*0.15+0.4)*op),[120,120,100],EASE_SPRING),kf(Math.round((i*0.15+0.8)*op),[50,50,100])]),
        o: animProp([kf(Math.round(i*op*0.15),[30]),kf(Math.round((i*0.15+0.4)*op),[100]),kf(Math.round((i*0.15+0.8)*op),[30])]),
      }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const s1=Math.max(0.5,Math.sin(t*Math.PI)*0.7+0.5);
    const s2=Math.max(0.5,Math.sin(Math.max(0,t-0.15)*Math.PI/0.85)*0.7+0.5);
    const s3=Math.max(0.5,Math.sin(Math.max(0,t-0.30)*Math.PI/0.70)*0.7+0.5);
    const mk=(cx:number,s:number)=>{ const r=(2.5*s).toFixed(1); return `<circle cx="${cx}" cy="12" r="${r}" fill="${color}"/>`; };
    return SVG(mk(5,s1)+mk(12,s2)+mk(19,s3));
  });
  return {
    name: 'Loading Dots', category: 'animated', tags: ['loading','dots','wait'],
    slug: 'loading-dots-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 18. Lock Unlock ─────────────────────────────────────────────────────────
//   Shackle opens (rises), pauses open, closes again.

function lockUnlock(color = '#ef4444', dur = 2400): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _lu{0%,100%{transform:translateY(0) rotate(0deg)}35%{transform:translateY(-3px) rotate(-20deg)}55%{transform:translateY(-3px) rotate(-20deg)}80%{transform:translateY(0) rotate(0deg)}}
    </style>
    <rect x="3" y="11" width="18" height="11" rx="2" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"
      stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="transform-origin:12px 11px;animation:_lu ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <circle cx="12" cy="16" r="1.5" fill="${color}"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Lock Unlock', dur, [
    shapeLayer('shackle', [], baseKS({
      p: animProp([kf(0,[12,11,0]),kf(Math.round(op*0.35),[10,8,0],EASE_SPRING),kf(Math.round(op*0.55),[10,8,0]),kf(Math.round(op*0.80),[12,11,0],EASE_SPRING)]),
      r: animProp([kf(0,[0]),kf(Math.round(op*0.35),[-20],EASE_SPRING),kf(Math.round(op*0.55),[-20]),kf(Math.round(op*0.80),[0],EASE_SPRING)]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const open=t<0.35?t/0.35:t<0.55?1:1-(t-0.55)/0.25;
    const dy=(-3*open).toFixed(1);
    const rot=(-20*open).toFixed(1);
    return SVG(`<rect x="3" y="11" width="18" height="11" rx="2" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="translate(${(parseFloat(dy)*-0.5).toFixed(1)},${dy}) rotate(${rot},12,11)"/><circle cx="12" cy="16" r="1.5" fill="${color}"/>`);
  });
  return {
    name: 'Lock Unlock', category: 'animated', tags: ['lock','security','auth'],
    slug: 'lock-unlock-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 19. Refresh Spin ────────────────────────────────────────────────────────

function refreshSpin(color = '#10b981', dur = 1500): AnimatedIconSpec {
  const PATHS = '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>';
  const svgContent = SVG(
    `<style>@keyframes _rs{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>
    <g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 50%;animation:_rs ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite">${PATHS}</g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Refresh Spin', dur, [
    shapeLayer('arrows', [], baseKS({ r: animProp([kf(0,[0],[360],EASE_LINEAR),kf(op,[360],[360])]) }), 0, op),
  ]);
  const frames = rotFrames(deg => SVG(`<g stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${deg},12,12)">${PATHS}</g>`));
  return {
    name: 'Refresh Sync', category: 'animated', tags: ['refresh','sync','reload'],
    slug: 'refresh-sync-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 20. Error Cross ─────────────────────────────────────────────────────────
//   X draws itself then shakes.

function errorCross(color = '#ef4444', dur = 1400): AnimatedIconSpec {
  const cLen = 2*Math.PI*10;
  const xLen = 14;
  const delay = (dur*0.4).toFixed(0);
  const svgContent = SVG(
    `<style>
      @keyframes _ec{0%{stroke-dashoffset:${cLen.toFixed(1)}}50%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
      @keyframes _ex{0%,40%{stroke-dashoffset:${xLen}}75%{stroke-dashoffset:0}100%{stroke-dashoffset:0}}
      @keyframes _esh{75%,100%{transform:translateX(0)}77%{transform:translateX(-2px)}83%{transform:translateX(2px)}89%{transform:translateX(-1.5px)}95%{transform:translateX(1px)}}
    </style>
    <circle cx="12" cy="12" r="10"
      stroke="${color}" stroke-width="2" stroke-dasharray="${cLen.toFixed(1)}"
      style="transform-origin:50% 50%;transform:rotate(-90deg);animation:_ec ${dur}ms cubic-bezier(0.16,1,0.3,1) forwards"/>
    <g style="animation:_esh ${dur}ms cubic-bezier(0.4,0,0.6,1) forwards">
      <path d="M8 8l8 8" stroke="${color}" stroke-width="2.2" stroke-linecap="round"
        stroke-dasharray="${xLen}" stroke-dashoffset="${xLen}"
        style="animation:_ex ${dur}ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards"/>
      <path d="M16 8l-8 8" stroke="${color}" stroke-width="2.2" stroke-linecap="round"
        stroke-dasharray="${xLen}" stroke-dashoffset="${xLen}"
        style="animation:_ex ${dur}ms cubic-bezier(0.16,1,0.3,1) ${(parseInt(delay)+100)}ms forwards"/>
    </g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Error Cross', dur, [
    shapeLayer('circle', [groupShape([ellipseShape(0,0,20,20), strokeShape(color,2), trimShape(animProp([kf(0,[0],[100],EASE_SPRING)]),staticProp([100]))])], baseKS({ r: staticProp(-90) }), 0, op),
    shapeLayer('x', [], baseKS({ p: animProp([kf(Math.round(op*0.75),[12,12,0]),kf(Math.round(op*0.77),[10,12,0]),kf(Math.round(op*0.83),[14,12,0]),kf(Math.round(op*0.89),[10.5,12,0]),kf(Math.round(op*0.95),[13,12,0]),kf(op,[12,12,0])]) }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const cOff=Math.max(0,cLen*(1-t*2)).toFixed(1);
    const xOff=Math.max(0,xLen*(1-Math.max(0,(t-0.4)/0.35))).toFixed(1);
    return SVG(`<circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="2" stroke-dasharray="${cLen.toFixed(1)}" stroke-dashoffset="${cOff}" transform="rotate(-90,12,12)"/><path d="M8 8l8 8" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${xLen}" stroke-dashoffset="${xOff}"/><path d="M16 8l-8 8" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${xLen}" stroke-dashoffset="${xOff}"/>`);
  });
  return {
    name: 'Error Cross', category: 'animated', tags: ['error','cross','fail'],
    slug: 'error-cross-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 21. Data Stream ─────────────────────────────────────────────────────────

function dataStream(color = '#0ea5e9', dur = 1800): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _ds1{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
      @keyframes _ds2{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
      @keyframes _ds3{0%{transform:translateX(-100%);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(100%);opacity:0}}
    </style>
    <rect x="2" y="4" width="20" height="2" rx="1" fill="${color}" fill-opacity="0.2"/>
    <rect x="2" y="11" width="20" height="2" rx="1" fill="${color}" fill-opacity="0.2"/>
    <rect x="2" y="18" width="20" height="2" rx="1" fill="${color}" fill-opacity="0.2"/>
    <rect x="2" y="4" width="6" height="2" rx="1" fill="${color}"
      style="animation:_ds1 ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <rect x="2" y="11" width="6" height="2" rx="1" fill="${color}"
      style="animation:_ds2 ${dur}ms cubic-bezier(0.4,0,0.6,1) ${(dur*0.33).toFixed(0)}ms infinite"/>
    <rect x="2" y="18" width="6" height="2" rx="1" fill="${color}"
      style="animation:_ds3 ${dur}ms cubic-bezier(0.4,0,0.6,1) ${(dur*0.66).toFixed(0)}ms infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Data Stream', dur, [
    ...[4,11,18].map((y,i) => shapeLayer(`row${i}`,
      [groupShape([rectShape(-7,y-12,6,2,1), fillShape(color)])],
      baseKS({ p: animProp([kf(Math.round(i*op*0.33),[2,12,0]),kf(Math.min(Math.round(i*op*0.33)+op,op*2),[22,12,0],EASE_OUT)]) }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const make=(y:number,off:number)=>{
      const x=(2+(t+off)*16)%18;
      return `<rect x="2" y="${y}" width="20" height="2" rx="1" fill="${color}" fill-opacity="0.2"/><rect x="${x.toFixed(1)}" y="${y}" width="6" height="2" rx="1" fill="${color}"/>`;
    };
    return SVG(make(4,0)+make(11,0.33)+make(18,0.66));
  });
  return {
    name: 'Data Stream', category: 'animated', tags: ['data','stream','flow'],
    slug: 'data-stream-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 22. Map Pin Drop ────────────────────────────────────────────────────────

function mapPinDrop(color = '#ef4444', dur = 1400): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _mpd{0%{transform:translateY(-12px) scale(0.5);opacity:0}
        50%{transform:translateY(3px) scale(1.05);opacity:1}
        65%{transform:translateY(-1px) scale(0.98)}
        80%{transform:translateY(1px) scale(1.01)}
        100%{transform:translateY(0) scale(1);opacity:1}}
      @keyframes _mps{0%,49%{transform:scaleX(0);opacity:0}50%{opacity:1}100%{transform:scaleX(1);opacity:0.3}}
    </style>
    <ellipse cx="12" cy="21" rx="4" ry="1.5" fill="${color}" fill-opacity="0"
      style="transform-origin:50% 50%;animation:_mps ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <g style="animation:_mpd ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2"/>
      <circle cx="12" cy="10" r="3" fill="${color}"/>
    </g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Map Pin Drop', dur, [
    shapeLayer('pin', [], baseKS({
      p: animProp([kf(0,[12,0,0]),kf(Math.round(op*0.5),[12,15,0],EASE_OUT),kf(Math.round(op*0.65),[12,12,0],EASE_SPRING),kf(op,[12,12,0])]),
      s: animProp([kf(0,[50,50,100]),kf(Math.round(op*0.5),[105,105,100]),kf(op,[100,100,100])]),
      o: animProp([kf(0,[0]),kf(Math.round(op*0.15),[100])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dy=(t<0.5?(-12+12*(t/0.5)):t<0.65?(3-4*((t-0.5)/0.15)):t<0.8?(-1+2*((t-0.65)/0.15)):t<1?(1-1*((t-0.8)/0.2)):0).toFixed(1);
    return SVG(`<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" transform="translate(0,${dy})"/><circle cx="12" cy="${(10+parseFloat(dy)).toFixed(1)}" r="3" fill="${color}"/>`);
  });
  return {
    name: 'Map Pin Drop', category: 'animated', tags: ['location','map','pin'],
    slug: 'map-pin-drop-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 23. Music Equalizer ─────────────────────────────────────────────────────

function musicEqualizer(color = '#a855f7', dur = 1200): AnimatedIconSpec {
  const delays = ['0','200','100','300','50'];
  const svgContent = SVG(
    `<style>
      @keyframes _me{0%,100%{height:2px;y:20px}50%{height:14px;y:8px}}
    </style>
    ${[3,7,11,15,19].map((x,i)=>`<rect x="${x}" y="20" width="3" height="2" rx="1.5" fill="${color}" fill-opacity="0.4"
      style="animation:_me ${dur}ms cubic-bezier(0.4,0,0.6,1) ${delays[i]}ms infinite"/>`).join('')}`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Music Equalizer', dur, [
    ...[3,7,11,15,19].map((x,i) => shapeLayer(`bar${i}`,
      [groupShape([rectShape(x+1.5-12, 2, 3, 0, 1.5), fillShape(color)])],
      baseKS({
        p: animProp([kf(Math.round(i*op*0.1),[12,20,0]),kf(Math.round((i*0.1+0.5)*op),[12,8,0],EASE_IN_OUT),kf(Math.round((i*0.1+1)*op),[12,20,0])]),
        s: animProp([kf(Math.round(i*op*0.1),[100,10,100]),kf(Math.round((i*0.1+0.5)*op),[100,120,100],EASE_IN_OUT),kf(Math.round((i*0.1+1)*op),[100,10,100])]),
      }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const bars=[3,7,11,15,19].map((x,j)=>{
      const phase=Math.sin((t+j*0.1)*Math.PI*2);
      const h=(2+phase*10+10).toFixed(1);
      const y=(22-parseFloat(h)).toFixed(1);
      return `<rect x="${x}" y="${y}" width="3" height="${h}" rx="1.5" fill="${color}"/>`;
    });
    return SVG(bars.join(''));
  });
  return {
    name: 'Music Equalizer', category: 'animated', tags: ['music','audio','equalizer'],
    slug: 'music-equalizer-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 24. Cursor Blink ────────────────────────────────────────────────────────

function cursorBlink(color = '#6d28d9', dur = 1000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>@keyframes _cb{0%,100%{opacity:1}50%{opacity:0}}</style>
    <path d="m4 4 7.07 17 2.51-7.39L21 11.07z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="14" y1="14" x2="20" y2="20" stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      style="animation:_cb ${dur}ms step-start infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Cursor Blink', dur, [
    shapeLayer('tail', [], baseKS({ o: animProp([kf(0,[100]),kf(Math.round(op/2),[0]),kf(op,[100])]) }), 0, op),
  ]);
  const frames = Array.from({length:8},(_,i)=>{
    const visible=i%2===0;
    return SVG(`<path d="m4 4 7.07 17 2.51-7.39L21 11.07z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${visible?`<line x1="14" y1="14" x2="20" y2="20" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`:''}`);
  });
  return {
    name: 'Cursor Blink', category: 'animated', tags: ['cursor','type','input'],
    slug: 'cursor-blink-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 25. Like Heart Pop ──────────────────────────────────────────────────────

function likeHeartPop(color = '#ec4899', dur = 800): AnimatedIconSpec {
  const HEART = 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z';
  const svgContent = SVG(
    `<style>
      @keyframes _lh{0%{transform:scale(0);fill-opacity:0}50%{transform:scale(1.3);fill-opacity:0.3}70%{transform:scale(0.9)}100%{transform:scale(1);fill-opacity:0.2}}
      @keyframes _lp{0%,60%{opacity:0;transform:translate(0,0) scale(0)}60%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0.5)}}
    </style>
    <path d="${HEART}" fill="${color}" fill-opacity="0"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 55%;animation:_lh ${dur}ms cubic-bezier(0.175,0.885,0.32,1.275) forwards"/>
    ${[[12,2,'--dx:0;--dy:-8px'],[19,8,'--dx:8px;--dy:-4px'],[19,16,'--dx:8px;--dy:4px'],[12,21,'--dx:0;--dy:8px'],[5,8,'--dx:-8px;--dy:-4px'],[5,16,'--dx:-8px;--dy:4px']].map(([cx,cy,css])=>`<circle cx="${cx}" cy="${cy}" r="1.2" fill="${color}" style="${css};transform-origin:${cx}px ${cy}px;animation:_lp ${dur}ms cubic-bezier(0.16,1,0.3,1) forwards"/>`).join('')}`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Heart Pop', dur, [
    shapeLayer('heart', [], baseKS({
      s: animProp([kf(0,[0,0,100]),kf(Math.round(op*0.5),[130,130,100],EASE_SPRING),kf(Math.round(op*0.7),[90,90,100]),kf(op,[100,100,100])]),
      o: animProp([kf(0,[0]),kf(Math.round(op*0.15),[100])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:8},(_,i)=>{
    const t=i/7;
    const s=(t<0.5?t/0.5*1.3:t<0.7?1.3-0.4*(t-0.5)/0.2:1).toFixed(2);
    const fo=(Math.min(1,t*2)*0.2).toFixed(2);
    const tx=12*(1-parseFloat(s)),ty=12*(1-parseFloat(s));
    return SVG(`<path d="${HEART}" fill="${color}" fill-opacity="${fo}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${s})"/>`);
  });
  return {
    name: 'Heart Pop', category: 'animated', tags: ['like','heart','love'],
    slug: 'heart-pop-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 26. Cloud Sync ──────────────────────────────────────────────────────────

function cloudSync(color = '#06b6d4', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _cs{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
      @keyframes _cr{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    </style>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"
      fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2" stroke-linecap="round"
      style="transform-origin:50% 50%;animation:_cs ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>
    <path d="M9 16l-1.5-1.5M9 16l1.5-1.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M15 10l1.5 1.5M15 10l-1.5 1.5" stroke="${color}" stroke-width="1.8" stroke-linecap="round"
      style="animation:_cr ${dur}ms linear infinite;transform-origin:15px 10px"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Cloud Sync', dur, [
    shapeLayer('cloud', [], baseKS({ s: animProp([kf(0,[100,100,100]),kf(Math.round(op/2),[106,106,100]),kf(op,[100,100,100])]) }), 0, op),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const s=(1+Math.sin(t*Math.PI)*0.06).toFixed(3);
    const tx=(12*(1-parseFloat(s))).toFixed(1);
    return SVG(`<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="2" stroke-linecap="round" transform="translate(${tx},${tx}) scale(${s})"/>`);
  });
  return {
    name: 'Cloud Sync', category: 'animated', tags: ['cloud','sync','backup'],
    slug: 'cloud-sync-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 27. Chart Rise ──────────────────────────────────────────────────────────

function chartRise(color = '#10b981', dur = 1600): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _b1{0%{height:0;y:21}100%{height:8px;y:13}}
      @keyframes _b2{0%{height:0;y:21}100%{height:14px;y:7}}
      @keyframes _b3{0%{height:0;y:21}100%{height:18px;y:3}}
      @keyframes _ln{0%{stroke-dashoffset:40}100%{stroke-dashoffset:0}}
    </style>
    <rect x="2"  y="21" width="5" height="0" rx="1" fill="${color}" fill-opacity="0.8"
      style="animation:_b1 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <rect x="9"  y="21" width="5" height="0" rx="1" fill="${color}"
      style="animation:_b2 ${dur}ms cubic-bezier(0.16,1,0.3,1) ${(dur*0.1).toFixed(0)}ms infinite"/>
    <rect x="16" y="21" width="5" height="0" rx="1" fill="${color}" fill-opacity="1.0"
      style="animation:_b3 ${dur}ms cubic-bezier(0.16,1,0.3,1) ${(dur*0.2).toFixed(0)}ms infinite"/>
    <polyline points="2,17 9,10 14,14 21,4"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
      stroke-dasharray="40" stroke-dashoffset="40"
      style="animation:_ln ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Chart Rise', dur, [
    ...[{y:8,h:8,delay:0},{y:4,h:14,delay:Math.round(op*0.1)},{y:0,h:18,delay:Math.round(op*0.2)}].map(({y,h,delay},i) =>
      shapeLayer(`bar${i}`, [groupShape([rectShape(3+i*7,y, 5, h, 1), fillShape(color)])],
        baseKS({ s: animProp([kf(delay,[100,0,100]),kf(delay+Math.round(op*0.8),[100,100,100],EASE_OUT)]) }), 0, op)
    ),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const h1=(t*8).toFixed(1); const y1=(21-parseFloat(h1)).toFixed(1);
    const h2=(Math.max(0,t-0.1)/0.9*14).toFixed(1); const y2=(21-parseFloat(h2)).toFixed(1);
    const h3=(Math.max(0,t-0.2)/0.8*18).toFixed(1); const y3=(21-parseFloat(h3)).toFixed(1);
    return SVG(`<rect x="2" y="${y1}" width="5" height="${h1}" rx="1" fill="${color}" fill-opacity="0.8"/><rect x="9" y="${y2}" width="5" height="${h2}" rx="1" fill="${color}"/><rect x="16" y="${y3}" width="5" height="${h3}" rx="1" fill="${color}"/>`);
  });
  return {
    name: 'Chart Rise', category: 'animated', tags: ['chart','growth','analytics'],
    slug: 'chart-rise-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 28. Voice Record ────────────────────────────────────────────────────────

function voiceRecord(color = '#ef4444', dur = 1600): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _vr{0%,100%{r:5}50%{r:7}}
      @keyframes _vw{0%{stroke-dashoffset:50;opacity:0}30%{opacity:1}70%{opacity:1}100%{stroke-dashoffset:0;opacity:0}}
    </style>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
      fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="19" x2="12" y2="22" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="12" cy="7" r="5" fill="${color}" fill-opacity="0" stroke="${color}" stroke-width="1"
      style="animation:_vr ${dur}ms cubic-bezier(0.4,0,0.6,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Voice Record', dur, [
    shapeLayer('mic', [], baseKS({ s: staticProp([100,100,100]) }), 0, op),
    shapeLayer('pulse', [groupShape([ellipseShape(0,-5,10,10), strokeShape(color,1)])],
      baseKS({ s: animProp([kf(0,[100,100,100]),kf(Math.round(op/2),[140,140,100],EASE_OUT),kf(op,[100,100,100])]), o: animProp([kf(0,[100]),kf(Math.round(op/2),[0]),kf(op,[100])]) }), 0, op),
  ]);
  const frames = Array.from({length:9},(_,i)=>{
    const t=i/8;
    const r=(5+Math.sin(t*Math.PI)*2).toFixed(1);
    return SVG(`<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2"/><path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="${color}" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="19" x2="12" y2="22" stroke="${color}" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="7" r="${r}" fill="none" stroke="${color}" stroke-width="1" opacity="${(1-t).toFixed(2)}"/>`);
  });
  return {
    name: 'Voice Record', category: 'animated', tags: ['voice','record','mic'],
    slug: 'voice-record-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 29. Power On ────────────────────────────────────────────────────────────

function powerOn(color = '#10b981', dur = 1800): AnimatedIconSpec {
  const arcLen = 2*Math.PI*8*0.7; // ~70% of circle
  const svgContent = SVG(
    `<style>
      @keyframes _po{0%{stroke-dashoffset:${arcLen.toFixed(1)}}60%,100%{stroke-dashoffset:0}}
      @keyframes _pl{0%{opacity:0;transform:scaleY(0)}60%,100%{opacity:1;transform:scaleY(1)}}
    </style>
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      stroke-dasharray="${arcLen.toFixed(1)}"
      style="transform-origin:50% 50%;transform:rotate(-5deg);animation:_po ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <line x1="12" y1="2" x2="12" y2="12"
      stroke="${color}" stroke-width="2.5" stroke-linecap="round"
      style="transform-origin:12px 2px;animation:_pl ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Power On', dur, [
    shapeLayer('arc', [groupShape([ellipseShape(0,0,16,16), strokeShape(color,2.5), trimShape(animProp([kf(0,[0],[100],EASE_OUT)]),staticProp([100]))])], baseKS(), 0, op),
    shapeLayer('line', [], baseKS({ s: animProp([kf(0,[100,0,100]),kf(Math.round(op*0.6),[100,100,100],EASE_SPRING)]), o: animProp([kf(0,[0]),kf(Math.round(op*0.2),[100])]) }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dashOff=Math.max(0,arcLen*(1-t*1.6)).toFixed(1);
    const lineOp=(t>0.4?1:0).toString();
    const lineScale=t>0.4?Math.min(1,(t-0.4)/0.4):0;
    return SVG(`<path d="M18.36 6.64a9 9 0 1 1-12.73 0" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${arcLen.toFixed(1)}" stroke-dashoffset="${dashOff}" transform="rotate(-5,12,12)"/><line x1="12" y1="2" x2="12" y2="${(2+lineScale*10).toFixed(1)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="${lineOp}"/>`);
  });
  return {
    name: 'Power On', category: 'animated', tags: ['power','start','on'],
    slug: 'power-on-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 30. Rocket Launch ───────────────────────────────────────────────────────

function rocketLaunch(color = '#8b5cf6', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _rl{
        0%{transform:translateY(4px)}
        40%{transform:translateY(-2px)}
        70%{transform:translateY(-16px);opacity:1}
        80%{opacity:0;transform:translateY(-16px)}
        81%{opacity:0;transform:translateY(4px)}
        100%{opacity:1;transform:translateY(4px)}
      }
      @keyframes _rf{0%,70%,100%{opacity:0}40%{opacity:0.6;transform:scale(1)}50%{opacity:0.3;transform:scale(1.2)}60%{opacity:0;transform:scale(1.5)}}
    </style>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"
      fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
    <ellipse cx="12" cy="22" rx="3" ry="1" fill="${color}" fill-opacity="0"
      style="animation:_rf ${dur}ms ease-in-out infinite"/>
    <g style="animation:_rl ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite">
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"
        fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>
    </g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Rocket Launch', dur, [
    shapeLayer('rocket', [], baseKS({
      p: animProp([kf(0,[12,16,0]),kf(Math.round(op*0.4),[12,10,0],EASE_OUT),kf(Math.round(op*0.7),[12,-4,0]),kf(Math.round(op*0.81),[12,16,0]),kf(op,[12,16,0])]),
      o: animProp([kf(Math.round(op*0.7),[100]),kf(Math.round(op*0.8),[0]),kf(Math.round(op*0.81),[0]),kf(Math.round(op*0.9),[100])]),
    }), 0, op),
  ]);
  const frames = Array.from({length:10},(_,i)=>{
    const t=i/9;
    const dy=(t<0.4?4-6*(t/0.4):t<0.7?-2-14*((t-0.4)/0.3):t>0.8?4:4).toFixed(1);
    const visible=!(t>0.7&&t<0.81);
    return visible?SVG(`<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/><g transform="translate(0,${dy})"><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2" stroke-linecap="round"/></g>`):SVG('');
  });
  return {
    name: 'Rocket Launch', category: 'animated', tags: ['rocket','launch','startup'],
    slug: 'rocket-launch-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 31. Eye Blink ───────────────────────────────────────────────────────────
//   Eye outline with iris that squeezes closed (scaleY 1 → 0.06 → 1).
//   Inspired by show/hide-password toggles and watching states.

function eyeBlink(color = '#0ea5e9', dur = 2400): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _eb{0%,5%,30%,100%{transform:scaleY(1)}18%,22%{transform:scaleY(0.06)}}
    </style>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
      style="transform-origin:50% 50%;animation:_eb ${dur}ms cubic-bezier(0.4,0,0.2,1) infinite"/>
    <circle cx="12" cy="12" r="3"
      stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.18"
      style="transform-origin:50% 50%;animation:_eb ${dur}ms cubic-bezier(0.4,0,0.2,1) infinite"/>`,
  );
  const op = ms2f(dur);
  const blinkS = animProp([
    kf(0,[100,100,100]),
    kf(Math.round(op*0.18),[100,6,100],EASE_IN_OUT),
    kf(Math.round(op*0.22),[100,6,100],EASE_IN_OUT),
    kf(Math.round(op*0.30),[100,100,100],EASE_OUT),
    kf(op,[100,100,100]),
  ]);
  const lottie = lottieBase('Eye Blink', dur, [
    shapeLayer('iris', [groupShape([
      ellipseShape(0,0,6,6),
      strokeShape(color,2),
      fillShape(color,18),
    ])], baseKS({ s: blinkS }), 0, op),
    shapeLayer('lid', [groupShape([
      ellipseShape(0,0,20,12),
      strokeShape(color,2),
    ])], baseKS({ s: blinkS }), 0, op),
  ]);
  const frames = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    let sy = 1;
    if (t > 0.18 && t < 0.22) sy = 0.06;
    else if (t >= 0.05 && t <= 0.18) sy = 1 - (t - 0.05) / (0.18 - 0.05) * 0.94;
    else if (t >= 0.22 && t <= 0.30) sy = 0.06 + (t - 0.22) / (0.30 - 0.22) * 0.94;
    return SVG(
      `<g transform="translate(12,12) scale(1, ${sy.toFixed(3)}) translate(-12,-12)">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="12" r="3" stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.18"/>
      </g>`,
    );
  });
  return {
    name: 'Eye Blink', category: 'animated', tags: ['eye','blink','watch','show','hide','password'],
    slug: 'eye-blink-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 32. Trash Wiggle ────────────────────────────────────────────────────────
//   Trash can with lid that lifts and rocks side-to-side. The lid hinge is at
//   its left edge so the rotation feels like a hand picking it up.

function trashWiggle(color = '#ef4444', dur = 1800): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _tw{
        0%,100%{transform:translateY(0) rotate(0)}
        20%{transform:translateY(-2px) rotate(-12deg)}
        40%{transform:translateY(-2px) rotate(10deg)}
        60%{transform:translateY(-2px) rotate(-6deg)}
        80%{transform:translateY(0) rotate(0)}
      }
      @keyframes _tb{0%,50%,100%{transform:translateY(0)}25%{transform:translateY(-1px)}}
    </style>
    <g style="transform-origin:5px 6px;animation:_tw ${dur}ms cubic-bezier(0.4,0,0.2,1) infinite">
      <path d="M3 6h18" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"
        stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    <g style="transform-origin:50% 50%;animation:_tb ${dur}ms ease-in-out infinite">
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
        stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <line x1="10" y1="11" x2="10" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="11" x2="14" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    </g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Trash Wiggle', dur, [
    shapeLayer('lid', [groupShape([
      rectShape(0, -6, 18, 2),
      strokeShape(color, 2),
    ])], {
      o: staticProp(100), p: staticProp([12, 12, 0]), a: staticProp([-7, -6, 0]),
      s: staticProp([100, 100, 100]),
      r: animProp([
        kf(0,[0]),
        kf(Math.round(op*0.20),[-12],EASE_IN_OUT),
        kf(Math.round(op*0.40),[10],EASE_IN_OUT),
        kf(Math.round(op*0.60),[-6],EASE_IN_OUT),
        kf(Math.round(op*0.80),[0],EASE_OUT),
        kf(op,[0]),
      ]),
    }, 0, op),
    shapeLayer('body', [groupShape([
      rectShape(0, 4, 14, 14, 2),
      strokeShape(color, 2),
    ])], baseKS(), 0, op),
  ]);
  const frames = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    let r = 0, ty = 0;
    if (t < 0.2) { r = -12 * (t / 0.2); ty = -2 * (t / 0.2); }
    else if (t < 0.4) { r = -12 + 22 * ((t - 0.2) / 0.2); ty = -2; }
    else if (t < 0.6) { r = 10 - 16 * ((t - 0.4) / 0.2); ty = -2; }
    else if (t < 0.8) { r = -6 + 6 * ((t - 0.6) / 0.2); ty = -2 + 2 * ((t - 0.6) / 0.2); }
    return SVG(
      `<g transform="rotate(${r.toFixed(1)} 5 6) translate(0 ${ty.toFixed(1)})">
        <path d="M3 6h18" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="10" y1="11" x2="10" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      <line x1="14" y1="11" x2="14" y2="17" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`,
    );
  });
  return {
    name: 'Trash Wiggle', category: 'animated', tags: ['trash','delete','remove','bin'],
    slug: 'trash-wiggle-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 33. Copy Check ──────────────────────────────────────────────────────────
//   Page slides into a clipboard, then a check stamps on confirming the copy.
//   The full loop: empty clipboard → page enters → check appears → fade reset.

function copyCheck(color = '#10b981', dur = 2200): AnimatedIconSpec {
  const ckLen = 10;
  const svgContent = SVG(
    `<style>
      @keyframes _cs{0%{transform:translate(8px,-8px);opacity:0}30%{transform:translate(0,0);opacity:1}80%,100%{transform:translate(0,0);opacity:1}}
      @keyframes _ck{0%,50%{stroke-dashoffset:${ckLen}}70%,100%{stroke-dashoffset:0}}
    </style>
    <rect x="3" y="6" width="14" height="14" rx="2"
      stroke="${color}" stroke-width="2" fill="none"/>
    <g style="animation:_cs ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite">
      <rect x="7" y="2" width="14" height="14" rx="2"
        stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.10"/>
      <path d="m11 9 2.5 2.5L18 7" fill="none"
        stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        stroke-dasharray="${ckLen}" stroke-dashoffset="${ckLen}"
        style="animation:_ck ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    </g>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Copy Check', dur, [
    shapeLayer('clipboard', [groupShape([
      rectShape(0, 0, 14, 14, 2),
      strokeShape(color, 2),
    ])], { ...baseKS(), p: staticProp([10, 13, 0]) }, 0, op),
    shapeLayer('page', [groupShape([
      rectShape(0, 0, 14, 14, 2),
      strokeShape(color, 2),
      fillShape(color, 10),
    ])], {
      o: animProp([kf(0,[0]),kf(Math.round(op*0.30),[100],EASE_OUT),kf(op,[100])]),
      p: animProp([
        kf(0,[22, 1, 0]),
        kf(Math.round(op*0.30),[14, 9, 0],EASE_OUT),
        kf(op,[14, 9, 0]),
      ]),
      a: staticProp([0, 0, 0]),
      s: staticProp([100, 100, 100]),
      r: staticProp(0),
    }, 0, op),
    shapeLayer('check', [groupShape([
      { ty:'sh', ks: staticProp({ i:[[0,0],[0,0],[0,0]], o:[[0,0],[0,0],[0,0]], v:[[-3,1],[0,3],[4,-2]], c:false }), nm:'Check' },
      strokeShape(color, 2),
      trimShape(animProp([kf(Math.round(op*0.50),[0]),kf(Math.round(op*0.70),[100],EASE_OUT)]), staticProp([100])),
    ])], { ...baseKS(), p: staticProp([14, 9, 0]) }, 0, op),
  ]);
  const frames = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    const slide = Math.min(1, t / 0.30);
    const px = 7 + (1 - slide) * 8;
    const py = 2 - (1 - slide) * 8;
    const op2 = slide;
    const ckOff = t < 0.5 ? ckLen : Math.max(0, ckLen * (1 - (t - 0.5) / 0.2));
    return SVG(
      `<rect x="3" y="6" width="14" height="14" rx="2" stroke="${color}" stroke-width="2" fill="none"/>
       <g opacity="${op2.toFixed(2)}">
         <rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="14" height="14" rx="2" stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.10"/>
         <path d="m${(px+4).toFixed(1)} ${(py+7).toFixed(1)} 2.5 2.5L${(px+11).toFixed(1)} ${(py+5).toFixed(1)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${ckLen}" stroke-dashoffset="${ckOff.toFixed(1)}"/>
       </g>`,
    );
  });
  return {
    name: 'Copy Check', category: 'animated', tags: ['copy','clipboard','duplicate','check'],
    slug: 'copy-check-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 34. Sun Moon Toggle ─────────────────────────────────────────────────────
//   Sun with rays slowly rotates while a crescent moon fades in/out alongside,
//   evoking a day/night theme toggle that breathes.

function sunMoon(color = '#f59e0b', dur = 3000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _smR{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      @keyframes _smS{0%,45%{opacity:1;transform:scale(1)}55%,95%{opacity:0;transform:scale(0.7)}100%{opacity:1;transform:scale(1)}}
      @keyframes _smM{0%,45%{opacity:0;transform:scale(0.7) rotate(-30deg)}55%,95%{opacity:1;transform:scale(1) rotate(0)}100%{opacity:0;transform:scale(0.7) rotate(-30deg)}}
    </style>
    <g style="transform-origin:50% 50%;animation:_smS ${dur}ms ease-in-out infinite">
      <g style="transform-origin:50% 50%;animation:_smR ${dur}ms linear infinite">
        <circle cx="12" cy="12" r="4" stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.18"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </g>
    </g>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
      stroke="#a78bfa" stroke-width="2" fill="#a78bfa" fill-opacity="0.18" stroke-linecap="round" stroke-linejoin="round"
      style="transform-origin:50% 50%;animation:_smM ${dur}ms ease-in-out infinite"/>`,
  );
  const op = ms2f(dur);
  const sunO = animProp([
    kf(0,[100]),
    kf(Math.round(op*0.45),[100],EASE_IN_OUT),
    kf(Math.round(op*0.55),[0],EASE_IN_OUT),
    kf(Math.round(op*0.95),[0]),
    kf(op,[100],EASE_OUT),
  ]);
  const moonO = animProp([
    kf(0,[0]),
    kf(Math.round(op*0.45),[0],EASE_IN_OUT),
    kf(Math.round(op*0.55),[100],EASE_IN_OUT),
    kf(Math.round(op*0.95),[100]),
    kf(op,[0],EASE_OUT),
  ]);
  const lottie = lottieBase('Sun Moon', dur, [
    shapeLayer('sun', [groupShape([
      ellipseShape(0,0,8,8),
      strokeShape(color, 2),
      fillShape(color, 18),
    ])], {
      o: sunO, p: staticProp([12,12,0]), a: staticProp([0,0,0]),
      s: staticProp([100,100,100]),
      r: animProp([kf(0,[0],[360],EASE_LINEAR), kf(op,[360],[360],EASE_LINEAR)]),
    }, 0, op),
    shapeLayer('moon', [groupShape([
      ellipseShape(0,0,16,16),
      strokeShape('#a78bfa', 2),
      fillShape('#a78bfa', 18),
    ])], { o: moonO, p: staticProp([12,12,0]), a: staticProp([0,0,0]), s: staticProp([100,100,100]), r: staticProp(0) }, 0, op),
  ]);
  const frames = Array.from({ length: 12 }, (_, i) => {
    const t = i / 12;
    const sun = t < 0.45 ? 1 : t < 0.55 ? 1 - (t - 0.45) / 0.10 : t < 0.95 ? 0 : (t - 0.95) / 0.05;
    const moon = 1 - sun;
    const rot = t * 360;
    return SVG(
      `<g opacity="${sun.toFixed(2)}" transform="rotate(${rot.toFixed(1)} 12 12)">
        <circle cx="12" cy="12" r="4" stroke="${color}" stroke-width="2" fill="${color}" fill-opacity="0.18"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </g>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" opacity="${moon.toFixed(2)}" stroke="#a78bfa" stroke-width="2" fill="#a78bfa" fill-opacity="0.18" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  });
  return {
    name: 'Sun Moon', category: 'animated', tags: ['sun','moon','theme','dark','light','toggle'],
    slug: 'sun-moon-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color, '#a78bfa'] }) }),
  };
}

// ─── 35. Battery Charge ──────────────────────────────────────────────────────
//   Battery shell stays put while the inner fill sweeps 0 → 100%, with a bolt
//   that gently pulses in scale & opacity. Easing is decisive (ease-out fill,
//   ease-in-out bolt) to feel like a real charging cycle.

function batteryCharge(color = '#10b981', dur = 1800): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _bf{0%{transform:scaleX(0)}80%,100%{transform:scaleX(1)}}
      @keyframes _bp{0%,100%{opacity:0.8;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
    </style>
    <rect x="2" y="7" width="16" height="10" rx="2"
      stroke="${color}" stroke-width="2" fill="none"/>
    <line x1="20" y1="11" x2="20" y2="13" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <rect x="3.5" y="8.5" width="13" height="7" rx="1" fill="${color}"
      style="transform-origin:3.5px 12px;animation:_bf ${dur}ms cubic-bezier(0.4,0,0.2,1) infinite"/>
    <path d="m11 8-2 6h4l-2 6"
      stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#fff"
      style="transform-origin:11px 14px;animation:_bp ${dur}ms ease-in-out infinite"/>`,
  );
  const op = ms2f(dur);
  const lottie = lottieBase('Battery Charge', dur, [
    shapeLayer('shell', [groupShape([
      rectShape(0, 0, 16, 10, 2),
      strokeShape(color, 2),
    ])], { ...baseKS(), p: staticProp([10, 12, 0]) }, 0, op),
    shapeLayer('cap', [groupShape([
      rectShape(0, 0, 2, 2, 0.5),
      fillShape(color, 100),
    ])], { ...baseKS(), p: staticProp([20, 12, 0]) }, 0, op),
    shapeLayer('fill', [groupShape([
      rectShape(0, 0, 13, 7, 1),
      fillShape(color, 100),
    ])], {
      o: staticProp(100),
      p: staticProp([3.5, 12, 0]),
      a: staticProp([-6.5, 0, 0]),
      s: animProp([kf(0,[0,100,100]),kf(Math.round(op*0.80),[100,100,100],EASE_OUT),kf(op,[100,100,100])]),
      r: staticProp(0),
    }, 0, op),
    shapeLayer('bolt', [groupShape([
      { ty:'sh', ks: staticProp({ i:[[0,0],[0,0],[0,0],[0,0]], o:[[0,0],[0,0],[0,0],[0,0]], v:[[-1,-3],[-2,3],[1,-1],[1,3]], c:false }), nm:'Bolt' },
      strokeShape('#ffffff', 2),
      fillShape('#ffffff', 100),
    ])], {
      o: animProp([kf(0,[80]),kf(Math.round(op*0.50),[100],EASE_IN_OUT),kf(op,[80])]),
      p: staticProp([11, 12, 0]),
      a: staticProp([0, 0, 0]),
      s: animProp([kf(0,[100,100,100]),kf(Math.round(op*0.50),[118,118,100],EASE_IN_OUT),kf(op,[100,100,100])]),
      r: staticProp(0),
    }, 0, op),
  ]);
  const frames = Array.from({ length: 10 }, (_, i) => {
    const t = i / 9;
    const fill = Math.min(1, t / 0.8);
    const w = (13 * fill).toFixed(2);
    const pulse = 1 + 0.18 * Math.sin(Math.PI * t);
    const op2 = 0.8 + 0.2 * Math.sin(Math.PI * t);
    return SVG(
      `<rect x="2" y="7" width="16" height="10" rx="2" stroke="${color}" stroke-width="2" fill="none"/>
       <line x1="20" y1="11" x2="20" y2="13" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
       <rect x="3.5" y="8.5" width="${w}" height="7" rx="1" fill="${color}"/>
       <g transform="translate(11 14) scale(${pulse.toFixed(3)}) translate(-11 -14)" opacity="${op2.toFixed(2)}">
         <path d="m11 8-2 6h4l-2 6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="#fff"/>
       </g>`,
    );
  });
  return {
    name: 'Battery Charge', category: 'animated', tags: ['battery','charge','charging','power','energy'],
    slug: 'battery-charge-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── 36. Trending Up ─────────────────────────────────────────────────────────
//   Three bars grow from baseline at staggered times, then a diagonal arrow
//   sweeps up over the bars. Captures "growth" / "metrics rising".

function trendingUp(color = '#10b981', dur = 2000): AnimatedIconSpec {
  const svgContent = SVG(
    `<style>
      @keyframes _b1{0%{transform:scaleY(0)}25%,100%{transform:scaleY(1)}}
      @keyframes _b2{0%,15%{transform:scaleY(0)}40%,100%{transform:scaleY(1)}}
      @keyframes _b3{0%,30%{transform:scaleY(0)}60%,100%{transform:scaleY(1)}}
      @keyframes _ar{0%,55%{stroke-dashoffset:24;opacity:0}65%{opacity:1}90%,100%{stroke-dashoffset:0;opacity:1}}
    </style>
    <rect x="4" y="14" width="3" height="6" rx="0.5" fill="${color}"
      style="transform-origin:5.5px 20px;animation:_b1 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <rect x="10.5" y="10" width="3" height="10" rx="0.5" fill="${color}"
      style="transform-origin:12px 20px;animation:_b2 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <rect x="17" y="6" width="3" height="14" rx="0.5" fill="${color}"
      style="transform-origin:18.5px 20px;animation:_b3 ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <path d="M3 17 9 11l4 4 8-8"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
      stroke-dasharray="24" stroke-dashoffset="24"
      style="animation:_ar ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>
    <polyline points="16,7 21,7 21,12"
      stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"
      style="opacity:0;animation:_ar ${dur}ms cubic-bezier(0.16,1,0.3,1) infinite"/>`,
  );
  const op = ms2f(dur);
  function barS(start: number) {
    return animProp([
      kf(0,[100,0,100]),
      kf(Math.round(op*start),[100,0,100],EASE_OUT),
      kf(Math.round(op*(start+0.25)),[100,100,100],EASE_OUT),
      kf(op,[100,100,100]),
    ]);
  }
  const lottie = lottieBase('Trending Up', dur, [
    shapeLayer('bar1', [groupShape([
      rectShape(0, 0, 3, 6, 0.5),
      fillShape(color, 100),
    ])], { ...baseKS(), p: staticProp([5.5, 20, 0]), a: staticProp([0, 3, 0]), s: barS(0) }, 0, op),
    shapeLayer('bar2', [groupShape([
      rectShape(0, 0, 3, 10, 0.5),
      fillShape(color, 100),
    ])], { ...baseKS(), p: staticProp([12, 20, 0]), a: staticProp([0, 5, 0]), s: barS(0.15) }, 0, op),
    shapeLayer('bar3', [groupShape([
      rectShape(0, 0, 3, 14, 0.5),
      fillShape(color, 100),
    ])], { ...baseKS(), p: staticProp([18.5, 20, 0]), a: staticProp([0, 7, 0]), s: barS(0.30) }, 0, op),
    shapeLayer('arrow', [groupShape([
      { ty:'sh', ks: staticProp({ i:[[0,0],[0,0],[0,0],[0,0]], o:[[0,0],[0,0],[0,0],[0,0]], v:[[-9,5],[-3,-1],[1,3],[9,-5]], c:false }), nm:'Arrow' },
      strokeShape(color, 2),
      trimShape(animProp([kf(Math.round(op*0.55),[0]),kf(Math.round(op*0.90),[100],EASE_OUT)]), staticProp([100])),
    ])], { ...baseKS(), p: staticProp([12, 12, 0]) }, 0, op),
  ]);
  const frames = Array.from({ length: 12 }, (_, i) => {
    const t = i / 12;
    const s1 = Math.min(1, Math.max(0, (t - 0.0) / 0.25));
    const s2 = Math.min(1, Math.max(0, (t - 0.15) / 0.25));
    const s3 = Math.min(1, Math.max(0, (t - 0.30) / 0.30));
    const arrowVisible = t > 0.55;
    const arrowProgress = Math.min(1, Math.max(0, (t - 0.55) / 0.35));
    const dashOffset = 24 * (1 - arrowProgress);
    return SVG(
      `<rect x="4" y="${(20 - 6 * s1).toFixed(1)}" width="3" height="${(6 * s1).toFixed(1)}" rx="0.5" fill="${color}"/>
       <rect x="10.5" y="${(20 - 10 * s2).toFixed(1)}" width="3" height="${(10 * s2).toFixed(1)}" rx="0.5" fill="${color}"/>
       <rect x="17" y="${(20 - 14 * s3).toFixed(1)}" width="3" height="${(14 * s3).toFixed(1)}" rx="0.5" fill="${color}"/>
       ${arrowVisible ? `<path d="M3 17 9 11l4 4 8-8" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke-dasharray="24" stroke-dashoffset="${dashOffset.toFixed(1)}"/>
       <polyline points="16,7 21,7 21,12" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` : ''}`,
    );
  });
  return {
    name: 'Trending Up', category: 'animated', tags: ['trending','growth','chart','analytics','rise','arrow'],
    slug: 'trending-up-animated',
    build: () => ({ svgContent, animationData: JSON.stringify({ lottie, frames, durationMs: dur, colors: [color] }) }),
  };
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

export const ANIMATED_ICONS: AnimatedIconSpec[] = [
  // Loaders & Spinners
  arcSpinner('#6d28d9', 1400),
  arcSpinner('#0ea5e9', 1200),
  arcSpinner('#10b981', 1600),
  loadingDots('#8b5cf6', 1200),
  loadingDots('#0ea5e9', 1000),
  progressBar('#10b981', 2000),
  progressBar('#6d28d9', 1800),

  // Feedback
  checkmarkDraw('#10b981', 1200),
  errorCross('#ef4444', 1400),
  heartbeatPulse('#ef4444', 1000),
  likeHeartPop('#ec4899', 800),
  starFavorite('#f59e0b', 1500),
  sparkleBurst('#a855f7', 2000),
  notificationBell('#f59e0b', 2000),

  // Interactions
  typingIndicator('#8b5cf6', 1400),
  searchScan('#6d28d9', 2000),
  sendPlane('#0ea5e9', 1800),
  downloadArrow('#0ea5e9', 1600),
  uploadArrow('#6d28d9', 1600),
  lockUnlock('#ef4444', 2400),
  cursorBlink('#6d28d9', 1000),
  voiceRecord('#ef4444', 1600),

  // Data & Analytics
  chartRise('#10b981', 1600),
  musicEqualizer('#a855f7', 1200),
  dataStream('#0ea5e9', 1800),

  // Ambient & Status
  ripplePing('#0ea5e9', 2000),
  wifiConnect('#0ea5e9', 1800),
  cloudSync('#06b6d4', 2000),
  orbitPlanet('#6d28d9', 3000),
  spinningGear('#6d28d9', 2000),
  refreshSpin('#10b981', 1500),
  mapPinDrop('#ef4444', 1400),
  powerOn('#10b981', 1800),
  rocketLaunch('#8b5cf6', 2000),

  // Lucide-animated inspired set
  eyeBlink('#0ea5e9', 2400),
  eyeBlink('#6d28d9', 2800),
  trashWiggle('#ef4444', 1800),
  copyCheck('#10b981', 2200),
  copyCheck('#0ea5e9', 2400),
  sunMoon('#f59e0b', 3000),
  batteryCharge('#10b981', 1800),
  batteryCharge('#f59e0b', 2200),
  trendingUp('#10b981', 2000),
  trendingUp('#0ea5e9', 2200),
];
