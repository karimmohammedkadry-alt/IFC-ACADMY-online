import fs from 'node:fs';

const file = 'src-tauri/tauri.conf.json';
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const repository = process.env.GITHUB_REPOSITORY;
const publicKey = process.env.TAURI_UPDATE_PUBLIC_KEY;
const railwayUrl = String(process.env.RAILWAY_APP_URL || '').trim().replace(/\/$/, '');
const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 1);
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const baseVersion = String(packageJson.version || config.version || '15.2.0').split('.').map(Number);
const major = Number.isFinite(baseVersion[0]) ? baseVersion[0] : 15;
const minor = Number.isFinite(baseVersion[1]) ? baseVersion[1] : 2;
const version = `${major}.${minor}.${runNumber}`;

if (!repository) throw new Error('GITHUB_REPOSITORY is required.');
if (!publicKey || publicKey.includes('__TAURI_UPDATE_PUBLIC_KEY__')) {
  throw new Error('Missing TAURI_UPDATE_PUBLIC_KEY GitHub secret.');
}
if (!railwayUrl || !/^https:\/\//i.test(railwayUrl)) {
  throw new Error('Missing/invalid RAILWAY_APP_URL. Set it to your HTTPS Railway public domain, e.g. https://your-app.up.railway.app');
}

config.version = version;
config.plugins.updater.pubkey = publicKey.trim();
config.plugins.updater.endpoints = [
  `https://github.com/${repository}/releases/latest/download/latest.json`
];
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');

fs.mkdirSync('src/generated', { recursive: true });
const runtimeConfig = `// Generated automatically for this Windows release.\nexport const IFC_API_BASE_URL = ${JSON.stringify(railwayUrl)};\n`;
fs.writeFileSync('src/generated/runtimeConfig.ts', runtimeConfig);
console.log(`Prepared IFC Academy Windows release ${version}`);
console.log(`Embedded Railway API URL: ${railwayUrl}`);
