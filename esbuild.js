import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts', 'src/com.github.kinten108101.SteamVpk.ts'],
  outdir: 'steamvpk',
  bundle: true,
  // target: "firefox60", // Since GJS 1.53.90
  // target: "firefox68", // Since GJS 1.63.90
  target: 'firefox78', // Since GJS 1.65.90
  // target: "firefox91", // Since GJS 1.71.1
  format: 'esm',
  // platform: 'node',
  external: ['gi://*'],
});

