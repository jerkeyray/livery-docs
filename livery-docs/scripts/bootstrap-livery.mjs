import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorRoot = path.join(projectRoot, '.vendor');
const clonedSource = path.join(vendorRoot, 'source');
const sibling = path.resolve(projectRoot, '..', '..', 'livery');
const hasSibling = existsSync(path.join(sibling, 'packages', 'core', 'package.json'));

mkdirSync(vendorRoot, { recursive: true });
if (!hasSibling && !existsSync(path.join(clonedSource, 'packages', 'core', 'package.json'))) {
  const repository = process.env.LIVERY_REPOSITORY_URL ?? 'https://github.com/jerkeyray/livery.git';
  const ref = process.env.LIVERY_REPOSITORY_REF ?? 'main';
  execFileSync('git', ['clone', '--depth', '1', '--branch', ref, repository, clonedSource], { stdio: 'inherit' });
  execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: clonedSource, stdio: 'inherit' });
}

const source = hasSibling ? sibling : clonedSource;
if (!existsSync(path.join(source, 'node_modules', '.bin', 'tsdown'))) {
  execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: source, stdio: 'inherit' });
}
for (const name of ['core', 'web', 'react']) {
  execFileSync('bun', ['run', '--filter', `@jerkeyray/${name}`, 'build'], { cwd: source, stdio: 'inherit' });
  const packageSource = path.join(source, 'packages', name);
  const packageTarget = path.join(vendorRoot, 'packages', name);
  rmSync(packageTarget, { recursive: true, force: true });
  mkdirSync(packageTarget, { recursive: true });
  for (const entry of ['package.json', 'README.md', 'LICENSE', 'dist']) {
    const from = path.join(packageSource, entry);
    if (existsSync(from)) cpSync(from, path.join(packageTarget, entry), { recursive: true });
  }

  const installedTarget = path.join(projectRoot, 'node_modules', '@jerkeyray', name);
  if (existsSync(path.dirname(installedTarget))) {
    rmSync(installedTarget, { recursive: true, force: true });
    cpSync(packageTarget, installedTarget, { recursive: true });
  }
}
