// Refuses to run the Playwright regression suites against a stale or foreign scanner runtime. Every recorded hash must
// match the file on disk, the recorded pin must equal the current pin, and every overlay must match the working tree.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OVERLAY_MODULES, PROVENANCE_FILE, overlayHashes, readPin } from './build-e2e-dist.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repo, 'dist', 'tools', 'rtl-scanner');
const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const fail = message => { console.error(`E2E_DIST_STALE: ${message}. Run: npm run rtl:e2e:build`); process.exit(1); };

const provenancePath = join(outDir, PROVENANCE_FILE);
if (!existsSync(provenancePath)) fail('no provenance file (the runtime was not built by scripts/build-e2e-dist.mjs)');
const provenance = JSON.parse(readFileSync(provenancePath, 'utf8'));
if (provenance.pin !== readPin()) fail(`built for pin ${provenance.pin}, package pins ${readPin()}`);
const current = overlayHashes();
for (const name of OVERLAY_MODULES) if (provenance.overlays[name] !== current[name]) fail(`overlay ${name} changed since the build`);
const onDisk = readdirSync(outDir).filter(n => n.endsWith('.js')).sort();
const recorded = Object.keys(provenance.outputs).sort();
if (JSON.stringify(onDisk) !== JSON.stringify(recorded)) fail('module list differs from the recorded build');
for (const name of recorded) if (sha256(readFileSync(join(outDir, name))) !== provenance.outputs[name]) fail(`module ${name} was modified after the build`);
console.log(`E2E_DIST_VERIFIED pin=${provenance.pin} implementation=${provenance.implementationHead.slice(0, 7)} wrapper=${provenance.wrapperHead.slice(0, 7)} modules=${recorded.length} overlayDirty=${provenance.wrapperOverlayDirtyFiles.length}`);
