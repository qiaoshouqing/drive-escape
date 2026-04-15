# 🚗 周末自驾逃离计划

选一个城市，一眼看清 5 小时驾车圈内所有区县。

**在线体验** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

**作者** → [@benshandebiao](https://x.com/benshandebiao)

🌐 [English](./README_EN.md) | [繁體中文](./README_TW.md) | [日本語](./README_JA.md)

## 功能

- 🔍 搜索任意城市，自动生成周边驾车时间热力地图
- 🗺️ 以区县为单位，10 档色阶（绿 → 红）
- 🏷️ 每个区县标注名称、耗时、距离
- ⏱️ OSRM 真实驾车时间 + 本地缓存
- 🌏 支持海外城市
- 📱 手机端适配

## 技术栈

| 组件 | 方案 |
|------|------|
| 地图渲染 | Leaflet + OpenStreetMap |
| 中国区划 | DataV GeoJSON API |
| 海外区划 | Overpass API |
| 驾车时间 | OSRM Table API（默认） / 高德驾车 API（国内） |
| 城市搜索 | Nominatim API（默认） / 高德地理编码 API（国内） |
| 部署 | Cloudflare Pages + Functions |

默认全部开源、无收费接口。

### 可选：国内用户启用高德

OSRM 与 Nominatim 在国内访问较慢或受限。在 Cloudflare Pages 配置以下两个
环境变量，界面语言为 `zh-CN` 时会自动切换到高德接口：

| 变量名 | 值 |
|--------|----|
| `USE_AMAP` | `true` |
| `AMAP_KEY` | 你的高德 Web 服务 Key |

## 本地运行

```bash
open index.html
# 或
python3 -m http.server 8080
```

## 部署

```bash
wrangler pages deploy . --project-name drive-escape
```

## 开源协议

MIT
