/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { LUCIDE_MAPPING } from './lucide-mapping';
import { ICON_DEFINITIONS } from './icon-definitions';

const ICONS_DIR = path.resolve(
  process.cwd(),
  'node_modules/lucide-static/icons',
);

let missing = 0;
let unmapped = 0;

for (const def of ICON_DEFINITIONS) {
  const lname = LUCIDE_MAPPING[def.name];
  if (!lname) {
    unmapped += 1;
    console.warn(`✗ unmapped: "${def.name}"`);
    continue;
  }
  const file = path.join(ICONS_DIR, `${lname}.svg`);
  if (!fs.existsSync(file)) {
    missing += 1;
    console.warn(`✗ missing  lucide '${lname}' for "${def.name}"`);
  }
}

console.log(
  `\nTotal defs: ${ICON_DEFINITIONS.length}, unmapped: ${unmapped}, missing: ${missing}`,
);
process.exit(missing + unmapped > 0 ? 1 : 0);
