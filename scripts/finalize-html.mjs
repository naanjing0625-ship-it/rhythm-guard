import { renameSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const releaseDir = join(__dirname, '../release');
const src = join(releaseDir, 'index.standalone.html');
const dst = join(releaseDir, 'RhythmGuard.html');

if (!existsSync(src)) {
  console.error('Build output not found:', src);
  process.exit(1);
}

let html = readFileSync(src, 'utf8');
html = html.replace('<title>Rhythm Guard</title>', '<title>Rhythm Guard — WebGL HTML5</title>');
html = html.replace(
  '</head>',
  '  <meta name="description" content="Rhythm Guard - WebGL HTML5 音乐节奏×合成塔防，单文件可直接运行" />\n  </head>',
);

writeFileSync(dst, html);
writeFileSync(join(releaseDir, 'index.html'), html);
writeFileSync(join(releaseDir, '.nojekyll'), '');
try { unlinkSync(src); } catch { /* ignore */ }

const readmePath = join(releaseDir, '试玩说明.txt');
const readme = `Rhythm Guard — 试玩说明
================================

【推荐：在线试玩（HTTPS 链接）】
· 用浏览器打开分享给你的 https:// 链接即可
· 推荐 Chrome 或 Edge（最新版）
· 无需下载、解压，刷新后也能继续玩
· 进度仍保存在本机浏览器（IndexedDB）

【离线包：本地 HTML5 文件】
1. 解压本压缩包（若收到的是 zip）
2. 双击 RhythmGuard.html，用浏览器打开
3. 推荐 Chrome 或 Edge（最新版）

【首次进入】
· 约 0.5 秒后会弹出「欢迎来到 Rhythm Guard」
· 建议点「开始引导」体验完整教学（节奏 → 部署 → 守卫）
· 也可点「稍后再说」，从主菜单自行选择「新手引导」或「开始游戏」

【基本操作 — 节奏阶段】
· 黄圈：点击屏幕 或 按空格（可连发）
· 蓝圈：到中心后按住约 3 秒再松开
· 红圈：到中心后 1.25 秒内快速连击（Perfect 需 6 次）

【基本流程】
① 节奏关 — 按节拍击打，获得道具
② 部署关 — 把道具摆到 6×6 棋盘，可拖拽合成升阶
③ 守卫关 — 塔自动攻击怪物，守住中央核心

【存档说明】
· 进度保存在本机浏览器里（IndexedDB）
· 换电脑或换浏览器不会同步进度
· 想重新看欢迎窗：清除该站点浏览器数据后刷新

【打不开 / 白屏？】
· 在线版：换 Chrome/Edge，不要用微信内置浏览器
· 离线版：右键 RhythmGuard.html → 打开方式 → Chrome 或 Edge
· 或将 html 文件拖进已打开的浏览器窗口
· 仍不行可换一台电脑或更新浏览器后再试

【反馈】
试玩中若有 bug 或建议，欢迎直接告诉分享给你的人。

祝玩得开心！
`;
writeFileSync(readmePath, readme, 'utf8');

const sizeMB = (Buffer.byteLength(html, 'utf8') / 1024 / 1024).toFixed(2);
console.log(`\n✓ WebGL HTML5 游戏已生成:`);
console.log(`  ${dst}`);
console.log(`  ${join(releaseDir, 'index.html')} (Pages 入口)`);
console.log(`  ${readmePath}`);
console.log(`  大小: ${sizeMB} MB`);
console.log(`\n本地试玩: 双击 RhythmGuard.html，或 npx serve release`);
console.log(`HTTPS 部署: 推送到 GitHub 后启用 Pages → 分享 https://<用户>.github.io/<仓库>/`);
console.log(`一键打 zip 包: npm run pack\n`);
