import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="docs-brand">
          <Image src="/livery-mark.svg" alt="" width={24} height={24} />
          <span>{appName}</span>
        </span>
      ),
    },
    links: [{ text: 'Studio', url: '/studio' }],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
