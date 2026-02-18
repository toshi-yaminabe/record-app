import { execSync } from 'child_process';
import { rmSync } from 'fs';
import { join } from 'path';

const projectDir = process.cwd();

console.log('[fix-deps] Removing node_modules...');
try {
  rmSync(join(projectDir, 'node_modules'), { recursive: true, force: true, maxRetries: 3 });
  console.log('[fix-deps] node_modules removed.');
} catch (e) {
  console.log('[fix-deps] Could not fully remove node_modules, trying rm -rf...');
  try {
    execSync('rm -rf node_modules', { cwd: projectDir, stdio: 'inherit' });
    console.log('[fix-deps] node_modules removed via rm -rf.');
  } catch (e2) {
    console.error('[fix-deps] Failed to remove node_modules:', e2.message);
  }
}

console.log('[fix-deps] Removing package-lock.json...');
try {
  rmSync(join(projectDir, 'package-lock.json'), { force: true });
  console.log('[fix-deps] package-lock.json removed.');
} catch (e) {
  console.log('[fix-deps] No package-lock.json to remove.');
}

console.log('[fix-deps] Removing .next cache...');
try {
  rmSync(join(projectDir, '.next'), { recursive: true, force: true });
  console.log('[fix-deps] .next removed.');
} catch (e) {
  console.log('[fix-deps] No .next to remove.');
}

console.log('[fix-deps] Cleaning npm cache...');
try {
  execSync('npm cache clean --force', { cwd: projectDir, stdio: 'inherit' });
  console.log('[fix-deps] npm cache cleaned.');
} catch (e) {
  console.log('[fix-deps] npm cache clean failed, continuing...');
}

console.log('[fix-deps] Running npm install...');
try {
  execSync('npm install', { cwd: projectDir, stdio: 'inherit', timeout: 120000 });
  console.log('[fix-deps] npm install complete!');
} catch (e) {
  console.error('[fix-deps] npm install failed:', e.message);
  process.exit(1);
}
