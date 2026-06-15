import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const releaseDir = join(root, 'release');
const htmlPath = join(releaseDir, 'RhythmGuard.html');
const readmePath = join(releaseDir, '试玩说明.txt');
const zipPath = join(releaseDir, 'RhythmGuard-playtest.zip');

console.log('▶ 构建单文件游戏…');
execSync('npm run build:html', { cwd: root, stdio: 'inherit' });

if (!existsSync(htmlPath)) {
  console.error('缺少构建产物:', htmlPath);
  process.exit(1);
}
if (!existsSync(readmePath)) {
  console.error('缺少试玩说明:', readmePath);
  process.exit(1);
}

console.log('▶ 打包 zip…');
if (process.platform === 'win32') {
  const ps = [
    'Compress-Archive',
    `-LiteralPath '${htmlPath.replace(/'/g, "''")}','${readmePath.replace(/'/g, "''")}'`,
    `-DestinationPath '${zipPath.replace(/'/g, "''")}'`,
    '-Force',
  ].join(' ');
  execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'inherit' });
} else {
  execSync(
    `zip -j -f "${zipPath}" "${htmlPath}" "${readmePath}"`,
    { stdio: 'inherit' },
  );
}

const zipKb = (statSync(zipPath).size / 1024).toFixed(1);
console.log('\n✓ 试玩包已就绪:');
console.log(`  ${zipPath}`);
console.log(`  大小: ${zipKb} KB`);
console.log('\n将 RhythmGuard-playtest.zip 发给朋友即可。\n');
