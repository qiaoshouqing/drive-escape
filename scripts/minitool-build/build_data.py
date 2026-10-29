#!/usr/bin/env python3
"""Turn the fetched boundaries into the compact JS payloads the mini-tool ships.

The container forbids fetch/XHR, so data cannot live in .json files the page
would have to request -- everything is emitted as classic .js that assigns to
window.
"""
import glob, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT  = os.path.join(HERE, "..", "..", "minitool", "assets")
TOL  = float(os.environ.get("MT_TOL", "0.008"))   # deg, ~0.8km
Q    = 1000                                        # 1e-3 deg grid
MIN_RING_SPAN = float(os.environ.get("MT_MIN_SPAN", "0.02"))  # drop specks


def simplify(pts, tol):
    """Iterative Douglas-Peucker (recursion would blow up on big rings)."""
    n = len(pts)
    if n < 3: return pts
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    t2 = tol * tol
    while stack:
        i, j = stack.pop()
        if j <= i + 1: continue
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        den = dx * dx + dy * dy
        best, bi = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            if den == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = ((px - ax) * dx + (py - ay) * dy) / den
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                d2 = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2
            if d2 > best: best, bi = d2, k
        if best > t2:
            keep[bi] = True
            stack.append((i, bi)); stack.append((bi, j))
    return [pts[k] for k in range(n) if keep[k]]


def encode_ring(pts):
    """Quantise to the 1e-3 grid, then delta-encode. Drops repeats."""
    out, px, py = [], 0, 0
    for (x, y) in pts:
        qx, qy = int(round(x * Q)), int(round(y * Q))
        if out and qx == px and qy == py: continue
        out.append(qx - px); out.append(qy - py)
        px, py = qx, qy
    return out


def rings_of(geom):
    t = geom.get("type")
    if t == "Polygon":     polys = [geom["coordinates"]]
    elif t == "MultiPolygon": polys = geom["coordinates"]
    else: return []
    out = []
    for poly in polys:
        for ri, ring in enumerate(poly):
            pts = [(c[0], c[1]) for c in ring if len(c) >= 2]
            if len(pts) < 4: continue
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            span = max(max(xs) - min(xs), max(ys) - min(ys))
            if ri == 0 and span < MIN_RING_SPAN: continue   # speck island
            if ri > 0 and span < MIN_RING_SPAN * 2: continue  # negligible hole
            s = simplify(pts, TOL)
            if len(s) < 4: continue
            if s[0] != s[-1]: s.append(s[0])
            e = encode_ring(s)
            if len(e) >= 8: out.append(e)
    return out


# Preset cities that ship with real OSRM-measured drive times. Centres match
# the live site (calibrated to the urban core, not the geometric centroid).
PRESETS = [
    ("hangzhou", "\u676d\u5dde", None),
    ("shanghai", "\u4e0a\u6d77", [121.47, 31.23]),
    ("beijing",  "\u5317\u4eac", [116.40, 39.91]),
    ("chengdu",  "\u6210\u90fd", None),
    ("xian",     "\u897f\u5b89", None),
]
# Same overrides the live site applies: DataV centres for these huge, sparse
# prefectures sit far from the urban core.
CITY_OVERRIDE = {
    "\u5317\u4eac\u5e02": [116.40, 39.91], "\u5929\u6d25\u5e02": [117.20, 39.13],
    "\u4e0a\u6d77\u5e02": [121.47, 31.23], "\u91cd\u5e86\u5e02": [106.55, 29.56],
    "\u547c\u4f2a\u8d1d\u5c14\u5e02": [119.77, 49.21], "\u9152\u6cc9\u5e02": [98.49, 39.73],
    "\u54c8\u5bc6\u5e02": [93.51, 42.83], "\u5df4\u97f3\u90ed\u695e\u8499\u53e4\u81ea\u6cbb\u5dde": [86.15, 41.77],
    "\u963f\u91cc\u5730\u533a": [80.11, 32.50], "\u90a3\u66f2\u5e02": [92.05, 31.48],
}
MUNICIPALITIES = [(110000, "\u5317\u4eac\u5e02", "\u5317\u4eac\u5e02"), (120000, "\u5929\u6d25\u5e02", "\u5929\u6d25\u5e02"),
                  (310000, "\u4e0a\u6d77\u5e02", "\u4e0a\u6d77\u5e02"), (500000, "\u91cd\u5e86\u5e02", "\u91cd\u5e86\u5e02")]


