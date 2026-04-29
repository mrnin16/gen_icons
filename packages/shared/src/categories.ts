export type CategoryMeta = {
  slug: string;
  label: string;
  emoji: string;
};

export const CATEGORIES: CategoryMeta[] = [
  { slug: 'technology', label: 'Technology', emoji: '💻' },
  { slug: 'business', label: 'Business', emoji: '💼' },
  { slug: 'communication', label: 'Communication', emoji: '💬' },
  { slug: 'social-media', label: 'Social Media', emoji: '📱' },
  { slug: 'nature', label: 'Nature', emoji: '🌿' },
  { slug: 'food-drink', label: 'Food & Drink', emoji: '🍕' },
  { slug: 'health', label: 'Health', emoji: '❤️' },
  { slug: 'education', label: 'Education', emoji: '📚' },
  { slug: 'travel', label: 'Travel', emoji: '✈️' },
  { slug: 'entertainment', label: 'Entertainment', emoji: '🎮' },
  { slug: 'sports', label: 'Sports', emoji: '⚽' },
  { slug: 'arrows-navigation', label: 'Arrows & Navigation', emoji: '➡️' },
  { slug: 'files-documents', label: 'Files & Documents', emoji: '📄' },
  { slug: 'security', label: 'Security', emoji: '🔒' },
  { slug: 'design-tools', label: 'Design Tools', emoji: '🎨' },
];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.label]),
);

export type StyleMeta = {
  slug: string;
  label: string;
};

export const STYLES: StyleMeta[] = [
  { slug: 'liquid-glass', label: 'Liquid Glass' },
  { slug: 'anime', label: 'Anime' },
  { slug: 'flat-modern', label: 'Flat Modern' },
  { slug: '3d-clay', label: '3D Clay' },
  { slug: 'neon-glow', label: 'Neon Glow' },
  { slug: 'line-art', label: 'Line Art' },
];
