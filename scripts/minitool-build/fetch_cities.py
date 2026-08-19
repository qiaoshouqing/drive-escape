#!/usr/bin/env python3
"""Build-time only: pull prefecture-city names/centers from DataV so the
offline mini-tool can offer city search without any network call at runtime."""
import json, os, subprocess, sys, time

PROVINCES = [110000,120000,130000,140000,150000,210000,220000,230000,310000,
             320000,330000,340000,350000,360000,370000,410000,420000,430000,
             440000,450000,460000,500000,510000,520000,530000,540000,610000,
             620000,630000,640000,650000,710000,810000,820000]
OUT = os.path.join(os.path.dirname(__file__), "cities.json")

def get(url):
    out = subprocess.run(["curl", "-sSL", "--max-time", "30",
                          "-H", "User-Agent: DriveEscape/1.0", url],
                         capture_output=True, check=True).stdout
    return json.loads(out.decode("utf-8"))

prov = get("https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json")
prov_name = {str(f["properties"]["adcode"]): f["properties"]["name"] for f in prov["features"]}

cities = []
for code in PROVINCES:
    try:
        d = get(f"https://geo.datav.aliyun.com/areas_v3/bound/{code}_full.json")
    except Exception as e:
        print(f"  !! {code} failed: {e}", file=sys.stderr); continue
    pn = prov_name.get(str(code), str(code))
    for f in d["features"]:
        p = f["properties"]
        c = p.get("center") or p.get("centroid")
        if not c or len(c) != 2: continue
        cities.append({"adcode": int(p["adcode"]), "name": p["name"],
                       "prov": pn, "center": [round(c[0], 4), round(c[1], 4)],
                       "level": p.get("level", "")})
    print(f"  {pn}: {len(d['features'])}")
    time.sleep(0.25)

json.dump(cities, open(OUT, "w"), ensure_ascii=False)
print(f"\n{len(cities)} cities -> {OUT}")
