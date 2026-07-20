import { source } from '@/lib/source';
import { llms } from 'fumadocs-core/source';

export const revalidate = false;

export function GET() {
  const introduction = [
    '# Livery documentation',
    '',
    '> Canonical documentation for the programmable `figure` language, SDKs, generating agents, and compiler architecture.',
    '> Release-matched site: https://livery.jerkeyray.com',
    '',
    'Recommended paths:',
    '- Humans: /docs/start then /docs/language and /docs/sdks',
    '- Agents: /docs/agents then /docs/reference/standard-library',
    '- Contributors: /docs/architecture then /docs/operations/contributing',
    '',
    'The standard-library reference is generated from the compiler used to build this site.',
    '',
  ].join('\n');

  return new Response(`${introduction}${llms(source).index()}`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
