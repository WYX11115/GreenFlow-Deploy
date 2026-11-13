import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const forgePackageJson = require.resolve('@foundry-rs/forge/package.json');
const forgeRequire = createRequire(forgePackageJson);

const platform = process.platform;
const architecture = process.arch === 'x64' ? 'amd64' : process.arch;
const supported =
  (platform === 'darwin' && ['arm64', 'amd64'].includes(architecture)) ||
  (platform === 'linux' && ['arm64', 'amd64'].includes(architecture)) ||
  (platform === 'win32' && architecture === 'amd64');

if (!supported) {
  throw new Error(`Unsupported Forge platform: ${platform}-${architecture}.`);
}

const platformPackage = `@foundry-rs/forge-${platform}-${architecture}`;
const executable = forgeRequire.resolve(
  `${platformPackage}/bin/forge${platform === 'win32' ? '.exe' : ''}`
);
const result = spawnSync(executable, process.argv.slice(2), {
  env: process.env,
  stdio: 'inherit'
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

