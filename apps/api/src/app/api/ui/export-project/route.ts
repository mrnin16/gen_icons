import { NextResponse, type NextRequest } from 'next/server';
import JSZip from 'jszip';

import { getCurrentUser } from '@/lib/auth';
import { kebabCase } from '@iconforge/shared';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to export projects' }, { status: 401 });
  }

  let body: {
    jsx?: string;
    title?: string;
    brandColor?: string;
    logoDataUrl?: string;
    productDataUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const jsx = (body.jsx || '').trim();
  const title = (body.title || 'forge-ui-app').trim() || 'forge-ui-app';
  const brandColor = (body.brandColor || '').trim() || null;
  const logoUrl = (body.logoDataUrl || '').trim() || null;
  const productUrl = (body.productDataUrl || '').trim() || null;
  if (!jsx) return NextResponse.json({ error: 'jsx required' }, { status: 400 });
  if (!/function\s+App\s*\(/.test(jsx)) {
    return NextResponse.json({ error: 'jsx must define a function App' }, { status: 400 });
  }

  const slug = kebabCase(title) || 'forge-ui-app';
  const projectName = slug.length > 60 ? slug.slice(0, 60) : slug;

  const zip = new JSZip();
  const root = zip.folder(projectName)!;

  root.file('package.json', JSON.stringify(packageJson(projectName), null, 2));
  root.file('vite.config.js', VITE_CONFIG);
  root.file('tailwind.config.js', TAILWIND_CONFIG);
  root.file('postcss.config.js', POSTCSS_CONFIG);
  root.file('index.html', INDEX_HTML(title));
  root.file('.gitignore', GITIGNORE);
  root.file('README.md', README(title, projectName));

  const src = root.folder('src')!;
  src.file('main.jsx', MAIN_JSX);
  src.file('index.css', INDEX_CSS);
  src.file('App.jsx', appJsxFile(jsx, { color: brandColor, logoUrl, productUrl }));

  const blob = await zip.generateAsync({ type: 'uint8array' });

  return new NextResponse(blob as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${projectName}.zip"`,
      'Content-Length': String(blob.length),
    },
  });
}

// ─── Project file contents ────────────────────────────────────────────────────

function packageJson(name: string) {
  return {
    name,
    private: true,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.4',
      autoprefixer: '^10.4.20',
      postcss: '^8.4.49',
      tailwindcss: '^3.4.17',
      vite: '^6.0.7',
    },
  };
}

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
`;

const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

const INDEX_HTML = (title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

const MAIN_JSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
`;

const GITIGNORE = `node_modules
dist
.DS_Store
.env
.env.local
`;

type ExportBrand = { color: string | null; logoUrl: string | null; productUrl: string | null };

function appJsxFile(jsx: string, brand: ExportBrand): string {
  // Posters reference BRAND_COLOR / LOGO_URL / PRODUCT_URL as global string
  // constants. We inline the actual values here so the exported project is
  // fully self-contained — the user can edit src/App.jsx to swap branding.
  return `import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer } from 'react';

const BRAND_COLOR = ${JSON.stringify(brand.color ?? '')};
const LOGO_URL = ${JSON.stringify(brand.logoUrl ?? '')};
const PRODUCT_URL = ${JSON.stringify(brand.productUrl ?? '')};

${jsx}

export default App;
`;
}

const README = (title: string, name: string) => `# ${title}

Generated by Icon Forge — UI Generator.

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`

The app will be available at http://localhost:5173.

## Build for production

\`\`\`bash
npm run build
npm run preview
\`\`\`

## Stack

- Vite + React 18
- Tailwind CSS 3
- ESM-only

Project: \`${name}\`
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
