export const STYLE_PROMPTS: Record<string, string> = {
  'liquid-glass': `Liquid glass / glassmorphism aesthetic:
- Translucent layers with subtle gradients simulating glass refraction
- Soft rounded organic shapes with smooth curves
- Colors: semi-transparent whites, light blues (#a8d8ea, #82b1ff), purple tints (#b388ff)
- Subtle inner glow and soft drop shadow for depth
- Overlapping translucent elements for layered glass effect
- TRANSPARENT background — NO background rectangle or fill`,

  anime: `Japanese anime / manga art style:
- Bold, clean outlines with varying stroke widths
- Vibrant, saturated colors with cel-shading flat fills
- Colors: vivid pinks (#ff6b9d), oranges (#ffa726), sky blues (#42a5f5)
- Cute, expressive styling with dynamic energy
- Sparkles, stars, or speed lines for flair
- TRANSPARENT background — NO background rectangle or fill`,

  'flat-modern': `Clean flat modern design:
- Perfectly geometric shapes, no gradients or shadows
- Bold use of 2-3 colors maximum
- Colors: deep navy (#1a237e), coral (#ff7043), teal (#26a69a), yellow (#ffd54f)
- Pixel-perfect alignment, consistent stroke widths
- Minimal detail — fewest possible elements
- TRANSPARENT background — NO background rectangle or fill`,

  '3d-clay': `3D clay / claymorphism style:
- Soft, rounded, puffy shapes like molded plasticine
- Subtle gradients for 3D volume, soft lighting from top-left
- Colors: soft peach (#ffccbc), lavender (#d1c4e9), mint (#c8e6c9)
- Soft inner shadows and highlights for depth
- Playful, tactile, toy-like quality
- TRANSPARENT background — NO background rectangle or fill`,

  'neon-glow': `Neon glow cyberpunk aesthetic:
- Thin glowing lines simulating neon tube lighting
- NO dark background — just the neon elements on transparent
- Colors: hot pink (#ff0080), cyan (#00ffff), purple (#bf00ff), lime (#39ff14)
- SVG filter effects for glow (feGaussianBlur)
- Futuristic, high-tech cyberpunk feel
- TRANSPARENT background — NO background rectangle or fill`,

  'line-art': `Elegant line art / outline style:
- Minimal stroke paths with consistent 2px weight
- Monochrome: single color (#2d3436) on transparent
- Elegant, hand-drawn quality with organic flow
- No fills — pure linework only
- Refined editorial illustration quality
- TRANSPARENT background — NO background rectangle or fill`,

  animated: `Self-contained animated SVG using embedded CSS keyframes:
- Visually similar to "flat-modern": clean geometric shapes, 2-3 solid colors, no gradients.
  Pick a palette appropriate to the subject (e.g. warm reds/oranges for fire, cool blues for water).
- Embed an inline <style> block INSIDE the <svg> defining @keyframes for each motion.
- Apply animations via 'style="animation: name 2s ease-in-out infinite"' on elements or <g> wrappers.
- Pick motion that fits the subject described in the prompt:
  • rocket / launch → vertical bob (translateY) + flame flicker (scaleY + opacity)
  • spinner / loader → continuous rotation (linear, infinite)
  • heart / pulse → scale heartbeat (1 → 1.15 → 1, ease-in-out)
  • bell / ring → small rotation wobble (-15deg ↔ 15deg)
  • check / draw-on → stroke-dashoffset reveal
  • wave / water → translateX with sine-like cubic-bezier
  • star / twinkle → opacity + scale pulse with delay
- Animation MUST loop infinitely (use 'infinite').
- Duration: 1.5–3s per cycle for most icons; 0.6–1s for fast actions.
- Set transform-origin so rotations/scales pivot naturally (e.g. "transform-origin: 60px 60px;").
- Keep total SVG small — no more than 6–8 animated elements.
- viewBox="0 0 120 120" with TRANSPARENT background.
- Self-contained: no external assets, no scripts.`,
};

export const SYSTEM_PROMPT = `You are an expert SVG icon designer creating beautiful, consistent, production-ready SVG icons.

CRITICAL RULES:
1. Output ONLY raw SVG code. No markdown, no backticks, no explanation.
2. Use viewBox="0 0 120 120" for ALL icons.
3. Center the icon within the viewBox.
4. Keep SVG clean and optimized — minimal elements.
5. Immediately recognizable, clear subject.
6. Consistent visual weight and balance.
7. Use <defs> for gradients/filters. Inline <style> blocks are allowed and required for the animated style.
8. Do NOT include text elements.
9. TRANSPARENT background: NO background rect. NO fill on root <svg>. NO style="background:..." on <svg>.
10. Start with <svg, end with </svg>.`;

export function detectCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  const map: Record<string, string[]> = {
    technology: [
      'computer', 'laptop', 'code', 'server', 'chip', 'robot', 'ai', 'wifi', 'keyboard',
      'monitor', 'database', 'cloud', 'usb', 'bluetooth', 'printer',
    ],
    nature: [
      'tree', 'flower', 'sun', 'moon', 'star', 'mountain', 'ocean', 'leaf', 'rain',
      'cloud', 'forest', 'plant', 'snow', 'wind', 'fire',
    ],
    'food-drink': [
      'coffee', 'pizza', 'burger', 'cake', 'fruit', 'apple', 'beer', 'wine', 'cooking',
      'chef', 'sushi', 'tea', 'donut',
    ],
    business: [
      'chart', 'money', 'wallet', 'briefcase', 'meeting', 'handshake', 'office',
      'presentation', 'target', 'trophy', 'invoice',
    ],
    communication: [
      'chat', 'message', 'email', 'phone', 'call', 'notification', 'bell', 'megaphone',
      'envelope',
    ],
    travel: [
      'plane', 'car', 'train', 'bus', 'ship', 'map', 'compass', 'luggage', 'passport',
      'globe', 'taxi', 'tent', 'lighthouse',
    ],
    health: [
      'heart', 'hospital', 'pill', 'medicine', 'doctor', 'stethoscope', 'dna', 'brain',
      'tooth', 'lung', 'thermometer', 'ambulance',
    ],
    education: [
      'book', 'school', 'graduation', 'pencil', 'backpack', 'library', 'science',
      'math', 'microscope', 'telescope', 'calculator',
    ],
    entertainment: [
      'music', 'film', 'game', 'guitar', 'headphone', 'camera', 'microphone', 'dice',
      'piano', 'drum', 'movie',
    ],
    security: [
      'lock', 'key', 'shield', 'password', 'fingerprint', 'guard', 'alarm', 'cctv',
      'firewall',
    ],
    'design-tools': [
      'palette', 'brush', 'pen', 'layer', 'crop', 'grid', 'ruler', 'canvas',
      'eraser',
    ],
    'social-media': ['hashtag', 'follow', 'like', 'share', 'verified', 'profile', 'avatar'],
    'arrows-navigation': ['arrow', 'menu', 'search', 'filter', 'sort', 'home', 'close'],
    'files-documents': ['file', 'folder', 'pdf', 'zip', 'trash', 'download', 'upload'],
  };
  for (const [cat, keywords] of Object.entries(map)) {
    if (keywords.some((k) => p.includes(k))) return cat;
  }
  return 'misc';
}
