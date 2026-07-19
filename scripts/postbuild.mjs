// With the @astrojs/cloudflare adapter + `base: '/store'`, Astro nests the
// prerendered static output under dist/store/ — so a .assetsignore placed
// in public/ ends up at dist/store/.assetsignore, one level too deep.
// wrangler's asset uploader needs it at the actual root of the configured
// assets directory (wrangler.jsonc "assets.directory": "./dist"), right
// next to dist/_worker.js. Writing it here directly guarantees that,
// regardless of how the adapter nests everything else.
import { writeFileSync } from 'node:fs';

writeFileSync('dist/.assetsignore', '');
console.log('Wrote dist/.assetsignore');
