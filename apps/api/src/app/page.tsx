export const dynamic = 'force-static';

const ENDPOINTS = [
  { path: '/api/icons', desc: 'List icons (browse + filter + paginate)' },
  { path: '/api/icons/[slug]', desc: 'Single icon by slug' },
  { path: '/api/icons/categories', desc: 'Categories with counts' },
  { path: '/api/icons/generate', desc: 'POST — generate via AI' },
  { path: '/api/packages/[framework]', desc: '?style=… → .zip / ?format=tgz → .tgz' },
  { path: '/svg/[slug]', desc: 'Raw SVG (Content-Type image/svg+xml)' },
  { path: '/sprite/[style]', desc: 'Sprite SVG with <symbol> per icon' },
];

export default function Page() {
  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        background: '#09090b',
        color: '#fafafa',
        minHeight: '100vh',
        padding: '3rem 2rem',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Icon Forge — API</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
        This service hosts the API + asset endpoints. The web UI is a separate
        deployment.
      </p>
      <h2 style={{ fontSize: '1rem', color: '#a1a1aa', marginBottom: '0.75rem' }}>
        Endpoints
      </h2>
      <ul style={{ listStyle: 'none', padding: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>
        {ENDPOINTS.map((e) => (
          <li key={e.path} style={{ marginBottom: '0.5rem' }}>
            <code style={{ color: '#a78bfa' }}>{e.path}</code>{' '}
            <span style={{ color: '#71717a' }}>— {e.desc}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
