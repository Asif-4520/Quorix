import { openUrl } from '@tauri-apps/plugin-opener';

export const APP_INFO = {
  name: 'Quorix',
  version: '0.1.0',
  tagline: 'Keyboard-first desktop SQL & database client built for speed and precision.',
  ownerName: 'Asif Hossain',
  ownerHandle: 'Asif-4520',
  gitAuthor: 'Asif Hossain',
  githubProfileUrl: 'https://github.com/Asif-4520',
  repoUrl: 'https://github.com/Asif-4520/Quorix',
  issuesUrl: 'https://github.com/Asif-4520/Quorix/issues',
  releasesUrl: 'https://github.com/Asif-4520/Quorix/releases',
  techStack: [
    'Tauri 2',
    'Rust',
    'SQLx',
    'React 19',
    'TypeScript',
    'CodeMirror 6',
    'TanStack Table',
  ],
  engines: ['PostgreSQL', 'MySQL / MariaDB', 'SQLite'],
} as const;

export const ABOUT_LINKS: Array<{
  id: string;
  label: string;
  description: string;
  url: string;
  group: 'owner' | 'project';
}> = [
  {
    id: 'personal-github',
    label: 'Personal GitHub (@Asif-4520)',
    description: 'View developer profile, repositories, and open-source work',
    url: APP_INFO.githubProfileUrl,
    group: 'owner',
  },
  {
    id: 'quorix-repo',
    label: 'Quorix Source Repository',
    description: 'Browse source code, roadmap, and star Quorix on GitHub',
    url: APP_INFO.repoUrl,
    group: 'project',
  },
  {
    id: 'quorix-releases',
    label: 'Releases & Changelog',
    description: 'Download desktop installers and check version notes',
    url: APP_INFO.releasesUrl,
    group: 'project',
  },
  {
    id: 'quorix-issues',
    label: 'Report Bug / Feature Request',
    description: 'Open an issue on the Quorix GitHub tracker',
    url: APP_INFO.issuesUrl,
    group: 'project',
  },
];

export async function openExternalUrl(url: string): Promise<void> {
  try {
    await openUrl(url);
  } catch {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
