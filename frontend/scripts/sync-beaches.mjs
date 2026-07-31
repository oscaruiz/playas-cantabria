import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const source = path.resolve(frontendRoot, '../regions/cantabria/beaches.json');
const destination = path.resolve(frontendRoot, 'src/data/beaches.json');

await copyFile(source, destination);
