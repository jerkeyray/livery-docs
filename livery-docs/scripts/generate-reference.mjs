import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLanguageCatalog } from 'liveryscript';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outputPath = path.join(projectRoot, 'content/docs/reference/standard-library.mdx');
const check = process.argv.includes('--check');
const catalog = getLanguageCatalog();

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const parameterLabel = (parameter) => {
  const required = parameter.required ? '' : '?';
  const values = parameter.values?.length ? ` — ${parameter.values.map((value) => `\`${value}\``).join(', ')}` : '';
  return `\`${parameter.name}${required}: ${parameter.type}\`${values}`;
};
const uniqueParameters = (call) => {
  const parameters = [...call.positional, ...(call.variadic ? [call.variadic] : []), ...call.named];
  return parameters.filter((parameter, index) => parameters.findIndex(({ name }) => name === parameter.name) === index);
};

const content = [
  '---',
  'title: Standard library reference',
  'description: Release-matched components, calls, parameters, ports, and tokens generated from the compiler contract.',
  'full: true',
  '---',
  '',
  '<Callout type="info" title="Generated from the compiler">',
  '  This page is generated from `getLanguageCatalog()` by `bun run docs:generate`. Do not edit it by hand.',
  '</Callout>',
  '',
  '## Components',
  '',
  '| Component | Category | Status | Description | Ports |',
  '| --- | --- | --- | --- | --- |',
  ...catalog.components.map((item) => `| \`${item.name}\` | ${escapeCell(item.category)} | ${escapeCell(item.status)} | ${escapeCell(item.description)} | ${item.ports.map((port) => `\`${port}\``).join(', ')} |`),
  '',
  '## Language calls',
  '',
  ...catalog.calls.flatMap((call) => [
    `### \`${call.name}\``,
    '',
    `${call.description} **Status:** ${call.status}. **Contexts:** ${call.contexts.map((context) => `\`${context}\``).join(', ')}.`,
    '',
    ...(uniqueParameters(call).length ? uniqueParameters(call).map((parameter) => `- ${parameterLabel(parameter)}${parameter.description ? ` — ${parameter.description}` : ''}`) : ['No parameters.']),
    '',
  ]),
  '## Semantic tokens',
  '',
  ...catalog.tokens.map((token) => `- \`${token}\``),
  '',
  '## Contract status',
  '',
  'Supported entries are part of the current alpha contract. Experimental entries may change additively. Unsupported entries are listed so tools can reject invented syntax rather than guessing.',
  '',
].join('\n');

if (check) {
  const current = await readFile(outputPath, 'utf8').catch(() => '');
  if (current !== content) {
    console.error('Generated reference is stale. Run `bun run docs:generate`.');
    process.exitCode = 1;
  } else {
    console.log(`Reference matches ${catalog.components.length} components and ${catalog.calls.length} calls.`);
  }
} else {
  await writeFile(outputPath, content);
  console.log(`Generated reference with ${catalog.components.length} components and ${catalog.calls.length} calls.`);
}
