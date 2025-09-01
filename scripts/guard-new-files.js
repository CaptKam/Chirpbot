// Blocks random top-level files/folders + multiple lockfiles
import { execSync } from 'node:child_process';

const ALLOWED_TOP = new Set([
  'client','server','scripts','config','docs','migrations',
  '.replit','replit.nix','package.json','pnpm-lock.yaml','package-lock.json',
  'README.md','.gitignore','tsconfig.json','.husky','shared',
  'vite.config.ts','postcss.config.js','tailwind.config.ts',
  'drizzle.config.ts','components.json'
]);

// new, untracked files
const added = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

// files staged for commit (rename/add)
const staged = execSync('git diff --cached --name-only', { encoding: 'utf8' })
  .split('\n').filter(Boolean);

const candidates = [...new Set([...added, ...staged])];

const offenders = candidates.filter(p => !ALLOWED_TOP.has(p.split('/')[0]));
if (offenders.length) {
  console.error('\n❌ Blocked files/folders not on allow-list:\n' + offenders.map(f => ' - ' + f).join('\n'));
  console.error('\nAllowed top-level items:\n' + [...ALLOWED_TOP].join(', ') + '\n');
  process.exit(1);
}

// lockfile sanity: prevent multiple package managers
const hasYarn = candidates.some(p => p.includes('yarn.lock'));
const hasNpm = candidates.some(p => p.includes('package-lock.json'));
const hasPnpm = candidates.some(p => p.includes('pnpm-lock.yaml'));

// Allow one type of lockfile but not multiple
const lockfileCount = [hasYarn, hasNpm, hasPnpm].filter(Boolean).length;
if (lockfileCount > 1) {
  console.error('\n❌ Multiple package manager lockfiles detected. Use only one package manager.\n');
  process.exit(1);
}

console.log('✅ File structure guard passed');