def build_drive(dist_by_code):
    """Keep only the OSRM-measured rows; the rest the app estimates locally
    with the same formula the live site uses, so nothing is lost."""
    out = {}
    for key, label, center in PRESETS:
        src = f"{HERE}/../../data/{key}.json"
        if not os.path.exists(src):
            print(f"  !! missing preset {src}", file=sys.stderr); continue
        dd = json.load(open(src))["driveData"]
        measured = {k: v for k, v in dd.items() if not v.get("estimated", False)}
        # origin = the measured district closest to the start
        best = min(measured.items(), key=lambda kv: (kv[1]["time"], kv[1]["dist"]))
        if center is None:
            c = dist_by_code[best[0]]["c"]
            center = [c[0], c[1]]
        out[key] = {
            "name": label,
            "o": [int(round(center[0] * Q)), int(round(center[1] * Q))],
            "m": {k: [int(round(v["time"] * 10)), int(v["dist"])]
                  for k, v in sorted(measured.items())},
        }
        print(f"  preset {key:9} measured={len(measured):4} origin={center} "
              f"(nearest: {dist_by_code[best[0]]['name']})")
    return out


def main():
    districts = json.load(open(f"{HERE}/districts.json"))
    cities    = json.load(open(f"{HERE}/cities.json"))
    os.makedirs(OUT, exist_ok=True)

    feats, dropped = [], 0
    for d in districts:
        rings = rings_of(d["geometry"])
        if not rings: dropped += 1; continue
        feats.append([
            d["adcode"], d["name"],
            int(round(d["c"][0] * Q)), int(round(d["c"][1] * Q)),
            rings,
        ])
    feats.sort(key=lambda f: f[0])

    geo = {"q": Q, "d": feats}
    p_geo = f"{OUT}/geo.js"
    with open(p_geo, "w") as f:
        f.write("window.MT_GEO=")
        json.dump(geo, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # origin picker: municipalities + prefecture cities + municipality districts
    by_code = {str(d["adcode"]): d for d in districts}
    seen = {c["adcode"] for c in cities}
    for code, name, prov in MUNICIPALITIES:
        if code not in seen:
            cities.append({"adcode": code, "name": name, "prov": prov,
                           "center": CITY_OVERRIDE[name], "level": "city"})
    cl = [[c["adcode"], c["name"], c["prov"],
           int(round(CITY_OVERRIDE.get(c["name"], c["center"])[0] * Q)),
           int(round(CITY_OVERRIDE.get(c["name"], c["center"])[1] * Q))]
          for c in cities]
    cl.sort(key=lambda c: c[0])
    p_cit = f"{OUT}/cities.js"
    with open(p_cit, "w") as f:
        f.write("window.MT_CITIES={q:%d,c:" % Q)
        json.dump(cl, f, ensure_ascii=False, separators=(",", ":"))
        f.write("};\n")

    drive = build_drive(by_code)
    p_drv = f"{OUT}/drive.js"
    with open(p_drv, "w") as f:
        f.write("window.MT_DRIVE={q:%d,p:" % Q)
        json.dump(drive, f, ensure_ascii=False, separators=(",", ":"))
        f.write("};\n")

    npts = sum(len(r) // 2 for fe in feats for r in fe[4])
    print(f"tol={TOL} minspan={MIN_RING_SPAN}")
    print(f"  districts kept {len(feats)} (dropped {dropped}), points {npts}")
    print(f"  geo.js    {os.path.getsize(p_geo)/1024:8.1f} KB")
    print(f"  cities.js {os.path.getsize(p_cit)/1024:8.1f} KB  ({len(cl)} entries)")
    print(f"  drive.js  {os.path.getsize(p_drv)/1024:8.1f} KB")


main()
