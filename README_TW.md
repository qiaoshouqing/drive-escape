# 🚗 週末自駕逃離計劃

選一個城市，一眼看清 5 小時車程圈內所有區縣。

**線上體驗** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

**作者** → [@benshandebiao](https://x.com/benshandebiao)

🌐 [简体中文](./README_ZH.md) | [English](./README_EN.md) | [日本語](./README_JA.md)

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
| 駕車時間 | OSRM Table API（預設）／高德駕車 API（中國大陸） |
| 城市搜尋 | Nominatim API（預設）／高德地理編碼 API（中國大陸） |
| 部署 | Cloudflare Pages + Functions |

預設全部開源、無收費介面。

### 選用：中國大陸用戶啟用高德

OSRM 與 Nominatim 在中國大陸存取較慢或受阻。可在 Cloudflare Pages 設定以下
兩個環境變數，當介面語言為 `zh-CN` 時自動切換到高德介面：

| 變數名稱 | 值 |
|---------|----|
| `USE_AMAP` | `true` |
| `AMAP_KEY` | 你的高德 Web 服務 Key |

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
