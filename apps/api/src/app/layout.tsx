import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Icon Forge API',
  description: 'API + asset endpoints for Icon Forge.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
