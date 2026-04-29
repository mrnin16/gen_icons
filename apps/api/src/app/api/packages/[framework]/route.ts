import { prisma } from '@/lib/prisma';
import { FRAMEWORK_BY_ID, type FrameworkId } from '@iconforge/shared';
import { NPM_INSTALLABLE, PACKAGE_BUILDERS, type IconInput } from '@/lib/packages';
import { buildNpmTarball, buildZip } from '@/lib/archive';
import { type NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Format = 'zip' | 'tgz';

function pickFormat(req: NextRequest, frameworkRaw: string): Format {
  const url = new URL(req.url);
  const explicit = url.searchParams.get('format');
  if (explicit === 'tgz' || explicit === 'zip') return explicit;
  if (frameworkRaw.endsWith('.tgz')) return 'tgz';
  if (frameworkRaw.endsWith('.zip')) return 'zip';
  return 'zip';
}

function stripExt(s: string): string {
  return s.replace(/\.(?:tgz|zip)$/i, '');
}

export async function GET(
  req: NextRequest,
  ctx: RouteContext<'/api/packages/[framework]'>,
) {
  const { framework: rawFramework } = await ctx.params;
  const fId = stripExt(rawFramework) as FrameworkId;
  const format = pickFormat(req, rawFramework);

  if (!FRAMEWORK_BY_ID[fId] || !PACKAGE_BUILDERS[fId]) {
    return new Response(
      JSON.stringify({ error: `Unknown framework: ${rawFramework}` }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      },
    );
  }

  if (format === 'tgz' && !NPM_INSTALLABLE.has(fId)) {
    return new Response(
      JSON.stringify({
        error: `Framework "${fId}" is not installable via tarball URL. Use format=zip and install via local path.`,
        suggestedFormat: 'zip',
      }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    );
  }

  const { searchParams } = new URL(req.url);
  const style = searchParams.get('style') || 'line-art';
  const includeAi = searchParams.get('includeAi') === '1';

  const icons = await prisma.icon.findMany({
    where: {
      style,
      ...(includeAi ? {} : { isAiGenerated: false }),
    },
    orderBy: { name: 'asc' },
    select: { name: true, svgContent: true },
  });

  if (icons.length === 0) {
    return new Response(
      JSON.stringify({ error: `No icons found for style "${style}".` }),
      { status: 404, headers: { 'content-type': 'application/json' } },
    );
  }

  const inputs: IconInput[] = icons.map((i) => ({
    name: i.name,
    svg: i.svgContent,
  }));

  const pkg = PACKAGE_BUILDERS[fId](inputs, style);

  if (format === 'tgz') {
    const buf = await buildNpmTarball(pkg);
    return new Response(new Uint8Array(buf), {
      headers: {
        'content-type': 'application/gzip',
        'content-disposition': `attachment; filename="${pkg.rootDir}-${style}.tgz"`,
        'content-length': String(buf.length),
        // npm fetches this URL — public cache for 1 hour, allow CORS so browser
        // tools (e.g. inspecting via fetch) work.
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    });
  }

  const buf = await buildZip(pkg);
  return new Response(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${pkg.archiveName}"`,
      'content-length': String(buf.length),
      'cache-control': 'no-store',
    },
  });
}
