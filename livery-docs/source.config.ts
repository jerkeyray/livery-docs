import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';

const liveryLanguage = {
  name: 'livery',
  scopeName: 'source.livery',
  patterns: [
    { include: '#comments' },
    { include: '#strings' },
    { include: '#numbers' },
    { include: '#tokens' },
    { include: '#keywords' },
    { include: '#constants' },
    { include: '#calls' },
  ],
  repository: {
    comments: {
      patterns: [
        { name: 'comment.line.double-slash.livery', match: '//.*$' },
        { name: 'comment.line.number-sign.livery', match: '#.*$' },
      ],
    },
    strings: {
      patterns: [{ name: 'string.quoted.double.livery', begin: '"', end: '"', patterns: [{ name: 'constant.character.escape.livery', match: '\\\\.' }] }],
    },
    numbers: { patterns: [{ name: 'constant.numeric.livery', match: '\\b-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?\\b' }] },
    tokens: { patterns: [{ name: 'variable.other.constant.livery', match: '\\$[A-Za-z_][A-Za-z0-9_.-]*' }] },
    keywords: {
      patterns: [{
        name: 'keyword.control.livery',
        match: '\\b(?:component|figure|return|timeline|state|transition|true|false)\\b',
      }],
    },
    constants: {
      patterns: [{
        name: 'constant.language.livery',
        match: '\\b(?:neutral|info|success|warning|danger|default|muted|emphasis|soft|solid|ghost|auto|right|down|top|bottom|left|center|primary|secondary|supporting|directional|bidirectional|async|data|advisory|fast|normal|slow)\\b',
      }],
    },
    calls: { patterns: [{ name: 'entity.name.function.livery', match: '\\b[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()' }] },
  },
};

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      langs: [liveryLanguage, 'typescript'],
      langAlias: {
        livery: 'typescript',
      },
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
    },
  },
});
