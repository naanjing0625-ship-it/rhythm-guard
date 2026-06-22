import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const transcriptsDir = join(
  process.env.USERPROFILE ?? process.env.HOME ?? '',
  '.cursor/projects/c-Users-happyelements-Projects-rhythm-guard/agent-transcripts',
);

const outPath = join(root, 'docs/完整对话记录.md');

function cleanText(raw) {
  if (!raw) return '';
  let t = raw;
  t = t.replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/g, '');
  t = t.replace(/<user_query>\s*/g, '');
  t = t.replace(/<\/user_query>/g, '');
  t = t.replace(/<manually_attached_skills>[\s\S]*?<\/manually_attached_skills>\s*/g, '');
  t = t.replace(/<attached_files>[\s\S]*?<\/attached_files>\s*/g, '');
  t = t.replace(/<image_files>[\s\S]*?<\/image_files>\s*/g, '');
  t = t.replace(/\[Image\]\s*/g, '');
  t = t.replace(/\[REDACTED\]\s*/g, '');
  t = t.replace(/<system_reminder>[\s\S]*?<\/system_reminder>\s*/g, '');
  t = t.replace(/<system_notification>[\s\S]*?<\/system_notification>\s*/g, '');
  return t.trim();
}

function extractTextBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => cleanText(c.text))
    .filter(Boolean);
}

function findLatestTranscript(dir) {
  let latest = null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(dir, entry.name, `${entry.name}.jsonl`);
    try {
      const mtime = statSync(candidate).mtimeMs;
      if (!latest || mtime > latest.mtime) {
        latest = { path: candidate, mtime };
      }
    } catch {
      // ignore missing jsonl
    }
  }
  return latest?.path ?? null;
}

const transcriptPath = findLatestTranscript(transcriptsDir);
if (!transcriptPath) {
  console.error('未找到 agent transcript 目录或 jsonl 文件:', transcriptsDir);
  process.exit(1);
}

let raw;
try {
  raw = readFileSync(transcriptPath, 'utf8');
} catch (err) {
  console.error('无法读取 transcript:', transcriptPath);
  console.error(err.message);
  process.exit(1);
}

const lines = raw.split('\n').filter(Boolean);
const sections = [];
let turn = 0;

for (const line of lines) {
  let row;
  try {
    row = JSON.parse(line);
  } catch {
    continue;
  }
  if (row.role !== 'user' && row.role !== 'assistant') continue;

  const texts = extractTextBlocks(row.message?.content);
  if (texts.length === 0) continue;

  const body = texts.join('\n\n');
  if (!body) continue;

  if (/^Briefly inform the user about the task result/i.test(body)) continue;

  turn += 1;
  const roleLabel = row.role === 'user' ? '用户' : '助手';
  sections.push(`## ${turn}. ${roleLabel}\n\n${body}\n`);
}

const today = new Date().toISOString().slice(0, 10);

const header = `# Rhythm Guard — 完整对话记录

> 导出时间：${today}  
> 来源：Cursor Agent 会话 transcript  
> 文件：\`${transcriptPath.replace(/\\/g, '/')}\`  
> 说明：已过滤工具调用、图片附件标记等；仅保留用户与助手的文字内容。

---

`;

const footer = `\n---\n\n*共 ${turn} 条对话轮次。*\n`;

writeFileSync(outPath, header + sections.join('\n---\n\n') + footer, 'utf8');

const sizeKb = (Buffer.byteLength(header + sections.join(''), 'utf8') / 1024).toFixed(1);
console.log(`\n✓ 已导出完整对话记录:`);
console.log(`  ${outPath}`);
console.log(`  来源: ${transcriptPath}`);
console.log(`  对话轮次: ${turn}`);
console.log(`  大小: ${sizeKb} KB\n`);
