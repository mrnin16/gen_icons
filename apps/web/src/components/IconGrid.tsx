'use client';

import type { IconDTO } from '@iconforge/shared';
import { IconCard } from './IconCard';

type Props = {
  icons: IconDTO[];
  onSelect: (icon: IconDTO) => void;
};

export function IconGrid({ icons, onSelect }: Props) {
  if (icons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-4xl mb-3">✨</div>
        <p className="text-[var(--text-secondary)]">
          No icons match your filters.
        </p>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Try the AI generator to forge a custom one.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
      {icons.map((icon) => (
        <IconCard key={icon.id} icon={icon} onClick={onSelect} />
      ))}
    </div>
  );
}
