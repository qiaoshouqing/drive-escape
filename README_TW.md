# 🚗 週末自駕逃離計劃

選一個城市，一眼看清 5 小時車程圈內所有區縣。

**線上體驗** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

🌐 [简体中文](./README.md) | [English](./README_EN.md) | [日本語](./README_JA.md)

## 功能

- 🔍 搜尋任意城市，自動產生周邊駕車時間熱力地圖
- 🗺️ 以區縣為單位，10 檔色階（綠 → 紅）
- 🏷️ 每個區縣標註名稱、耗時、距離
- ⏱️ OSRM 真實駕車時間 + 本地快取
- 🌏 支援海外城市
- 📱 手機端適配

## 技術棧

| 元件 | 方案 |
|------|------|
| 地圖渲染 | Leaflet + OpenStreetMap |
| 中國區劃 | DataV GeoJSON API |
| 海外區劃 | Overpass API |
| 駕車時間 | OSRM Table API |
| 城市搜尋 | Nominatim API |
| 部署 | Cloudflare Pages + Functions |

全部開源，無收費介面。

## 本地運行

```bash
open index.html
# 或
python3 -m http.server 8080
```

## 部署

```bash
wrangler pages deploy . --project-name drive-escape
```

## 開源協議

MIT
