# 小红书小工具版 · 周末自驾逃离计划

把这个网站改造成小红书「小工具」（离线 H5 容器）的版本。

产物：**`dist/drive-escape-minitool.zip`**（588 KB，可直接上传）

## 为什么要重写而不是直接打包

小工具容器**纯本地、不联网**，`fetch` / `XMLHttpRequest` / 外部图片字体一律不可用。
线上版本几乎每个功能都依赖网络，所以逐项做了离线替代：

| 线上版本 | 小工具版本 |
| --- | --- |
| Leaflet + OpenStreetMap 瓦片（CDN） | 自研 Canvas 2D 渲染器，无底图瓦片、无第三方库 |
| DataV / Overpass 拉行政区划 | 全国 2871 个区县边界在构建时抓好，简化后随包发出 |
| Nominatim / 高德 地理编码搜索 | 479 个市/区的本地索引，纯前端字符串匹配 |
| OSRM Table API 算驾车时间 | 5 个精选城市的**实测**结果内置；其余用与线上一致的估算模型本地计算 |
| Google Fonts（Noto Serif SC） | 系统字体栈 |
| Google Analytics / 遥测 | 移除 |

保留不变：10 级色阶与配色、5 小时 / 400km 直线距离阈值、
估算模型（直线距离 × 1.35 ÷ 85km/h）、区县标签的名称 + 耗时 + 距离。

Leaflet 没有采用：它的产物里含 `navigator.geolocation`，属于容器禁用能力，
即使不调用也会在扫描时留下残留。

## 相对线上版的取舍

- **仅中国大陆 + 港澳**：区划数据需随包发出，海外部分（Overpass）无法离线化
- **仅简体中文**：目标用户即小红书站内用户，去掉了 4 语言切换
- **非精选城市为估算值**：实测驾车时间需要 OSRM，离线拿不到；UI 上明确标注「估算」

## 新增：小红书原生能力

- 生成 1080×1440 分享图（当前视图 + 标题 + 色阶）
- `writeTempFile` → `saveImageToPhotosAlbum` 保存到相册
- `postNote` 一键发布图文笔记

仅使用 `jsbridge-api.md` 白名单内的 API；不在小红书 App 内运行时按钮会提示而不报错。

## 构建

```bash
python3 scripts/minitool-build/fetch_geo.py    # 联网：抓全国区划（结果已提交，通常无需重跑）
python3 scripts/minitool-build/build_data.py   # 简化 + 量化 + 编码成 assets/*.js
python3 scripts/minitool-build/package.py      # 校验 + 打包成 dist/*.zip
```

`package.py` 会按 `.claude/SKILL.md` 及其 reference 的自检清单逐项扫描，
任何一项不通过就非零退出、不产出 zip。

## 数据说明

- 边界按 Douglas-Peucker 简化（容差 0.006° ≈ 600m），坐标量化到 1e-3° 网格后做增量编码
- 因容器禁止 `fetch`，`.json` 无法在运行时读取，所有数据以 `.js` 挂到 `window` 上
- 数据源：DataV.GeoAtlas（行政区划）、OSRM（实测驾车时间）
