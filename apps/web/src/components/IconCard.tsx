'use client';

import { memo } from 'react';
import type { IconDTO } from '@iconforge/shared';

type Props = {
  icon: IconDTO;
  onClick: (icon: IconDTO) => void;
};

function IconCardImpl({ icon, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick(icon)}
      className="group relative aspect-square flex flex-col items-center justify-between gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 transition text-left"
      title={icon.name}
    >
      {icon.isAiGenerated && (
        <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
          AI
        </span>
      )}
      <div
        className="flex-1 w-full grid place-items-center"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: icon.svgContent.replace(
            /<svg([^>]*)>/i,
            '<svg$1 width="56" height="56" style="max-width:100%;height:auto;">',
          ),
        }}
      />
      <div className="w-full">
        <div className="text-[11px] font-medium text-[var(--text-primary)] truncate">
          {icon.name}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] truncate">{icon.style}</div>
      </div>
    </button>
  );
}

export const IconCard = memo(IconCardImpl);
