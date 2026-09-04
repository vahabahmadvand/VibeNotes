#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Helper to run shell commands reliably cross-platform
function run(cmd, cwd = rootDir) {
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

// 1. Read package.json to get current version
const pkgPath = resolve(rootDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

// Parse CLI argument
const targetArg = process.argv[2]?.trim();

if (!targetArg) {
  console.log(`
Current version: ${currentVersion}

Usage:
  npm run bump <version | patch | minor | major>

Examples:
  npm run bump patch   # ${currentVersion} -> ${bumpSemver(currentVersion, 'patch')}
  npm run bump minor   # ${currentVersion} -> ${bumpSemver(currentVersion, 'minor')}
  npm run bump major   # ${currentVersion} -> ${bumpSemver(currentVersion, 'major')}
  npm run bump 0.4.0   # ${currentVersion} -> 0.4.0
`);
  process.exit(1);
}

function bumpSemver(version, type) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    throw new Error(`Current version "${version}" is not valid semver (X.Y.Z)`);
  }
  let [_, major, minor, patch] = match.map((n, i) => (i > 0 && i < 4 ? parseInt(n, 10) : n));
  if (type === 'patch') patch += 1;
  else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  }
  return `${major}.${minor}.${patch}`;
}

let nextVersion;
if (['patch', 'minor', 'major'].includes(targetArg.toLowerCase())) {
  nextVersion = bumpSemver(currentVersion, targetArg.toLowerCase());
} else {
  // Strip optional leading 'v'
  nextVersion = targetArg.startsWith('v') ? targetArg.slice(1) : targetArg;
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(nextVersion)) {
    console.error(`❌ Invalid semver version: "${targetArg}". Expected format: X.Y.Z (e.g. 0.3.6)`);
    process.exit(1);
  }
}

if (nextVersion === currentVersion) {
  console.log(`⚠️ Version is already ${nextVersion}. Nothing to update.`);
  process.exit(0);
}

console.log(`\n📦 Bumping version: ${currentVersion} -> ${nextVersion}\n`);

// 2. Update package.json
pkg.version = nextVersion;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`  ✓ Updated package.json`);

// 3. Update src-tauri/tauri.conf.json
const tauriConfPath = resolve(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = nextVersion;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
console.log(`  ✓ Updated src-tauri/tauri.conf.json`);

// 4. Update src-tauri/Cargo.toml ([package] version = "...")
const cargoTomlPath = resolve(rootDir, 'src-tauri', 'Cargo.toml');
let cargoToml = readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?version\s*=\s*)"[^"]+"/,
  `$1"${nextVersion}"`
);
writeFileSync(cargoTomlPath, cargoToml, 'utf8');
console.log(`  ✓ Updated src-tauri/Cargo.toml`);

// 5. Update package-lock.json
console.log(`  ⏳ Synchronizing package-lock.json...`);
run('npm i --package-lock-only');
console.log(`  ✓ Synchronized package-lock.json`);

// 6. Update Cargo.lock
console.log(`  ⏳ Synchronizing src-tauri/Cargo.lock...`);
run('cargo check --manifest-path src-tauri/Cargo.toml');
console.log(`  ✓ Synchronized src-tauri/Cargo.lock`);

console.log(`
🎉 Successfully bumped version to ${nextVersion}!

Next steps to release:
  git add .
  git commit -m "release: v${nextVersion}"
  git tag v${nextVersion}
  git push origin master --tags
`);
