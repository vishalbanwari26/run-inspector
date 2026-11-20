import type { NextConfig } from 'next';

// STATIC=1 builds the read-only demo for GitHub Pages from fixtures/snapshot.json.
// The API routes are named route.live.ts so the static build leaves them out.
const isStatic = process.env['STATIC'] === '1';

const config: NextConfig = {
  pageExtensions: isStatic ? ['tsx', 'ts'] : ['tsx', 'ts', 'live.ts'],
  ...(isStatic && { output: 'export', distDir: '.next-static', basePath: '/run-inspector', images: { unoptimized: true }, trailingSlash: true }),
  devIndicators: false,
  env: { NEXT_PUBLIC_STATIC: isStatic ? '1' : '0' },
};

export default config;
