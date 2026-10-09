import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const node = process.execPath;
const children = [
  spawn(node, ['--watch', join(root, 'server', 'index.js')], { cwd: root, stdio: 'inherit' }),
  spawn(node, [join(root, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: root, stdio: 'inherit' }),
];
let stopping = false;

function stopAll(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Could not start ResQNet development services:', error);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping && (code !== 0 || signal)) stopAll(code || 1);
  });
}

process.on('SIGINT', () => stopAll());
process.on('SIGTERM', () => stopAll());
