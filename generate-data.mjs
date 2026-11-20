import { readFile, writeFile } from 'node:fs/promises';
const input = process.argv[2];
if (!input) throw new Error('Usage: node generate-data.mjs path/to/exercises.json');
const source = JSON.parse(await readFile(input, 'utf8'));
if (!Array.isArray(source.exercises)) throw new Error('Catalogue RepDB invalide.');
const data = source.exercises.map(e => ({
  id:e.id, name:e.name_en, bodyPart:e.body_part, category:e.category, equipment:e.equipment,
  muscles:e.primary_muscles || [], steps:e.instructions_en, images:e.images.flat
}));
await writeFile(new URL('./repdb-data.js', import.meta.url), `// Generated from RepDB; see README.md for license and attribution.\nexport default ${JSON.stringify(data)};\n`);
