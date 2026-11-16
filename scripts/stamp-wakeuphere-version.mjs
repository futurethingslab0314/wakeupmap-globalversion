import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Stamp the HTML and manifest together so even an already-open old tab can
// identify its own deployment, including when a newer build arrives at startup.
const htmlPath = new URL('../dist/wakeuphere/index.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');
if (!html.includes('__WAKEUPHERE_BUILD__')) throw Error('Missing WakeUpHere build marker');
const version = randomUUID();
await writeFile(htmlPath, html.replaceAll('__WAKEUPHERE_BUILD__', version));
await writeFile(new URL('../dist/wakeuphere/version.json', import.meta.url), JSON.stringify({ version }));
console.log(`WakeUpHere deployment version: ${version}`);
