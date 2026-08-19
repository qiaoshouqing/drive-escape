#!/usr/bin/env python3
"""Build-time only: pull nationwide district boundaries + the city index from
DataV. The mini-tool runs offline, so everything it needs is baked in here."""
import json, os, subprocess, sys, time

CACHE = os.environ.get("MT_CACHE", "/tmp/mt-cache")
OUT   = os.path.dirname(os.path.abspath(__file__))
PROVINCES = [110000,120000,130000,140000,150000,210000,220000,230000,310000,
             320000,330000,340000,350000,360000,370000,410000,420000,430000,
             440000,450000,460000,500000,510000,520000,530000,540000,610000,
             620000,630000,640000,650000,810000,820000]  # 710000 (台湾) not served

os.makedirs(CACHE, exist_ok=True)

def get(code):
    """Fetch one DataV boundary file, caching to disk so re-runs are free."""
    path = os.path.join(CACHE, f"{code}.json")
    if os.path.exists(path) and os.path.getsize(path) > 200:
        try:    return json.load(open(path))
        except Exception: pass
    url = f"https://geo.datav.aliyun.com/areas_v3/bound/{code}_full.json"
    for attempt in range(3):
        try:
            out = subprocess.run(["curl", "-sSL", "--max-time", "40",
                                  "-H", "User-Agent: DriveEscape/1.0", url],
                                 capture_output=True, check=True).stdout
            d = json.loads(out.decode("utf-8"))
            open(path, "wb").write(out)
            return d
        except Exception as e:
            if attempt == 2:
                print(f"  !! {code}: {e}", file=sys.stderr)
                return None
            time.sleep(1.5)

prov_meta = get(100000)
prov_name = {str(f["properties"]["adcode"]): f["properties"]["name"]
             for f in prov_meta["features"]}

districts, cities = {}, []

def add_district(feat, prov, city):
    p = feat["properties"]
    c = p.get("centroid") or p.get("center")
    if not c or len(c) != 2 or not feat.get("geometry"): return
    districts[str(p["adcode"])] = {
        "adcode": int(p["adcode"]), "name": p["name"],
        "prov": prov, "city": city, "c": c, "geometry": feat["geometry"],
    }

for pc in PROVINCES:
    pj = get(pc)
    if not pj: continue
    pn = prov_name.get(str(pc), str(pc))
    n0 = len(districts)
    for f in pj["features"]:
        p = f["properties"]
        lvl = p.get("level", "")
        c = p.get("center") or p.get("centroid")
        if lvl == "district":
            # 直辖市: province file already lists districts
            add_district(f, pn, pn)
            if c: cities.append({"adcode": int(p["adcode"]), "name": p["name"],
                                 "prov": pn, "center": c, "level": "district"})
        else:
            if c: cities.append({"adcode": int(p["adcode"]), "name": p["name"],
                                 "prov": pn, "center": c, "level": "city"})
            cj = get(p["adcode"])
            feats = (cj or {}).get("features") or []
            if feats:
                for df in feats:
                    add_district(df, pn, p["name"])
            else:
                # county-level city with no sub-districts served: use its own
                # polygon so the map has no hole there
                add_district(f, pn, p["name"])
            time.sleep(0.12)
    print(f"  {pn}: +{len(districts)-n0} districts (total {len(districts)})")

json.dump(list(districts.values()), open(f"{OUT}/districts.json", "w"), ensure_ascii=False)
json.dump(cities, open(f"{OUT}/cities.json", "w"), ensure_ascii=False)
print(f"\n{len(districts)} districts, {len(cities)} cities")
