# 🚗 Drive Escape - Weekend Self-Driving Map

Pick a city, see how far you can drive in 5 hours.

**Live Demo** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

**Author** → [@benshandebiao](https://x.com/benshandebiao)
🌐 [简体中文](./README_ZH.md) | [繁體中文](./README_TW.md) | [日本語](./README_JA.md)

## Features

- 🔍 Search any city, instantly generate a driving time heatmap
- 🗺️ District-level detail with 10-tier color scale (green → red)
- 🏷️ Labels with district name, drive time, and distance
- ⏱️ Real driving time via OSRM + local cache for instant reload
- 🌏 International support (Overpass API)
- 📱 Mobile friendly

## Tech Stack

| Component | Solution |
|-----------|----------|
| Map | Leaflet + OpenStreetMap |
| China Boundaries | DataV GeoJSON API |
| International | Overpass API |
| Driving Time | OSRM Table API (default) / Amap Driving API (CN) |
| City Search | Nominatim API (default) / Amap Geocode API (CN) |
| Hosting | Cloudflare Pages + Functions |

No paid APIs by default. Fully open source.

### Optional: Amap (高德) for Chinese users

OSRM and Nominatim can be slow or blocked from mainland China. Set two
Cloudflare Pages env vars to switch to Amap when the UI language is `zh-CN`:

| Variable | Value |
|----------|-------|
| `USE_AMAP` | `true` |
| `AMAP_KEY` | your Amap Web Service key |

## Run Locally

```bash
open index.html
# or
python3 -m http.server 8080
```

## Deploy

```bash
wrangler pages deploy . --project-name drive-escape
```

## License

MIT
