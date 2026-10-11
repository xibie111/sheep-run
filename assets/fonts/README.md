# 全游戏统一本地位图字体

入口加载页的 tips 按用户要求使用独立的 **Ark Pixel 12 大像素字形**：`assets/fonts/loading/` 保存 252 字形子集、离线 BDF 和 OFL 许可。它采用整数像素缩放与硬 Alpha，支持 48 句随机提示；`python tools/build-loading-font.py` 可重建。其他场景继续使用下面的 Pasture Display 字库。

全游戏动态文字现在统一使用 **Pasture Display**（ZCOOL KuaiLe，SIL OFL 1.1），覆盖首页数字、跑酷 HUD、连星/道具提示、衣橱、通用按钮和结算页。仅加载 `pasture-display-12/20/40/64.png` 与同名 `.fnt`。四个字号来自同一个固定版本字体文件；40 px 使用同字形的金色描边处理，所有 PNG 都是硬 Alpha、最近邻采样。生图控件的手绘标签保留原图。`PixelText.ts` 作为原调用的兼容入口也转到这套字体。

`python tools/build-display-fonts.py` 从本地 `tools/font-sources/ZCOOLKuaiLe-Regular.ttf` 重建并检查全部生产代码中文字符覆盖。普通文字和 HUD 使用同一套 64 px 字图，以屏幕实际分辨率显示；首页分数使用 `menu-reference-v2` 的生图数字字图，配合原木牌的粗体数字风格。Phaser 仍负责布局、可见性和触控区域，没有系统字体回退或远程字体请求。

2026-10-09 清晰度修复：`DisplaySurface.ts` 将文字/首页画布的尺寸和起点对齐物理像素，避免浏览器合成时再次缩放。`SharpBitmap.ts` 按最终显示尺寸计算笔画覆盖，再将 Alpha 固定为 0/255；每个字形按 1:1 物理像素绘制，保留缩小时易被最近邻漏采样的细线。插值仅用于离屏覆盖计算，最终文字画布关闭平滑，字形按尺寸缓存。暂停面板由 `DisplayArtLayer.ts` 直接绘制原始高清 PNG，跳过低分辨率游戏画布。字体源文件和 UI PNG 均未修改；运行时四套字库由既有构建脚本重建，补齐新增 HUD 中文等 29 个字形，原有 238 个字形的像素逐字验证一致。三种屏幕的前后截图与硬 Alpha/细线检查位于 `docs/aegis/work/2026-10-09-font-clarity/`。

以下为保留的旧字体资源记录，运行时不再加载：

运行时只加载 `pasture-pixel-10/12.png` 与同名 `.fnt`。两套 PNG 合计约 10 KB，每套含 236 个字形，覆盖十三款皮肤的中文名称；所有字形为硬 Alpha 位图，Phaser 使用 Nearest Neighbor。没有远程字体请求、Canvas 文本栅格化或系统字体回退。

- 10 px 来源：[Fusion Pixel Font 2026.09.25](https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.25)，简体中文等宽版本。
- 12 px 来源：[Ark Pixel Font 2026.09.25](https://github.com/TakWolf/ark-pixel-font/releases/tag/2026.09.25)，简体中文等宽版本。
- 作者 TakWolf；遵循随附的 SIL Open Font License 1.1。子集改名为 Pasture Pixel，保留版权。
- `tools/font-sources` 保存本轮所需字形的 BDF 子集，可离线重建。`python tools/build-ui-fonts.py` 检查中文字符覆盖后生成 Phaser 字图，不允许静默缺字。新增文案不在子集内时，生成脚本从固定版本的上游 BDF 补字；再运行 `python tools/cache-ui-font-sources.py` 更新离线子集。
- 字号使用 10、12 px 及其整数倍。价格、名称、标题、数字和状态均由 Phaser BitmapText 绘制。

这次只替换主菜单、暂停/设置、衣橱和 SceneButton 的文字渲染；其他场景的版式与 HUD 美术不在此次 UI 重做范围内。
