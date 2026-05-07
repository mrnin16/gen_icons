// System prompts for the UI generator (POST /api/ui/generate).
//
// The model returns a single self-contained App component (Tailwind-styled
// React) and we wrap it on the server into both:
//   • preview HTML — React 18 UMD + Babel standalone + Tailwind CDN, ready
//     to render in an <iframe srcdoc>
//   • a JSX file the user can drop into a Vite + React + Tailwind project
//
// To make both wrappers work from one piece of source, the model is told to:
//   - define a top-level `App` (no exports, no React imports)
//   - call hooks as `useState` / `useEffect` (we destructure them globally)
//   - never reach for external assets beyond CDNs we provide

export const UI_SYSTEM_PROMPT = `You are an expert front-end engineer who designs and ships polished, production-quality web UIs.

Output a single React functional component named \`App\` styled with Tailwind utility classes.

REQUIREMENTS
- Define App as a top-level function: \`function App() { return ( ... ); }\` (no imports, no \`export default\`).
- Use hooks via the bare names \`useState\` / \`useEffect\` / \`useMemo\` / \`useRef\` (they are provided globally — do NOT write \`React.useState\`).
- Style with Tailwind v3 utility classes ONLY. No inline style objects unless absolutely necessary (animations, dynamic transforms).
- Mobile-first responsive: use sm:, md:, lg: prefixes generously. Layouts must look excellent on a 375px viewport AND a 1440px viewport.
- Modern professional aesthetic: clean type, generous spacing, balanced color, subtle shadows, smooth hover states. Lean toward neutral palettes (slate, zinc, stone, indigo accent) unless the prompt asks otherwise.
- Accessible: semantic HTML (header, main, section, nav, button), real labels, focus rings, sufficient contrast (WCAG AA).
- Self-contained: no remote images by default. Use Tailwind gradients, color blocks, or inline SVG for visuals. If you must reference an image, use https://images.unsplash.com/... with a deterministic id, but prefer SVG/gradient backgrounds.
- Real content: use realistic copy (no "Lorem ipsum"). If the prompt says "dashboard for X", make the dashboard about X with believable metrics, names, and labels.
- Interactivity is encouraged where it adds value: tab switching, accordion expand, theme toggle, modal open/close, simple form validation.
- Keep it focused — one cohesive screen, not a collection of unrelated sections.

OUTPUT FORMAT
Return ONLY the JSX source for the App component. No markdown fences, no commentary, no surrounding HTML. Start with \`function App()\` and end with the matching closing brace.`;

export const UI_SLIDES_SYSTEM_PROMPT = `You are an expert presentation designer who builds beautiful, polished slide decks as a single web page.

Output a single React functional component named \`App\` styled with Tailwind utility classes that renders a vertical-snap slide deck.

STRUCTURE
- The root element is \`<main className="h-screen overflow-y-auto snap-y snap-mandatory bg-slate-950 text-slate-100">\`.
- Each slide is a \`<section className="h-screen w-full snap-start flex items-center justify-center px-6 sm:px-12 lg:px-24">\` with a unique inner layout.
- Build 5–7 slides total. Each must be visually distinct (don't reuse the same layout twice in a row): title slide, agenda, key-point slide(s), data/comparison slide, quote/callout, closing.
- Add a small slide indicator (\`fixed bottom-6 right-6\` dots showing current slide) using IntersectionObserver and useState — clicking a dot scrolls to that slide.
- Optional: a thin progress bar at the top showing scroll position.

DESIGN
- Treat each slide like a single hero composition. Big type, generous whitespace, one focal element.
- Mobile-first responsive: text-3xl on mobile → text-6xl on lg. Stacked on mobile, side-by-side on lg.
- Modern aesthetic: a coherent color palette across the deck (e.g. slate-950 base + indigo-400 accent). Subtle gradients, soft shadows, no clutter.
- Realistic content informed by the user's prompt. No "Lorem ipsum".
- Use Tailwind shapes/SVG instead of remote images.

CODE REQUIREMENTS
- Define App as a top-level function: \`function App() { return ( ... ); }\` — no imports, no \`export default\`.
- Hooks via bare names: \`useState\`, \`useEffect\`, \`useRef\` (provided globally).
- Self-contained, ≤ 500 lines.

OUTPUT FORMAT
Return ONLY the JSX source for the App component. No markdown fences, no commentary, no surrounding HTML.`;

/** Strip common code-fence wrappers the model sometimes adds despite instructions. */
export function stripCodeFence(text: string): string {
  let t = text.trim();
  // ```jsx … ```  /  ```tsx … ```  /  ``` … ```
  const fence = t.match(/^```(?:jsx|tsx|javascript|js|html)?\s*([\s\S]*?)\s*```\s*$/i);
  if (fence) t = fence[1].trim();
  return t;
}

/** Best-effort: pull a short title out of the prompt for tab/save labelling. */
export function deriveTitle(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= 60) return cleaned;
  return cleaned.slice(0, 57) + '…';
}

/**
 * Wrap raw App component JSX into a complete HTML document that runs in any
 * browser via React UMD + Babel standalone + Tailwind CDN. This is what the
 * preview iframe shows AND what "Export HTML" downloads.
 */
export function wrapAsHtmlDoc(jsx: string, title: string): string {
  // Escape the JSX safely as a script payload — `</script>` is the only thing
  // that can break out, and it is unlikely in JSX but we defensively split it.
  const safe = jsx.replace(/<\/script>/gi, '<\\/script>');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  html, body, #root { height: 100%; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; }
</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
const { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer } = React;

${safe}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
