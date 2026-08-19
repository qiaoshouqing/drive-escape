/* 周末自驾逃离计划 — 小红书小工具
 *
 * 容器约束：纯本地、不联网。所有区划几何、城市索引与实测驾车数据都在
 * geo.js / cities.js / drive.js 里随包发出，页面自己用 Canvas 2D 画地图，
 * 不依赖任何地图瓦片或第三方库。
 */
(function () {
  'use strict';

  // ── 与线上版本一致的色阶与阈值 ──
  var BANDS = [
    { min: 0.0, max: 0.5, color: '#1a6e5c', label: '0–0.5h' },
    { min: 0.5, max: 1.0, color: '#2d9f83', label: '0.5–1h' },
    { min: 1.0, max: 1.5, color: '#6bab5e', label: '1–1.5h' },
    { min: 1.5, max: 2.0, color: '#a3c44d', label: '1.5–2h' },
    { min: 2.0, max: 2.5, color: '#d4d444', label: '2–2.5h' },
    { min: 2.5, max: 3.0, color: '#e8c83a', label: '2.5–3h' },
    { min: 3.0, max: 3.5, color: '#e8a43a', label: '3–3.5h' },
    { min: 3.5, max: 4.0, color: '#dd7733', label: '3.5–4h' },
    { min: 4.0, max: 4.5, color: '#cc4422', label: '4–4.5h' },
    { min: 4.5, max: 5.0, color: '#aa2211', label: '4.5–5h' }
  ];
  var GRAY = '#d3d3d3';
  var PAPER = '#e8e4d8';
  var MAX_HOURS = 5.0;      // 超过此耗时不着色
  var MAX_STRAIGHT = 400;   // km，直线距离上限，避免飞地染色
  var AVG_SPEED = 85;       // km/h，与线上估算模型一致
  var ROAD_FACTOR = 1.35;   // 直线 → 路网距离修正

  var $ = function (id) { return document.getElementById(id); };

  // ─────────────────────────── 几何解码 ───────────────────────────

  function projX(lng) { return (lng + 180) / 360; }
  function projY(lat) {
    var l = Math.max(-85.05, Math.min(85.05, lat));
    var s = Math.sin(l * Math.PI / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  }

  var DISTRICTS = [];

  function decodeGeo() {
    var q = window.MT_GEO.q, raw = window.MT_GEO.d;
    for (var i = 0; i < raw.length; i++) {
      var r = raw[i];
      var rings = [], minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
      for (var j = 0; j < r[4].length; j++) {
        var enc = r[4][j], n = enc.length >> 1;
        var pts = new Float32Array(n * 2);
        var ax = 0, ay = 0;
        for (var k = 0; k < n; k++) {
          ax += enc[k * 2]; ay += enc[k * 2 + 1];
          var wx = projX(ax / q), wy = projY(ay / q);
          pts[k * 2] = wx; pts[k * 2 + 1] = wy;
          if (wx < minx) minx = wx;
          if (wx > maxx) maxx = wx;
          if (wy < miny) miny = wy;
          if (wy > maxy) maxy = wy;
        }
        rings.push(pts);
      }
      DISTRICTS.push({
        code: String(r[0]), name: r[1],
        lng: r[2] / q, lat: r[3] / q,
        rings: rings, bb: [minx, miny, maxx, maxy]
      });
    }
  }

  function haversine(lng1, lat1, lng2, lat2) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function bandColor(t) {
    for (var i = 0; i < BANDS.length; i++) {
      if (t >= BANDS[i].min && t < BANDS[i].max) return BANDS[i].color;
    }
    return BANDS[BANDS.length - 1].color;
  }

  function fmtTime(t) {
    if (typeof t !== 'number') return '--';
    return t % 1 === 0 ? String(t) : t.toFixed(1);
  }

  // ─────────────────────────── 出发地 / 耗时 ───────────────────────────

  var state = {
    originName: '', originLng: 0, originLat: 0,
    preset: null,          // drive.js 里的实测数据（若有）
    info: null,            // code -> { t, dist, est, inRange }
    hot: [],               // 5 小时内可达的区县
    measuredCount: 0,
    selected: null
  };

  function setOrigin(name, lng, lat, presetKey) {
    state.originName = name;
    state.originLng = lng;
    state.originLat = lat;
    state.preset = (presetKey && window.MT_DRIVE.p[presetKey]) || null;
    state.selected = null;

    var measured = state.preset ? state.preset.m : null;
    var info = {}, hot = [], nMeasured = 0;

    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i];
      var straight = haversine(lng, lat, d.lng, d.lat);
      var t, dist, est;
      var m = measured && measured[d.code];
      if (m) {
        t = m[0] / 10; dist = m[1]; est = false; nMeasured++;
      } else {
        dist = Math.round(straight * ROAD_FACTOR);
        t = Math.round(dist / AVG_SPEED * 10) / 10;
        est = true;
      }
      var inRange = t <= MAX_HOURS && straight <= MAX_STRAIGHT;
      var rec = { t: t, dist: dist, est: est, inRange: inRange, d: d };
      info[d.code] = rec;
      if (inRange) hot.push(rec);
    }

    hot.sort(function (a, b) { return a.t - b.t; });
    state.info = info;
    state.hot = hot;
    state.measuredCount = nMeasured;
  }

  // ─────────────────────────── 视图与渲染 ───────────────────────────

  var canvas, ctx, VW = 0, VH = 0, dpr = 1;
  var view = { x: 0, y: 0, s: 1 };   // x,y = 屏幕左上角对应的世界坐标；s = 世界单位→px

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    VW = canvas.clientWidth;
    VH = canvas.clientHeight;
    canvas.width = Math.round(VW * dpr);
    canvas.height = Math.round(VH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function fitToHot() {
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    var list = state.hot.length ? state.hot : [];
    for (var i = 0; i < list.length; i++) {
      var bb = list[i].d.bb;
      if (bb[0] < minx) minx = bb[0];
      if (bb[1] < miny) miny = bb[1];
      if (bb[2] > maxx) maxx = bb[2];
      if (bb[3] > maxy) maxy = bb[3];
    }
    if (minx > maxx) {   // 兜底：围绕出发点给一个固定范围
      var ox = projX(state.originLng), oy = projY(state.originLat);
      minx = ox - 0.02; maxx = ox + 0.02; miny = oy - 0.02; maxy = oy + 0.02;
    }
    var padTop = 74, padBottom = 62, padX = 16;
    var s = Math.min((VW - padX * 2) / (maxx - minx),
                     (VH - padTop - padBottom) / (maxy - miny));
    view.s = s;
    view.x = (minx + maxx) / 2 - VW / 2 / s;
    view.y = (miny + maxy) / 2 - (padTop + (VH - padTop - padBottom) / 2) / s;
  }

  /* 把一个区县的所有环加进 Path2D。环包含孔洞，配合 evenodd 填充规则
     即可正确挖空。 */
  function addRings(path, d, ox, oy, s) {
    for (var j = 0; j < d.rings.length; j++) {
      var p = d.rings[j], n = p.length >> 1;
      path.moveTo((p[0] - ox) * s, (p[1] - oy) * s);
      for (var k = 1; k < n; k++) {
        path.lineTo((p[k * 2] - ox) * s, (p[k * 2 + 1] - oy) * s);
      }
      path.closePath();
    }
  }

  /* 单次渲染。分享图复用同一函数，只是换 ctx / 视口 / 缩放。 */
  function render(c, v, w, h, opt) {
    opt = opt || {};
    var scaleUI = opt.scaleUI || 1;
    c.save();
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);

    var ox = v.x, oy = v.y, s = v.s;
    var vx0 = ox, vy0 = oy, vx1 = ox + w / s, vy1 = oy + h / s;

    // 按颜色分组，一种颜色只 fill 一次
    var groups = {}, order = [], strokePath = new Path2D();
    var visible = [];
    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i], bb = d.bb;
      if (bb[2] < vx0 || bb[0] > vx1 || bb[3] < vy0 || bb[1] > vy1) continue;
      var rec = state.info[d.code];
      var col = rec && rec.inRange ? bandColor(rec.t) : GRAY;
      if (!groups[col]) { groups[col] = new Path2D(); order.push(col); }
      addRings(groups[col], d, ox, oy, s);
      addRings(strokePath, d, ox, oy, s);
      visible.push(d);
    }

    // 先灰后彩，保证可达区域压在上层
    order.sort(function (a, b) { return (a === GRAY ? 0 : 1) - (b === GRAY ? 0 : 1); });
    for (var g = 0; g < order.length; g++) {
      c.fillStyle = order[g];
      c.globalAlpha = order[g] === GRAY ? 0.5 : 0.82;
      c.fill(groups[order[g]], 'evenodd');
    }
    c.globalAlpha = 1;

    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = Math.max(0.5, 0.7 * scaleUI);
    c.lineJoin = 'round';
    c.stroke(strokePath);

    drawOrigin(c, v, scaleUI);
    if (opt.labels !== false) drawLabels(c, v, w, h, scaleUI);
    c.restore();
  }

  function drawOrigin(c, v, scaleUI) {
    var x = (projX(state.originLng) - v.x) * v.s;
    var y = (projY(state.originLat) - v.y) * v.s;
    var r = 5 * scaleUI;
    c.beginPath();
    c.arc(x, y, r + 3 * scaleUI, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fill();
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = '#c0392b';
    c.fill();
  }

  /* 标签：按耗时从近到远放置，和已放置标签的实际文字框相交就跳过。 */
  function drawLabels(c, v, w, h, scaleUI) {
    var span = (w / v.s) * 360;   // 视口跨度（经度）粗略换算详略程度
    var detail = span < 3 ? 2 : span < 9 ? 1 : 0;
    var fs = (span < 3 ? 11 : span < 9 ? 10 : 9) * scaleUI;
    var FAM = 'px -apple-system, "PingFang SC", sans-serif';
    var nameFont = '600 ' + fs + FAM;
    var subFont = '500 ' + (fs - scaleUI) + FAM;
    var lh = fs + 1.5 * scaleUI;
    var padX = 3.5 * scaleUI, padY = 2.5 * scaleUI;

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';

    var placed = [];
    var list = state.hot;
    for (var i = 0; i < list.length && placed.length < 160; i++) {
      var rec = list[i], d = rec.d;
      var x = (projX(d.lng) - v.x) * v.s;
      var y = (projY(d.lat) - v.y) * v.s;
      if (x < 4 || y < 4 || x > w - 4 || y > h - 4) continue;

      var lines = [d.name];
      if (detail >= 2) lines.push(fmtTime(rec.t) + 'h / ' + rec.dist + 'km');
      else if (detail >= 1) lines.push(fmtTime(rec.t) + 'h');

      c.font = nameFont;
      var tw = c.measureText(lines[0]).width;
      if (lines.length > 1) {
        c.font = subFont;
        tw = Math.max(tw, c.measureText(lines[1]).width);
      }
      var th = lines.length * lh;
      var box = [x - tw / 2 - padX, y - th / 2 - padY,
                 x + tw / 2 + padX, y + th / 2 + padY];

      var skip = false;
      for (var p = 0; p < placed.length; p++) {
        var q = placed[p];
        if (box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]) {
          skip = true; break;
        }
      }
      if (skip) continue;
      placed.push(box);

      for (var li = 0; li < lines.length; li++) {
        var ly = y + (li - (lines.length - 1) / 2) * lh;
        c.font = li === 0 ? nameFont : subFont;
        c.strokeStyle = 'rgba(255,255,255,0.92)';
        c.lineWidth = 2.6 * scaleUI;
        c.strokeText(lines[li], x, ly);
        c.fillStyle = li === 0 ? '#1f1f1f' : '#3d3d3d';
        c.fillText(lines[li], x, ly);
      }
    }
  }

  var rafId = 0;
  function draw() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () {
      rafId = 0;
      render(ctx, view, VW, VH, { scaleUI: 1 });
    });
  }

  // ─────────────────────────── 手势 ───────────────────────────

  var pointers = {}, pinch = null, panLast = null, moved = 0;

  function clampView() {
    var minS = Math.min(VW, VH) / 0.35;          // 最远：约覆盖大半个中国
    var maxS = Math.min(VW, VH) / 0.0012;        // 最近：城市级
    view.s = Math.max(minS, Math.min(maxS, view.s));
  }

  function zoomAt(px, py, factor) {
    var wx = view.x + px / view.s;
    var wy = view.y + py / view.s;
    view.s *= factor;
    clampView();
    view.x = wx - px / view.s;
    view.y = wy - py / view.s;
    draw();
  }

  function pointerList() {
    var out = [];
    for (var k in pointers) if (pointers.hasOwnProperty(k)) out.push(pointers[k]);
    return out;
  }

  function onDown(e) {
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var l = pointerList();
    moved = 0;
    if (l.length === 1) { panLast = { x: e.clientX, y: e.clientY }; pinch = null; }
    else if (l.length === 2) {
      panLast = null;
      pinch = { d: Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y) };
    }
  }

  function onMove(e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var l = pointerList();
    var rect = canvas.getBoundingClientRect();

    if (l.length >= 2 && pinch) {
      var nd = Math.hypot(l[0].x - l[1].x, l[0].y - l[1].y);
      if (pinch.d > 0 && nd > 0) {
        var mx = (l[0].x + l[1].x) / 2 - rect.left;
        var my = (l[0].y + l[1].y) / 2 - rect.top;
        zoomAt(mx, my, nd / pinch.d);
        moved += Math.abs(nd - pinch.d);
      }
      pinch.d = nd;
    } else if (panLast) {
      var dx = e.clientX - panLast.x, dy = e.clientY - panLast.y;
      moved += Math.abs(dx) + Math.abs(dy);
      view.x -= dx / view.s;
      view.y -= dy / view.s;
      panLast = { x: e.clientX, y: e.clientY };
      draw();
    }
    hideHint();
  }

  function onUp(e) {
    var wasSingle = pointerList().length === 1;
    delete pointers[e.pointerId];
    var l = pointerList();
    if (l.length < 2) pinch = null;
    if (l.length === 1) panLast = { x: l[0].x, y: l[0].y };
    else panLast = null;

    if (wasSingle && moved < 8) {
      var rect = canvas.getBoundingClientRect();
      pick(e.clientX - rect.left, e.clientY - rect.top);
    }
  }

  function inRing(pts, x, y) {
    var inside = false, n = pts.length >> 1;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = pts[i * 2], yi = pts[i * 2 + 1];
      var xj = pts[j * 2], yj = pts[j * 2 + 1];
      if ((yi > y) !== (yj > y) &&
          x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function pick(px, py) {
    var wx = view.x + px / view.s;
    var wy = view.y + py / view.s;
    var found = null;
    for (var i = 0; i < DISTRICTS.length; i++) {
      var d = DISTRICTS[i], bb = d.bb;
      if (wx < bb[0] || wx > bb[2] || wy < bb[1] || wy > bb[3]) continue;
      var hit = false;
      for (var j = 0; j < d.rings.length; j++) {
        if (inRing(d.rings[j], wx, wy)) hit = !hit;
      }
      if (hit) { found = d; break; }
    }
    showInfo(found);
  }

  // ─────────────────────────── UI ───────────────────────────

  function showInfo(d) {
    var panel = $('info');
    if (!d) { panel.hidden = true; return; }
    var rec = state.info[d.code];
    var isOrigin = rec && rec.t === 0;
    $('info-name').textContent = (isOrigin ? '🚗 ' : '') + d.name;
    if (!rec || !rec.inRange) {
      $('info-detail').innerHTML = '<span style="color:#999">超出 5 小时范围</span>';
    } else {
      $('info-detail').innerHTML =
        '<span class="time">🕐 ' + fmtTime(rec.t) + ' 小时</span> · ' +
        rec.dist + ' km' + (rec.est ? ' <span style="color:#999">(估算)</span>' : '');
    }
    panel.hidden = false;
  }

  var toastTimer = 0;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  function hideHint() {
    var el = $('hint');
    if (el && !el.classList.contains('gone')) {
      el.classList.add('gone');
      setTimeout(function () { el.hidden = true; }, 600);
    }
  }

  function buildLegend() {
    var box = $('band-list');
    box.innerHTML = '';
    BANDS.forEach(function (b) {
      var seg = document.createElement('i');
      seg.style.background = b.color;
      box.appendChild(seg);
    });
  }

  // ── 城市选择 ──

  var CITIES = [];
  var PRESET_BY_NAME = {};

  function buildCityIndex() {
    var q = window.MT_CITIES.q;
    CITIES = window.MT_CITIES.c.map(function (c) {
      return { code: String(c[0]), name: c[1], prov: c[2], lng: c[3] / q, lat: c[4] / q };
    });
    var pq = window.MT_DRIVE.q;
    for (var key in window.MT_DRIVE.p) {
      if (!window.MT_DRIVE.p.hasOwnProperty(key)) continue;
      var p = window.MT_DRIVE.p[key];
      PRESET_BY_NAME[p.name] = { key: key, lng: p.o[0] / pq, lat: p.o[1] / pq, name: p.name };
    }
  }

  /* 精选城市名（如「杭州」）与城市索引里的「杭州市」对应上，
     命中则用实测数据。 */
  function presetKeyFor(cityName) {
    for (var n in PRESET_BY_NAME) {
      if (!PRESET_BY_NAME.hasOwnProperty(n)) continue;
      if (cityName === n || cityName === n + '市') return PRESET_BY_NAME[n];
    }
    return null;
  }

  function renderResults(q) {
    var box = $('city-results');
    box.innerHTML = '';
    if (!q) return;
    var hits = [];
    for (var i = 0; i < CITIES.length && hits.length < 40; i++) {
      var c = CITIES[i];
      if (c.name.indexOf(q) === 0 || c.prov.indexOf(q) === 0) hits.push([0, c]);
      else if (c.name.indexOf(q) > -1) hits.push([1, c]);
    }
    if (!hits.length) {
      var em = document.createElement('div');
      em.className = 'result-empty';
      em.textContent = '没有找到「' + q + '」';
      box.appendChild(em);
      return;
    }
    hits.sort(function (a, b) { return a[0] - b[0]; });
    hits.slice(0, 30).forEach(function (h) {
      var c = h[1];
      var row = document.createElement('div');
      row.className = 'result-item touchable';
      var n = document.createElement('span');
      n.className = 'rn'; n.textContent = c.name;
      var p = document.createElement('span');
      p.className = 'rp'; p.textContent = c.prov;
      row.appendChild(n); row.appendChild(p);
      if (presetKeyFor(c.name)) {
        var tg = document.createElement('span');
        tg.className = 'tag'; tg.textContent = '实测';
        row.appendChild(tg);
      }
      row.addEventListener('click', function () { go(c.name, c.lng, c.lat); });
      box.appendChild(row);
    });
  }

  function buildQuickCities() {
    var box = $('quick-cities');
    box.innerHTML = '';
    ['杭州', '上海', '北京', '成都', '西安'].forEach(function (name) {
      var p = PRESET_BY_NAME[name];
      if (!p) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip touchable';
      b.textContent = name;
      b.addEventListener('click', function () { go(name, p.lng, p.lat); });
      box.appendChild(b);
    });
  }

  function go(name, lng, lat) {
    var p = presetKeyFor(name);
    if (p) { lng = p.lng; lat = p.lat; }
    setOrigin(name, lng, lat, p ? p.key : null);

    $('t-city').textContent = name;
    $('t-sub').textContent = state.hot.length + ' 个区县 · 5 小时可达';
    $('legend-note').textContent = state.measuredCount
      ? '实测 ' + state.measuredCount + ' 区县，其余为估算'
      : '基于路网系数估算';
    $('info').hidden = true;

    $('welcome').hidden = true;
    $('map-view').hidden = false;
    try { localStorage.setItem('mt_city', JSON.stringify([name, lng, lat])); } catch (e) {}

    resize();
    fitToHot();
    clampView();
    draw();
  }

  function back() {
    $('map-view').hidden = true;
    $('welcome').hidden = false;
  }

  // ─────────────────────────── 分享图 / JSBridge ───────────────────────────

  var posterData = '';

  function buildPoster() {
    var W = 1080, H = 1440, k = 3;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');

    var headH = 190, footH = 96;
    var mapH = H - headH - footH;

    // 以当前视图为中心，重新按海报尺寸取景
    var pv = { x: 0, y: 0, s: 0 };
    var cxw = view.x + VW / 2 / view.s;
    var cyw = view.y + VH / 2 / view.s;
    pv.s = view.s * (W / VW);
    pv.x = cxw - W / 2 / pv.s;
    pv.y = cyw - mapH / 2 / pv.s;

    c.save();
    c.translate(0, headH);
    c.beginPath();
    c.rect(0, 0, W, mapH);
    c.clip();
    render(c, pv, W, mapH, { scaleUI: k });
    c.restore();

    // 页头
    c.fillStyle = PAPER;
    c.fillRect(0, 0, W, headH);
    c.textAlign = 'center';
    c.fillStyle = '#8a8778';
    c.font = '600 24px -apple-system, "PingFang SC", sans-serif';
    c.fillText('D R I V E   E S C A P E', W / 2, 54);
    c.fillStyle = '#1c1c1c';
    c.font = '900 62px "Songti SC", "STSong", Georgia, serif';
    c.fillText('周末自驾逃离计划', W / 2, 124);
    c.fillStyle = '#1a6e5c';
    c.font = '700 30px -apple-system, "PingFang SC", sans-serif';
    c.fillText('从' + state.originName + '出发 · 5 小时可达 ' + state.hot.length + ' 个区县', W / 2, 168);

    // 页脚色阶条
    var fy = H - footH;
    c.fillStyle = PAPER;
    c.fillRect(0, fy, W, footH);
    var bw = (W - 120) / BANDS.length;
    for (var i = 0; i < BANDS.length; i++) {
      c.fillStyle = BANDS[i].color;
      c.fillRect(60 + i * bw, fy + 26, bw, 16);
    }
    c.fillStyle = '#6e6b60';
    c.font = '500 22px -apple-system, "PingFang SC", sans-serif';
    c.textAlign = 'left';
    c.fillText('0h', 60, fy + 70);
    c.textAlign = 'right';
    c.fillText('5h', W - 60, fy + 70);

    return cv.toDataURL('image/jpeg', 0.86);
  }

  function bridge() {
    return (window.xhs && window.xhs.miniTool) || null;
  }

  function openShare() {
    try {
      posterData = buildPoster();
    } catch (err) {
      toast('生成分享图失败');
      return;
    }
    $('poster-img').src = posterData;
    $('share-mask').hidden = false;
  }

  function withBridge(fn) {
    var b = bridge();
    if (!b) { toast('请在小红书 App 内使用该功能'); return null; }
    return fn(b);
  }

  function saveToAlbum() {
    withBridge(function (b) {
      var btn = $('btn-save');
      btn.disabled = true;
      Promise.resolve()
        .then(function () {
          // 优先落成临时文件再存相册；容器也接受直接传 data:uri
          if (typeof b.writeTempFile === 'function') {
            return b.writeTempFile({ data: posterData }).then(function (r) {
              return r && r.filePath ? r.filePath : posterData;
            }, function () { return posterData; });
          }
          return posterData;
        })
        .then(function (filePath) {
          return b.saveImageToPhotosAlbum({ filePath: filePath });
        })
        .then(function () { toast('已保存到相册'); },
              function (e) { toast('保存失败：' + ((e && e.errMsg) || '未知错误')); })
        .then(function () { btn.disabled = false; });
    });
  }

  function publishNote() {
    withBridge(function (b) {
      var btn = $('btn-note');
      btn.disabled = true;
      Promise.resolve(b.postNote({
        title: '从' + state.originName + '出发，5 小时能开多远',
        content: '用「周末自驾逃离计划」算了一下，从' + state.originName +
                 '出发开 5 小时，能覆盖 ' + state.hot.length +
                 ' 个区县。绿色是 1 小时内，红色是 4.5–5 小时。\n' +
                 '这个周末去哪儿，看这张图就够了。',
        pageType: 'photo_publish',
        mediaInfo: { image_resources: [{ url: posterData }] }
      })).then(function () { $('share-mask').hidden = true; },
               function (e) { toast('发布失败：' + ((e && e.errMsg) || '未知错误')); })
        .then(function () { btn.disabled = false; });
    });
  }

  // ─────────────────────────── 启动 ───────────────────────────

  function bind() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top,
             e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    window.addEventListener('resize', function () {
      if ($('map-view').hidden) return;
      resize(); clampView(); draw();
    });

    var input = $('city-input');
    var timer = 0;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var v = input.value.trim();
      timer = setTimeout(function () { renderResults(v); }, 90);
    });

    $('btn-back').addEventListener('click', back);
    $('btn-share').addEventListener('click', openShare);
    $('info-close').addEventListener('click', function () { $('info').hidden = true; });
    $('btn-share-close').addEventListener('click', function () { $('share-mask').hidden = true; });
    $('share-mask').addEventListener('click', function (e) {
      if (e.target === $('share-mask')) $('share-mask').hidden = true;
    });
    $('btn-save').addEventListener('click', saveToAlbum);
    $('btn-note').addEventListener('click', publishNote);
  }

  function init() {
    canvas = $('map');
    ctx = canvas.getContext('2d');
    decodeGeo();
    buildCityIndex();
    buildLegend();
    buildQuickCities();
    bind();
    $('boot').hidden = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
