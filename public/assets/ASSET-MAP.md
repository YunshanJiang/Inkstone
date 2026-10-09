# 展件资源映射

本目录中的二进制资源从原始素材逐字节复制，未修改 `Assets/Inkstone1/` 或 `Assets/UIElement/`。

| 发布路径 | 原始路径 | 设计资产标准映射 | 用途 |
| --- | --- | --- | --- |
| `/assets/models/YT-0001.glb` | `Assets/Inkstone1/Intstone1.glb` | — | `modelUrl`，三维模型 |
| `/assets/fallback/YT-0001.png` | `Assets/Inkstone1/fallbackImage.png` | — | `fallbackImage`，仅 GLB 确认失败后显示 |
| `/assets/models/YT-0002.glb` | 开发交付文件 `model3.fbx.glb` | — | `YT-0002` 的新模型；项目副本为贴图增加了相对 URI 和 PBR 材质绑定，几何数据不变 |
| `/assets/models/YT-0002/diffuse.png` | 开发交付文件 `diffuse.png` | — | `YT-0002` 的基础色贴图，已由 8192×8192 缩至 4096×4096；GLB 以带版本参数的相对路径引用 |
| `/assets/models/YT-0002/roughness.png` | 开发交付文件 `Substance_graph_roughness.png` | — | 保留文件；已移除 GLB 引用，运行时不请求，使用固定粗糙度 1 |
| `/assets/models/YT-0002/normal.png` | 开发交付文件 `Substance_graph_normal.png` | — | `YT-0002` 的法线贴图，由 GLB 以相对路径引用 |
| `/assets/fallback/YT-0002.png` | `public/assets/fallback/YT-0001.png`（测试副本） | — | `YT-0002` 的 `fallbackImage`，与 YT-0001 相同替换图 |
| `/assets/ui/backArrow.png` | `Assets/UIElement/backArrow.png` | `design-assets/ui/inkstone-directory-back-arrow-transparent.png` | 目录抽屉返回展示 |
| `/assets/ui/SwitchLeft.png` | `Assets/UIElement/SwitchLeft.png` | `design-assets/ui/inkstone-previous-button-transparent.png` | 上一方按钮边框与箭头 |
| `/assets/ui/SwitchRight.png` | `Assets/UIElement/SwitchRight.png` | 同组运行时扩展（下一方） | 下一方按钮边框与箭头 |
| `/assets/ui/FullScreen.png` | `Assets/UIElement/FullScreen.png` | `design-assets/ui/inkstone-fullscreen-icon-transparent.png` | 全屏/退出全屏图标 |
| `/assets/ui/autoRotate.png` | `Assets/UIElement/autoRotate.png` | `design-assets/ui/inkstone-auto-rotate-icon-transparent.png` | 自动旋转图标 |
| `/assets/ui/Panel.png` | `Assets/UIElement/Panel.png` | `design-assets/ui/inkstone-panel-handle-transparent.png` | 介绍面板 handle |
| `/assets/ui/infoBG.png` | `Assets/UIElement/infoBG.png` | — | 详情面板与目录菜单背景 |

每张 `fallbackImage` 当前约 39.6MB，保持原样，未压缩或替换。`YT-0002` 当前基础色、粗糙度与法线均为 4096×4096；发布和移动端显存风险需在后续资源优化阶段处理。

不同展件使用各自 GLB 内的 `TEXCOORD_0`。`YT-0001` 与 `YT-0002` 的贴图布局不强行共用；本次新增的 Substance 贴图按 `YT-0002` 的 UV 使用。
