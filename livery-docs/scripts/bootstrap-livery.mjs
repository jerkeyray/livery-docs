import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vendorRoot = path.join(projectRoot, '.vendor');
const clonedSource = path.join(vendorRoot, 'source');
const sibling = path.resolve(projectRoot, '..', '..', 'livery');
const hasSibling = existsSync(path.join(sibling, 'packages', 'core', 'package.json'));
const repository = process.env.LIVERY_REPOSITORY_URL ?? 'https://github.com/jerkeyray/livery.git';
const ref = process.env.LIVERY_REPOSITORY_REF ?? 'main';

mkdirSync(vendorRoot, { recursive: true });
if (!hasSibling) {
  if (!existsSync(path.join(clonedSource, '.git'))) {
    execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', repository, clonedSource], { stdio: 'inherit' });
  } else {
    execFileSync('git', ['remote', 'set-url', 'origin', repository], { cwd: clonedSource, stdio: 'inherit' });
  }
  execFileSync('git', ['fetch', '--depth', '1', 'origin', ref], { cwd: clonedSource, stdio: 'inherit' });
  execFileSync('git', ['checkout', '--detach', 'FETCH_HEAD'], { cwd: clonedSource, stdio: 'inherit' });
  execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: clonedSource, stdio: 'inherit' });
}

const source = hasSibling ? sibling : clonedSource;
if (!existsSync(path.join(source, 'node_modules', '.bin', 'tsdown'))) {
  execFileSync('bun', ['install', '--frozen-lockfile'], { cwd: source, stdio: 'inherit' });
}
for (const name of ['core', 'web', 'react', 'export-node', 'cli']) {
  execFileSync('bun', ['run', '--filter', `@liveryscript/${name}`, 'build'], { cwd: source, stdio: 'inherit' });
}
execFileSync('bun', ['run', '--filter', 'liveryscript', 'build'], { cwd: source, stdio: 'inherit' });

const packageSource = path.join(source, 'packages', 'liveryscript');
const packageTarget = path.join(vendorRoot, 'packages', 'liveryscript');
rmSync(packageTarget, { recursive: true, force: true });
mkdirSync(packageTarget, { recursive: true });
for (const entry of ['package.json', 'README.md', 'LICENSE', 'dist']) {
  const from = path.join(packageSource, entry);
  if (existsSync(from)) cpSync(from, path.join(packageTarget, entry), { recursive: true });
}

// A file dependency is installed from its source directory, so Bun considers
// devDependencies that npm would ignore in a packed consumer. Strip the
// facade's private workspace-only build dependencies from the vendored copy.
const vendoredManifestPath = path.join(packageTarget, 'package.json');
const vendoredManifest = JSON.parse(readFileSync(vendoredManifestPath, 'utf8'));
delete vendoredManifest.devDependencies;
writeFileSync(vendoredManifestPath, `${JSON.stringify(vendoredManifest, null, 2)}\n`);

const installedTarget = path.join(projectRoot, 'node_modules', 'liveryscript');
if (existsSync(path.dirname(installedTarget))) {
  rmSync(installedTarget, { recursive: true, force: true });
  cpSync(packageTarget, installedTarget, { recursive: true });
}

// These local packages are copied in place instead of receiving a new package
// version. Next can otherwise retain an older compiler in its generated server
// and vendor chunks even after bootstrap replaced node_modules successfully.
// Clearing only `.next/cache` is insufficient because `.next/dev/server` also
// contains compiled vendor code.
rmSync(path.join(projectRoot, '.next'), { recursive: true, force: true });

// Keep the Studio prompt and the compiler capability in lockstep. If a package
// copy or build ever regresses, fail during startup instead of spending an LLM
// request repairing syntax that the running compiler cannot understand.
const coreEntry = path.join(projectRoot, 'node_modules', 'liveryscript', 'dist', 'index.mjs');
const { compileVisual } = await import(`${pathToFileURL(coreEntry).href}?bootstrap=${Date.now()}`);
const flowProbe = compileVisual(`figure bootstrap_flow {
  client = service("Client")
  api = service("API")
  request = connect(client.right, api.left, role: primary)
  flow(client, api, direction: auto, gap: lg, rankGap: xl)
}`);
const flowErrors = flowProbe.diagnostics.filter(({ severity }) => severity === 'error');
if (flowErrors.length > 0 || flowProbe.document?.root.layout?.kind !== 'flow') {
  const details = flowErrors.map(({ code, message }) => `[${code}] ${message}`).join(' | ');
  throw new Error(`Bootstrapped Livery compiler does not support flow layout${details ? `: ${details}` : '.'}`);
}
