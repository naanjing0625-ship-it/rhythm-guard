# Rhythm Guard

音乐节奏 × 合成塔防 — **WebGL HTML5** 单文件游戏。

## 直接运行（无需安装）

构建后双击即可游玩：

```bash
npm install
npm run build:webgl
```

生成文件：

```
release/RhythmGuard.html
```

用 **Chrome** 或 **Edge** 打开该文件即可运行（WebGL 渲染，约 1.5MB，所有资源已内联）。

## 开发模式

```bash
npm run dev
```

浏览器访问 http://localhost:5173/

## 玩法

1. **节奏阶段** — 🟡单击 / 🔵长按3秒 / 🔴连击
2. **部署阶段** — 拖拽道具到棋盘，合成升级
3. **防守阶段** — 自动塔防，守护核心塔
