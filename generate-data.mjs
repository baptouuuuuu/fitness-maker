import { readFile, writeFile } from 'node:fs/promises';
const input = process.argv[2];
if (!input) throw new Error('Usage: node generate-data.mjs path/to/exercises.json');
const source = JSON.parse(await readFile(input, 'utf8'));
const data = source.map(e => ({id:e.id,name:e.name,category:e.category,equipment:e.equipment,target:e.target,steps:e.instruction_steps.fr,gif:e.gif_url}));
await writeFile(new URL('./exercises-data.js', import.meta.url), `// Generated from exercises-dataset; see LICENSE-DATA.\nexport default ${JSON.stringify(data)};\n`);
