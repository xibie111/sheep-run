# 小羊快跑 / Sheep Run

一个零依赖、手机优先的温暖乡村农场像素风横版无尽跑酷小游戏。

## 运行

可以直接双击打开 `index.html`，也可以在工作区根目录启动静态服务器：

```powershell
python -m http.server 4173 --directory sheep-run
```

然后打开 <http://127.0.0.1:4173/>。

## 操作

- 手机：点击游戏画面或右下角的「跳跃」按钮。
- 电脑：按 `Space`、`ArrowUp` 或 `W` 跳跃。
- 撞到栅栏后，点击「再跑一次」重新开始。

游戏横屏体验更舒展，但竖屏也保留了可玩的响应式布局。分数和最高分保存在当前浏览器的 `localStorage` 中，不需要联网。

## 文件

- `index.html`：游戏页面结构、HUD 和状态层。
- `style.css`：农场像素视觉、响应式布局和手机安全区适配。
- `game.js`：Canvas 渲染、静态背景缓存、用户小羊 AVIF 贴图处理、跑酷物理、碰撞、计分和输入处理。
- `assets/cartoon-sheep-pixel-design_61878-536.avif`：小羊本地贴图素材。
