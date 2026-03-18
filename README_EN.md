# 🚗 Drive Escape - Weekend Self-Driving Map

Pick a city, see how far you can drive in 5 hours.

**Live Demo** → [drive-escape.pomodiary.com](https://drive-escape.pomodiary.com)

🌐 [简体中文](./README.md) | [繁體中文](./README_TW.md) | [日本語](./README_JA.md)

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
| Driving Time | OSRM Table API |
| City Search | Nominatim API |
| Hosting | Cloudflare Pages + Functions |

No paid APIs. Fully open source.

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
