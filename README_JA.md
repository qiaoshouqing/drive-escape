# 🚗 週末ドライブ脱出マップ

都市を選んで、5時間以内に車でどこまで行けるか一目で確認。

**デモ** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

**Author** → [@benshandebiao](https://x.com/benshandebiao)

🌐 [简体中文](./README_ZH.md) | [English](./README_EN.md) | [繁體中文](./README_TW.md)

## 機能

- 🔍 任意の都市を検索、周辺の運転時間ヒートマップを自動生成
- 🗺️ 区県単位、10段階のカラースケール（緑→赤）
- 🏷️ 各区県に名称・所要時間・距離を表示
- ⏱️ OSRM による実際の運転時間 + ローカルキャッシュ
- 🌏 海外都市にも対応
- 📱 スマホ対応

## 技術スタック

| コンポーネント | ソリューション |
|--------------|--------------|
| 地図 | Leaflet + OpenStreetMap |
| 中国行政区画 | DataV GeoJSON API |
| 海外行政区画 | Overpass API |
| 運転時間 | OSRM Table API（既定） / Amap Driving API（中国本土） |
| 都市検索 | Nominatim API（既定） / Amap Geocode API（中国本土） |
| デプロイ | Cloudflare Pages + Functions |

既定では全てオープンソース・有料APIなし。

### オプション：中国本土ユーザー向け Amap（高德）

中国本土からは OSRM や Nominatim が遅い／遮断される場合があります。Cloudflare
Pages に以下の環境変数を設定すると、UI 言語が `zh-CN` のとき Amap に切り替わります：

| 変数名 | 値 |
|--------|----|
| `USE_AMAP` | `true` |
| `AMAP_KEY` | Amap Web サービスキー |

## ローカル実行

```bash
open index.html
# または
python3 -m http.server 8080
```

## デプロイ

```bash
wrangler pages deploy . --project-name drive-escape
```

## ライセンス

MIT
