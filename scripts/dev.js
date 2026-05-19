const { spawn } = require('child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commands = [
  ['backend', ['run', 'dev', '--workspace', 'backend']],
  ['frontend', ['run', 'dev', '--workspace', 'frontend']],
];

const children = commands.map(([name, args]) => {
  const command = process.platform === 'win32' ? `${npm} ${args.join(' ')}` : npm;
  const commandArgs = process.platform === 'win32' ? [] : args;
  const child = spawn(command, commandArgs, {
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(`${name} dev server exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
