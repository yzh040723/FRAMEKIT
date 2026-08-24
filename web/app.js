/* ============================================================
   照片 EXIF 编辑器 - 前端逻辑
   通过 window.framekit 与 Electron 主进程通信
   ============================================================ */
(function () {
  "use strict";

  function getApi() {
    var framekit = window.framekit;
    if (!framekit) return null;
    return {
      choose_photo: framekit.choosePhoto,
      open_photo: framekit.openPhoto,
      import_photo: framekit.importPhoto,
      export: function (payload) { return framekit.exportPhoto({ src: payload.src, fields: payload.fields || {}, defaultName: payload.default_name || "edited.jpg" }); },
      save_website: framekit.saveWebsite,
      list_websites: framekit.listWebsites,
      delete_website: framekit.deleteWebsite,
      get_settings: framekit.getSettings,
      save_settings: framekit.saveSettings,
      get_app_info: framekit.getAppInfo,
      minimize_window: framekit.minimizeWindow,
      close_window: framekit.closeWindow,
      toggle_maximize: framekit.toggleMaximize,
      resize_window: framekit.resizeWindow,
      wgs84_to_gcj02: framekit.wgs84ToGcj02,
      gcj02_to_wgs84: framekit.gcj02ToWgs84
    };
  }

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    dropzone: $("dropzone"), fileInput: $("fileInput"),
    workspace: $("workspace"), dashboard: $("dashboard"), settingsPage: $("settingsPage"), aboutPage: $("aboutPage"), websitesPage: $("websitesPage"), websiteGrid: $("websiteGrid"), recommendGrid: $("recommendGrid"), websiteModal: $("websiteModal"), websiteDialogTitle: $("websiteDialogTitle"), websiteName: $("websiteName"), websiteDesc: $("websiteDesc"), websiteUrl: $("websiteUrl"), modulePlaceholder: $("modulePlaceholder"), placeholderTitle: $("placeholderTitle"), placeholderDescription: $("placeholderDescription"), exportBar: $("exportBar"), sidebar: document.querySelector(".sidebar"), sidebarResizer: $("sidebarResizer"),
    navHome: $("navHome"), navExif: $("navExif"), pageTitle: $("pageTitle"), dashDate: $("dashDate"),
    tabList: $("tabList"), btnNewTab: $("btnNewTab"), btnWindowClose: $("btnWindowClose"), btnMinimize: $("btnMinimize"), btnMaximize: $("btnMaximize"),
    previewImg: $("previewImg"),
    mName: $("mName"), mSize: $("mSize"), mBytes: $("mBytes"), mTaken: $("mTaken"),
    btnOpenTop: $("btnOpenTop"), btnChangePhoto: $("btnChangePhoto"), btnExport: $("btnExport"),
    inFileName: $("inFileName"), expPreview: $("expPreview"),
    // 表单
    inTakenAt: $("inTakenAt"), inIso: $("inIso"), inEv: $("inEv"),
    inShutter: $("inShutter"), inAperture: $("inAperture"), inFocal35: $("inFocal35"),
    inMake: $("inMake"), inModel: $("inModel"), inSerial: $("inSerial"),
    inLat: $("inLat"), inLng: $("inLng"), inAlt: $("inAlt"),
    origTakenAt: $("origTakenAt"), origIso: $("origIso"), origEv: $("origEv"),
    origShutter: $("origShutter"), origAperture: $("origAperture"), origFocal35: $("origFocal35"),
    origMake: $("origMake"), origModel: $("origModel"), origSerial: $("origSerial"),
    btnPickPos: $("btnPickPos"), btnClearPos: $("btnClearPos"),
    // 地图弹窗
    mapModal: $("mapModal"), inSearch: $("inSearch"), btnSearch: $("btnSearch"),
    btnLocate: $("btnLocate"), resultList: $("resultList"), coordText: $("coordText"),
    btnCancelMap: $("btnCancelMap"), btnConfirmMap: $("btnConfirmMap"), btnCloseMap: $("btnCloseMap"),
    toast: $("toast"),
  };

  var MODULES = {
    home: { title: "工具箱", label: "工具箱", icon: "⌂", closable: true },
    exif: { title: "EXIF 编辑器", label: "EXIF 编辑器", icon: "✦", closable: true },
    websites: { title: "工具网址", label: "工具网址", icon: "⌘", closable: true },
    settings: { title: "设置", label: "设置", icon: "⚙", closable: true },
    about: { title: "关于", label: "关于", icon: "ⓘ", closable: true },
  };

  var state = {
    photo: null, orig: null, selPos: null,
    activeTabId: "home-1",
    nextTabId: 2,
    openModules: [{ id: "home-1", moduleId: "home" }],
    moduleCache: { "home-1": {} },
    stats: { opened: 0, exported: 0 },
  };

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function toast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = "toast" + (type ? " " + type : "");
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 3200);
  }

  /* ---------------- 打开照片 ---------------- */
  function readFileAsDataURL(file, cb) {
    var reader = new FileReader();
    reader.onload = function () { cb(reader.result); };
    reader.onerror = function () { toast("读取文件失败", "err"); };
    reader.readAsDataURL(file);
  }

  function uploadAndOpen(dataUrl, name) {
    var api = getApi();
    if (!api) { toast("后端未就绪", "err"); return; }
    api.import_photo(dataUrl, name).then(function (res) {
      if (res.ok) applyPhoto(res);
      else toast(res.error || "打开失败", "err");
    }).catch(function (e) { toast("打开失败：" + e, "err"); });
  }

  function openPhoto(path) {
    var api = getApi();
    if (!api) { toast("后端未就绪", "err"); return; }
    api.open_photo(path).then(function (res) {
      if (!res.ok) { toast(res.error || "打开失败", "err"); return; }
      applyPhoto(res);
    }).catch(function (e) { toast("打开失败：" + e, "err"); });
  }

  function renderTabs() {
    els.tabList.innerHTML = "";
    state.openModules.forEach(function (tabState) {
      var mod = MODULES[tabState.moduleId];
      var tab = document.createElement("button");
      tab.className = "tab" + (state.activeTabId === tabState.id ? " active" : "");
      tab.dataset.tab = tabState.id;
      tab.innerHTML = '<span class="tab-favicon">' + mod.icon + '</span><span class="tab-label">' + mod.label + '</span>' + (mod.closable ? '<span class="tab-close" aria-label="关闭">×</span>' : '');
      tab.addEventListener("click", function (e) {
        if (e.target.closest(".tab-close")) { e.stopPropagation(); closeModule(tabState.id); return; }
        activateTab(tabState.id);
      });
      els.tabList.appendChild(tab);
    });
  }

  function showView(tabId) {
    var tabState = state.openModules.find(function (item) { return item.id === tabId; });
    if (!tabState) return;
    state.activeTabId = tabId;
    var moduleId = tabState.moduleId;
    var editor = moduleId === "exif";
    var settings = moduleId === "settings";
    var about = moduleId === "about";
    var websites = moduleId === "websites";
    var placeholder = !editor && !settings && !about && !websites && moduleId !== "home";
    els.dashboard.hidden = editor || placeholder || settings || about || websites;
    els.settingsPage.hidden = !settings;
    els.aboutPage.hidden = !about;
    els.websitesPage.hidden = !websites;
    if (websites) loadWebsites();
    els.modulePlaceholder.hidden = !placeholder;
    els.workspace.hidden = !editor || !state.photo;
    els.exportBar.hidden = !editor || !state.photo;
    els.dropzone.hidden = true;
    if (placeholder) { els.placeholderTitle.textContent = MODULES[moduleId].title; els.placeholderDescription.textContent = MODULES[moduleId].description || "这个工具模块正在准备中。"; }
    els.btnOpenTop.hidden = !editor;
    els.pageTitle.textContent = MODULES[moduleId].title;
    document.querySelectorAll(".nav-item[data-module]").forEach(function (item) { item.classList.toggle("active", item.dataset.module === moduleId); });
    renderTabs();
  }

  function activateModule(moduleId) {
    if (!MODULES[moduleId]) return;
    var tabId = moduleId + "-" + state.nextTabId++;
    state.openModules.push({ id: tabId, moduleId: moduleId });
    state.moduleCache[tabId] = moduleId === "exif" ? { dispose: disposeExifCache } : {};
    showView(tabId);
    if (moduleId === "exif" && !state.photo) {
      els.workspace.hidden = true; els.exportBar.hidden = true; els.dropzone.hidden = false;
    }
  }

  function openEditor() { activateModule("exif"); }
  function backToHome() { activateModule("home"); }
  function navigateModule(moduleId) {
    var existing = state.openModules.find(function (item) { return item.moduleId === moduleId; });
    if (existing) {
      activateTab(existing.id);
    } else {
      activateModule(moduleId);
    }
  }

  function disposeExifCache() {
    if (map) { map.remove(); map = null; marker = null; }
    els.previewImg.removeAttribute("src");
    [els.inTakenAt, els.inIso, els.inEv, els.inShutter, els.inAperture, els.inFocal35, els.inMake, els.inModel, els.inSerial, els.inLat, els.inLng, els.inAlt].forEach(function (el) { if (el) el.value = ""; });
    state.photo = null; state.orig = null; state.selPos = null;
  }

  function clearModuleCache(tabId) {
    var cache = state.moduleCache[tabId] || {};
    Object.keys(cache).forEach(function (key) {
      if (typeof cache[key] === "function") cache[key]();
    });
    state.moduleCache[tabId] = {};
  }

  function closeModule(tabId) {
    var index = state.openModules.findIndex(function (item) { return item.id === tabId; });
    if (index < 0) return;
    var moduleId = state.openModules[index].moduleId;
    if (!MODULES[moduleId].closable) return;
    if (moduleId === "home" && state.openModules.length === 1) {
      var api = getApi();
      if (api && api.close_window) api.close_window();
      return;
    }
    clearModuleCache(tabId);
    state.openModules.splice(index, 1);
    delete state.moduleCache[tabId];
    var next = state.openModules[Math.max(0, index - 1)] || state.openModules[0];
    showView(next.id);
    toast(MODULES[moduleId].label + "已关闭，模块缓存已清理", "ok");
  }

  function activateTab(tabId) {
    showView(tabId);
    var tabState = state.openModules.find(function (item) { return item.id === tabId; });
    if (tabState && tabState.moduleId === "exif" && !state.photo) {
      els.workspace.hidden = true; els.exportBar.hidden = true; els.dropzone.hidden = false;
    }
  }

  function applyPhoto(photo) {
    state.stats.opened += 1;
    state.photo = photo;
    state.orig = photo.exif || {};
    state.selPos = null;

    var activeExif = state.openModules.find(function (item) { return item.moduleId === "exif" && item.id === state.activeTabId; });
    if (!activeExif) { activateModule("exif"); } else { showView(activeExif.id); }
    els.dropzone.hidden = true;
    els.workspace.hidden = false;
    els.exportBar.hidden = false;

    els.previewImg.src = photo.preview;
    els.mName.textContent = photo.name;
    els.mSize.textContent = photo.width + " × " + photo.height;
    els.mBytes.textContent = formatBytes(photo.size);
    els.mTaken.textContent = formatTaken(photo.exif.taken_at);

    fillForm(photo.exif);
    renderFileName();
  }

  function fillForm(exif) {
    els.inTakenAt.value = exif.taken_at || "";
    els.inIso.value = exif.iso != null ? exif.iso : "";
    els.inEv.value = exif.ev != null ? exif.ev : "";
    els.inShutter.value = exif.shutter || "";
    els.inAperture.value = exif.aperture != null ? exif.aperture : "";
    els.inFocal35.value = exif.focal35 != null ? exif.focal35 : "";
    els.inMake.value = exif.make || "";
    els.inModel.value = exif.model || "";
    els.inSerial.value = exif.serial || "";
    els.inLat.value = exif.lat != null ? exif.lat.toFixed(6) : "";
    els.inLng.value = exif.lng != null ? exif.lng.toFixed(6) : "";
    els.inAlt.value = exif.altitude != null ? exif.altitude : "";

    setOrig("origTakenAt", exif.taken_at ? exif.taken_at.replace("T", " ") : "");
    setOrig("origIso", exif.iso != null ? exif.iso : "");
    setOrig("origEv", exif.ev != null ? exif.ev + " EV" : "");
    setOrig("origShutter", exif.shutter || "");
    setOrig("origAperture", exif.aperture != null ? "f/" + exif.aperture : "");
    setOrig("origFocal35", exif.focal35 != null ? exif.focal35 + "mm" : "");
    setOrig("origMake", exif.make || "");
    setOrig("origModel", exif.model || "");
    setOrig("origSerial", exif.serial || "");
  }

  function setOrig(id, txt) {
    var el = els[id];
    if (el) { el.textContent = txt; el.style.display = txt ? "" : "none"; }
  }

  /* ---------------- 收集导出字段 ---------------- */
  function collectFields() {
    var f = {};
    if (els.inTakenAt.value) f.taken_at = els.inTakenAt.value;
    if (els.inIso.value !== "") f.iso = parseInt(els.inIso.value, 10);
    if (els.inEv.value !== "") f.ev = parseFloat(els.inEv.value);
    if (els.inShutter.value.trim()) f.shutter = els.inShutter.value.trim();
    if (els.inAperture.value !== "") f.aperture = parseFloat(els.inAperture.value);
    if (els.inFocal35.value !== "") f.focal35 = parseInt(els.inFocal35.value, 10);
    if (els.inMake.value.trim()) f.make = els.inMake.value.trim();
    if (els.inModel.value.trim()) f.model = els.inModel.value.trim();
    if (els.inSerial.value.trim()) f.serial = els.inSerial.value.trim();
    if (state.selPos) {
      f.lat = state.selPos.lat;
      f.lng = state.selPos.lng;
      if (els.inAlt.value !== "") f.altitude = parseFloat(els.inAlt.value);
    } else if (els.inLat.value && els.inLng.value) {
      // 打开时已有位置的坐标保留
      f.lat = parseFloat(els.inLat.value);
      f.lng = parseFloat(els.inLng.value);
      if (els.inAlt.value !== "") f.altitude = parseFloat(els.inAlt.value);
    }
    return f;
  }

  /* ---------------- 导出文件名模板 ---------------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function baseName() {
    if (!state.photo) return "photo";
    return state.photo.name.replace(/\.jpe?g$/i, "");
  }

  function renderFileName() {
    var tpl = els.inFileName.value || "{name}_exif";
    var out = tpl
      .replace(/\{name\}/g, baseName())
      .replace(/\{date\}/g, formatDate(new Date()))
      .replace(/\{time\}/g, pad(new Date().getHours()) + pad(new Date().getMinutes()) + pad(new Date().getSeconds()))
      .replace(/\{now\}/g, nowStamp());
    if (!/\.jpe?g$/i.test(out)) out += ".jpg";
    els.expPreview.textContent = "导出为：" + out;
    return out;
  }

  function formatDate(d) {
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }
  function nowStamp() {
    var d = new Date();
    return formatDate(d) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }
  function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
    return (n / 1048576).toFixed(2) + " MB";
  }
  function formatTaken(t) {
    if (!t) return "—";
    return t.replace("T", " ");
  }

  /* ---------------- 导出 ---------------- */
  function doExport() {
    if (!state.photo) { toast("请先打开照片", "err"); return; }
    var fields = collectFields();
    if (Object.keys(fields).length === 0) { toast("请至少修改一项内容", "err"); return; }
    var defName = renderFileName();
    var api = getApi();
    if (!api) { toast("后端未就绪", "err"); return; }
    els.btnExport.disabled = true;
    api.export({ src: state.photo.path, fields: fields, default_name: defName })
      .then(function (res) {
        if (res.ok) { state.stats.exported += 1; toast("已导出：" + res.name, "ok"); }
        else if (!res.canceled) toast(res.error || "导出失败", "err");
      })
      .catch(function (e) { toast("导出异常：" + e, "err"); })
      .finally(function () { els.btnExport.disabled = false; });
  }

  /* ---------------- 地图 ---------------- */
  var map = null, marker = null;

  function openMap() {
    if (!state.photo) { toast("请先打开照片", "err"); return; }
    els.mapModal.hidden = false;
    if (!map) initMap();
    setTimeout(function () {
      if (state.selPos) {
        setMapPos(state.selPos.lat, state.selPos.lng, 15);
      } else if (state.orig && state.orig.lat != null && state.orig.lng != null) {
        setMapPos(state.orig.lat, state.orig.lng, 15);
      } else {
        map.setView([35.0, 105.0], 5);
      }
      map.invalidateSize();
    }, 60);
  }

  function initMap() {
    map = L.map("map", { zoomControl: true, attributionControl: true });
    // 高德公开瓦片（GCJ-02，免 Key）
    L.tileLayer("https://webrd{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}", {
      subdomains: ["01", "02", "03", "04"],
      maxZoom: 18,
      attribution: "&copy; 高德地图",
    }).addTo(map);

    var pinIcon = L.divIcon({
      className: "pin",
      html: '<svg viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">'
          + '<path d="M17 43C9.2 30.2 3 23.6 3 15.5A14 14 0 1 1 31 15.5C31 23.6 24.8 30.2 17 43Z" fill="#e8a33d" stroke="#ffffff" stroke-width="2.5"/>'
          + '<circle cx="17" cy="15.5" r="6.2" fill="#ffffff"/>'
          + '</svg>',
      iconSize: [34, 44],
      iconAnchor: [17, 41],   // 锚点对准底部尖端，点选位置即尖端落点
    });
    marker = L.marker([0, 0], { icon: pinIcon }).addTo(map);

    map.on("click", function (e) {
      var ll = e.latlng;
      selectPos(+ll.lat.toFixed(6), +ll.lng.toFixed(6));
    });
  }

  function selectPos(lat, lng) {
    state.selPos = { lat: lat, lng: lng };
    marker.setLatLng([lat, lng]);
    updateCoord();
  }

  function setMapPos(lat, lng, zoom) {
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], zoom || 15);
    updateCoord();
  }

  function updateCoord() {
    if (!state.selPos) { els.coordText.textContent = "点击地图选择位置"; els.btnConfirmMap.disabled = true; return; }
    els.coordText.innerHTML = "已选：<b>" + state.selPos.lat.toFixed(6) + "</b>, <b>" + state.selPos.lng.toFixed(6) + "</b>（GCJ-02）";
    els.btnConfirmMap.disabled = false;
  }

  function confirmPos() {
    if (!state.selPos) return;
    els.inLat.value = state.selPos.lat.toFixed(6);
    els.inLng.value = state.selPos.lng.toFixed(6);
    closeMap();
    toast("位置已更新（GCJ-02 火星坐标）", "ok");
  }

  function closeMap() {
    els.mapModal.hidden = true;
    els.resultList.hidden = true;
  }

  /* 搜索（Nominatim，WGS-84 -> GCJ-02） */
  var searchBusy = false;
  function doSearch() {
    var q = els.inSearch.value.trim();
    if (!q || searchBusy) return;
    searchBusy = true;
    els.btnSearch.disabled = true;
    var url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=zh-CN&q=" + encodeURIComponent(q);
    fetch(url, { headers: { "Accept-Language": "zh-CN,zh;q=0.9" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (list) { renderResults(list); })
      .catch(function () { toast("搜索失败，请检查网络连接", "err"); })
      .finally(function () { searchBusy = false; els.btnSearch.disabled = false; });
  }

  function renderResults(list) {
    els.resultList.innerHTML = "";
    els.resultList.hidden = list.length === 0;
    if (!list.length) { toast("未找到相关地点", "err"); return; }
    list.forEach(function (item) {
      var div = document.createElement("div");
      div.className = "result-item";
      div.textContent = item.display_name;
      div.addEventListener("click", function () {
        var a = getApi();
        if (!a) { toast("后端未就绪", "err"); return; }
        a.wgs84_to_gcj02(parseFloat(item.lat), parseFloat(item.lon)).then(function (c) {
          selectPos(c.lat, c.lng);
          map.setView([c.lat, c.lng], 15);
          els.resultList.hidden = true;
        });
      });
      els.resultList.appendChild(div);
    });
  }

  /* 定位当前设备位置 */
  function locateMe() {
    if (!navigator.geolocation) { toast("当前环境不支持定位", "err"); return; }
    els.btnLocate.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      var a = getApi();
      if (!a) return;
      a.wgs84_to_gcj02(pos.coords.latitude, pos.coords.longitude).then(function (c) {
        selectPos(c.lat, c.lng);
        map.setView([c.lat, c.lng], 15);
      });
    }, function () {
      toast("定位失败或未授权", "err");
    }, { enableHighAccuracy: false, timeout: 10000 });
    setTimeout(function () { els.btnLocate.disabled = false; }, 1200);
  }

  var RECOMMENDED_SITES = [
    { name: "天文通", description: "观星指数、光污染地图与天象规划工具。", url: "https://laysky.com/" },
    { name: "500px", description: "摄影师作品社区与灵感图库。", url: "https://500px.com.cn/" },
    { name: "堆糖", description: "图片灵感、视觉收藏与主题素材社区。", url: "https://www.duitang.com/" },
    { name: "蜂鸟网", description: "国内摄影交流、器材与作品社区。", url: "https://www.fengniao.com/" },
    { name: "色影无忌", description: "摄影器材、作品和摄影文化交流社区。", url: "https://www.xitek.com/" },
    { name: "图虫", description: "摄影师作品展示与视觉内容平台。", url: "https://tuchong.com/" },
    { name: "中国国家地理", description: "自然、人文与风光摄影灵感。", url: "https://www.dili360.com/" }
  ];
  var editingWebsiteId = null, recommendTimer = null;
  function startRecommendationScroll() { clearInterval(recommendTimer); recommendTimer = setInterval(function () { if (!els.recommendGrid.matches(":hover")) { var loopWidth = els.recommendGrid.scrollWidth / 2; els.recommendGrid.scrollLeft += 1; if (loopWidth > 0 && els.recommendGrid.scrollLeft >= loopWidth) els.recommendGrid.scrollLeft -= loopWidth; } }, 35); }
  function makeRecommendationItem(item) {
    var card = document.createElement("article"); card.className = "curated-item";
    var host = new URL(item.url).hostname;
    card.innerHTML = '<img class="curated-favicon" alt=""><span class="curated-name"></span><button class="curated-add">＋</button>';
    var icon = card.querySelector(".curated-favicon"); icon.src = item.url.replace(/\/$/, "") + "/favicon.ico"; icon.onerror = function () { icon.onerror = null; icon.src = "https://favicon.im/" + host + "?larger=true"; };
    card.querySelector(".curated-name").textContent = item.name;
    card.addEventListener("click", function (e) { if (!e.target.closest("button")) window.open(item.url, "_blank"); });
    card.querySelector(".curated-add").addEventListener("click", function (e) { e.stopPropagation(); var api = getApi(); api.save_website(item).then(function () { loadWebsites(); toast(item.name + "已添加", "ok"); }); });
    return card;
  }
  function makeRecommendationGroup() {
    var group = document.createElement("div"); group.className = "curated-group";
    var row1 = document.createElement("div"); row1.className = "curated-row";
    var row2 = document.createElement("div"); row2.className = "curated-row curated-row-offset";
    var half = Math.ceil(RECOMMENDED_SITES.length / 2);
    RECOMMENDED_SITES.slice(0, half).forEach(function (item) { row1.appendChild(makeRecommendationItem(item)); });
    RECOMMENDED_SITES.slice(half).forEach(function (item) { row2.appendChild(makeRecommendationItem(item)); });
    group.appendChild(row1); group.appendChild(row2); return group;
  }
  function renderRecommendations() {
    els.recommendGrid.innerHTML = "";
    els.recommendGrid.appendChild(makeRecommendationGroup());
    els.recommendGrid.appendChild(makeRecommendationGroup());
    startRecommendationScroll();
  }
  function loadWebsites() {
    renderRecommendations();
    var api = getApi();
    if (!api || !api.list_websites) return;
    api.list_websites().then(function (res) { renderWebsites(res.items || []); }).catch(function () { toast("网址读取失败", "err"); });
  }
  var selectedWebsiteIds = [];
  function renderWebsites(items) {
    els.websiteGrid.innerHTML = "";
    if (!items.length) { els.websiteGrid.innerHTML = '<div class="website-empty">还没有收藏网址，点击右上角添加一个吧。</div>'; return; }
    items.forEach(function (item) {
      var card = document.createElement("article"); card.className = "bookmark-card"; card.dataset.id = item.id;
      var host = ""; try { host = new URL(item.url).hostname; } catch (e) {}
      card.innerHTML = '<div class="bookmark-select">✓</div><img class="bookmark-favicon" alt=""><b class="bookmark-name"></b><p class="bookmark-desc"></p><div class="bookmark-actions"><button data-action="copy">复制</button><button data-action="edit">修改</button></div>';
      var siteIcon = card.querySelector(".bookmark-favicon"); siteIcon.src = item.url.replace(/\/$/, "") + "/favicon.ico"; siteIcon.onerror = function () { siteIcon.onerror = null; siteIcon.src = "https://favicon.im/" + host + "?larger=true"; };
      card.querySelector(".bookmark-name").textContent = item.name; card.querySelector(".bookmark-desc").textContent = item.description || "暂无简介";
      var pressTimer = null, longPressed = false;
      card.addEventListener("pointerdown", function () { longPressed = false; pressTimer = setTimeout(function () { longPressed = true; els.websitesPage.classList.add("selection-mode"); card.classList.add("selection-mode"); toggleWebsiteSelected(card, item.id); }, 550); });
      card.addEventListener("pointerup", function () { clearTimeout(pressTimer); });
      card.addEventListener("pointerleave", function () { clearTimeout(pressTimer); });
      card.addEventListener("click", function (e) { if (longPressed || e.target.closest("button") || e.target.closest(".bookmark-select")) { longPressed = false; return; } if (els.websitesPage.classList.contains("selection-mode")) { toggleWebsiteSelected(card, item.id); return; } window.open(item.url, "_blank"); });
      card.querySelector('[data-action="copy"]').addEventListener("click", function () { navigator.clipboard.writeText(item.url).then(function () { toast("网址已复制", "ok"); }); });
      card.querySelector('[data-action="edit"]').addEventListener("click", function () { openWebsiteDialog(item); });
      els.websiteGrid.appendChild(card);
    });
  }
  function toggleWebsiteSelected(card, id) { var i = selectedWebsiteIds.indexOf(id); if (i >= 0) selectedWebsiteIds.splice(i, 1); else selectedWebsiteIds.push(id); card.classList.toggle("selected", i < 0); }
  function selectAllWebsites() { els.websitesPage.classList.add("selection-mode"); document.querySelectorAll(".bookmark-card").forEach(function (card) { if (!selectedWebsiteIds.includes(card.dataset.id)) selectedWebsiteIds.push(card.dataset.id); card.classList.add("selection-mode", "selected"); }); }
  function cancelWebsiteSelection() { selectedWebsiteIds = []; els.websitesPage.classList.remove("selection-mode"); document.querySelectorAll(".bookmark-card").forEach(function (card) { card.classList.remove("selection-mode", "selected"); }); }
  function deleteSelectedWebsites() { if (!selectedWebsiteIds.length) { toast("请先长按选择网址", "err"); return; } var api = getApi(); Promise.all(selectedWebsiteIds.map(function (id) { return api.delete_website(id); })).then(function () { selectedWebsiteIds = []; loadWebsites(); toast("已删除选中网址", "ok"); }); }
  function openWebsiteDialog(item) { editingWebsiteId = item ? item.id : null; els.websiteDialogTitle.textContent = item ? "修改网址" : "添加网址"; els.websiteName.value = item ? item.name : ""; els.websiteDesc.value = item ? item.description : ""; els.websiteUrl.value = item ? item.url : ""; els.websiteModal.hidden = false; }
  function closeWebsiteDialog() { els.websiteModal.hidden = true; editingWebsiteId = null; }
  function saveWebsite() { var name = els.websiteName.value.trim(), url = els.websiteUrl.value.trim(); if (!name || !url) { toast("请填写名称和网址", "err"); return; } var api = getApi(); if (!api) return; api.save_website({ id: editingWebsiteId, name: name, description: els.websiteDesc.value.trim(), url: url }).then(function (res) { if (res.ok) { closeWebsiteDialog(); loadWebsites(); toast("网址已保存", "ok"); } else toast(res.error || "保存失败", "err"); }); }

  function setTheme(theme) {
    theme = theme === "light" ? "light" : "dark";
    document.body.dataset.theme = theme;
    document.querySelectorAll(".theme-choice").forEach(function (button) { button.classList.toggle("active", button.dataset.theme === theme); });
    var api = getApi();
    if (api && api.save_settings) api.save_settings({ theme: theme }).catch(function () { toast("主题保存失败", "err"); });
  }

  function startWindowResize(e) {
    e.preventDefault();
    var edge = e.currentTarget.dataset.edge, startX = e.screenX, startY = e.screenY, startW = window.outerWidth || 1200, startH = window.outerHeight || 800;
    var move = function (event) { var dx = event.screenX - startX, dy = event.screenY - startY; var w = startW + (edge.indexOf("e") >= 0 ? dx : edge.indexOf("w") >= 0 ? -dx : 0); var h = startH + (edge.indexOf("s") >= 0 ? dy : edge.indexOf("n") >= 0 ? -dy : 0); var api = getApi(); if (api && api.resize_window) api.resize_window(w, h); };
    var stop = function () { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); document.body.classList.remove("resizing-window"); };
    document.body.classList.add("resizing-window"); document.addEventListener("pointermove", move); document.addEventListener("pointerup", stop);
  }

  function startSidebarResize(e) {
    e.preventDefault();
    var move = function (event) { var width = Math.max(170, Math.min(360, event.clientX)); document.documentElement.style.setProperty("--sidebar-width", width + "px"); };
    var stop = function () { document.removeEventListener("pointermove", move); document.removeEventListener("pointerup", stop); document.body.classList.remove("resizing"); };
    document.body.classList.add("resizing");
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    document.querySelectorAll(".nav-item[data-module]").forEach(function (item) {
      item.addEventListener("click", function () {
        if (item.classList.contains("muted")) { toast("该模块即将推出", ""); return; }
        navigateModule(item.dataset.module);
      });
    });
    $("toolExif").addEventListener("click", openEditor);
    $("toolWebsites").addEventListener("click", function () { navigateModule("websites"); });
    document.querySelectorAll(".resize-handle").forEach(function (handle) { handle.addEventListener("pointerdown", startWindowResize); });
    els.btnNewTab.addEventListener("click", backToHome);
    els.btnWindowClose.addEventListener("click", function () { var api = getApi(); if (api && api.close_window) api.close_window(); });
    els.btnMinimize.addEventListener("click", function () { var api = getApi(); if (api && api.minimize_window) api.minimize_window(); });
    els.btnMaximize.addEventListener("click", function () { var api = getApi(); if (api && api.toggle_maximize) api.toggle_maximize(); });
    document.querySelectorAll(".theme-choice").forEach(function (button) { button.addEventListener("click", function () { setTheme(button.dataset.theme); }); });
    els.sidebarResizer.addEventListener("pointerdown", startSidebarResize);
    $("btnAddWebsite").addEventListener("click", function () { openWebsiteDialog(null); });
    $("btnCloseWebsite").addEventListener("click", closeWebsiteDialog);
    $("btnCancelWebsite").addEventListener("click", closeWebsiteDialog);
    $("btnSaveWebsite").addEventListener("click", saveWebsite);
    $("btnSelectAllSites").addEventListener("click", selectAllWebsites);
    $("btnCancelSelectSites").addEventListener("click", cancelWebsiteSelection);
    $("btnDeleteSites").addEventListener("click", deleteSelectedWebsites);
    $("btnOpenAbout").addEventListener("click", function () { activateModule("about"); });
    document.querySelector(".topbar").addEventListener("dblclick", function (e) { if (e.target.closest(".window-actions")) return; var api = getApi(); if (api && api.toggle_maximize) api.toggle_maximize(); });
    els.btnOpenTop.addEventListener("click", function () {
      var api = getApi();
      if (!api) { toast("后端未就绪", "err"); return; }
      api.choose_photo().then(function (r) { if (r.ok) applyPhoto(r); else if (!r.canceled) toast(r.error, "err"); });
    });
    els.btnChangePhoto.addEventListener("click", function () { els.btnOpenTop.click(); });

    // 点击上传区
    els.dropzone.addEventListener("click", function () { els.fileInput.click(); });
    els.fileInput.addEventListener("change", function () {
      var f = els.fileInput.files[0];
      if (f) readFileAsDataURL(f, function (dataUrl) { uploadAndOpen(dataUrl, f.name); });
      els.fileInput.value = "";
    });

    // 拖拽（空状态 + 工作区）
    var dzs = [els.dropzone, els.workspace];
    dzs.forEach(function (dz) {
      dz.addEventListener("dragover", function (e) {
        e.preventDefault();
        if (dz === els.dropzone) els.dropzone.classList.add("dragover");
      });
      dz.addEventListener("dragleave", function () { els.dropzone.classList.remove("dragover"); });
      dz.addEventListener("drop", function (e) {
        e.preventDefault();
        els.dropzone.classList.remove("dragover");
        var f = e.dataTransfer.files[0];
        if (f) readFileAsDataURL(f, function (dataUrl) { uploadAndOpen(dataUrl, f.name); });
      });
    });

    // 快门快捷值
    document.querySelectorAll(".chip").forEach(function (c) {
      c.addEventListener("click", function () { els.inShutter.value = c.dataset.v; });
    });

    // 位置
    els.btnPickPos.addEventListener("click", openMap);
    els.btnClearPos.addEventListener("click", function () {
      state.selPos = null;
      els.inLat.value = "";
      els.inLng.value = "";
      els.inAlt.value = "";
    });

    // 地图弹窗
    els.btnSearch.addEventListener("click", doSearch);
    els.inSearch.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });
    els.btnLocate.addEventListener("click", locateMe);
    els.btnConfirmMap.addEventListener("click", confirmPos);
    els.btnCancelMap.addEventListener("click", closeMap);
    els.btnCloseMap.addEventListener("click", closeMap);
    els.mapModal.addEventListener("click", function (e) { if (e.target === els.mapModal) closeMap(); });

    // 导出
    els.btnExport.addEventListener("click", doExport);
    els.inFileName.addEventListener("input", renderFileName);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    state.moduleCache["home-1"] = {};
    bindEvents();
    els.dashDate.textContent = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    showView("home-1");
    setTimeout(function () { var splash = $("splashScreen"); if (splash) splash.classList.add("hidden"); }, 3500);
    var api = getApi();
    if (api && api.get_settings) {
      api.get_settings().then(function (res) { setTheme(res && res.settings && res.settings.theme || "dark"); }).catch(function () { setTheme("dark"); });
    } else { setTheme("dark"); }
    if (api && api.get_app_info) {
      api.get_app_info().then(function (info) {
        if (info && info.version) { if ($("sideVersion")) $("sideVersion").textContent = "v" + info.version; if ($("aboutVersion")) $("aboutVersion").textContent = "v" + info.version; }
      }).catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
