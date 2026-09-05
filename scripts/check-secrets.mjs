import {execFileSync} from 'node:child_process';
const content = execFileSync('git', ['diff', '--cached', '--text'], {maxBuffer: 20_000_000}).toString();
if (/sk-(?:proj-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{25,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(content)) {
  console.error('Secret-like material detected in staged changes.'); process.exit(1);
}
console.log('Staged secret scan passed.');
