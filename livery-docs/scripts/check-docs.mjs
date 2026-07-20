import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProgram, getLanguageCatalog } from 'liveryscript';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const docsRoot = path.join(projectRoot, 'content/docs');
const files = await collect(docsRoot);
const routes = new Set(files.map((file) => routeFor(file)));
routes.add('/docs');
let examples = 0;
const problems = [];

for (const file of files) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/```livery\n([\s\S]*?)```/g)) {
    examples += 1;
    const result = compileProgram(match[1]);
    const errors = result.diagnostics.filter(({ severity }) => severity === 'error');
    if (!result.document || errors.length) {
      problems.push(`${relative(file)}: invalid Livery example: ${errors.map(({ code, message }) => `[${code}] ${message}`).join(' | ')}`);
    }
  }
  for (const match of source.matchAll(/(?:href=|\]\()(["']?)(\/docs(?:\/[^"')#?\s]+)?)/g)) {
    const target = match[2].replace(/\/$/, '') || '/docs';
    if (!routes.has(target)) problems.push(`${relative(file)}: broken internal link ${target}`);
  }
}

const catalog = getLanguageCatalog();
const generated = await readFile(path.join(docsRoot, 'reference/standard-library.mdx'), 'utf8');
for (const component of catalog.components) if (!generated.includes(`\`${component.name}\``)) problems.push(`Generated reference omits component ${component.name}`);
for (const call of catalog.calls) if (!generated.includes(`### \`${call.name}\``)) problems.push(`Generated reference omits call ${call.name}`);

if (!examples) problems.push('No compiled Livery examples were found.');
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${files.length} pages, ${examples} Livery examples, ${catalog.components.length} components, and ${catalog.calls.length} calls.`);
}

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.flatMap((entry) => entry.isDirectory()
    ? [collect(path.join(directory, entry.name))]
    : entry.name.endsWith('.mdx') ? [Promise.resolve([path.join(directory, entry.name)])] : []));
  return nested.flat().sort();
}

function routeFor(file) {
  const slug = path.relative(docsRoot, file).replace(/\.mdx$/, '').replace(/(^|\/)index$/, '');
  return `/docs${slug ? `/${slug}` : ''}`.replace(/\/$/, '') || '/docs';
}

function relative(file) {
  return path.relative(projectRoot, file);
}
