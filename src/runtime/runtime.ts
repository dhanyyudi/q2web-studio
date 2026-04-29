export const q2wsRuntime = String.raw`(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function createEl(tag, attrs, text) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    if (text) el.textContent = text;
    return el;
  }

  function styleFor(layerConfig, feature) {
    var style = layerConfig.style || {};
    var field = style.categoryField;
    var category = null;
    if (field && feature && feature.properties) {
      var value = String(feature.properties[field] || "");
      category = (style.categories || []).find(function (item) {
        return item.value === value && item.visible !== false;
      });
    }
    return {
      color: (category && category.strokeColor) || style.strokeColor || "#3388ff",
      fillColor: (category && category.fillColor) || style.fillColor || "#3388ff",
      fillOpacity: Number(style.fillOpacity == null ? 0.5 : style.fillOpacity),
      opacity: Number(style.strokeOpacity == null ? 1 : style.strokeOpacity),
      weight: Number(style.strokeWidth == null ? 2 : style.strokeWidth),
      dashArray: style.dashArray || null,
      radius: Number(style.pointRadius == null ? 6 : style.pointRadius)
    };
  }

  function applyLayerConfig(config) {
    (config.layers || []).forEach(function (layerConfig) {
      var layer = window[layerConfig.layerVariable];
      if (!layer) return;
      if (layer.setStyle) {
        layer.setStyle(function (feature) {
          return styleFor(layerConfig, feature);
        });
      }
      if (window.map) {
        if (layerConfig.visible === false && window.map.hasLayer(layer)) {
          window.map.removeLayer(layer);
        }
        if (layerConfig.visible !== false && !window.map.hasLayer(layer)) {
          window.map.addLayer(layer);
        }
      }
    });
  }

  function layerBounds(config) {
    if (!window.L || !window.map) return null;
    var bounds = null;
    (config.layers || []).forEach(function (layerConfig) {
      if (layerConfig.visible === false) return;
      var layer = window[layerConfig.layerVariable];
      if (!layer || !layer.getBounds) return;
      var layerBounds = layer.getBounds();
      if (!layerBounds || !layerBounds.isValid || !layerBounds.isValid()) return;
      bounds = bounds ? bounds.extend(layerBounds) : layerBounds;
    });
    return bounds;
  }

  function applyInitialView(config) {
    if (!window.map) return;
    var settings = config.mapSettings || {};
    var bounds = layerBounds(config);
    if (!bounds) return;
    if (settings.initialZoomMode === "fixed") {
      window.map.setView(bounds.getCenter(), Number(settings.initialZoom || 13));
      return;
    }
    window.map.fitBounds(bounds, { padding: [28, 28] });
  }

  function applyLayerToggle(config) {
    if (!window.map) return;
    var layers = (config.layers || []).filter(function (layerConfig) {
      return layerConfig.showInLayerControl !== false && window[layerConfig.layerVariable];
    });
    if (!layers.length) return;
    var originalControl = document.querySelector(".leaflet-control-layers");
    if (originalControl) {
      originalControl.style.display = "none";
    }
    var control = createEl("aside", { id: "q2ws-layer-control" });
    control.innerHTML = "<h3>Layers</h3>";
    layers.forEach(function (layerConfig) {
      var row = createEl("label", {});
      var input = createEl("input", { type: "checkbox" });
      input.checked = layerConfig.visible !== false;
      input.onchange = function () {
        var layer = window[layerConfig.layerVariable];
        if (!layer) return;
        if (input.checked) {
          window.map.addLayer(layer);
        } else {
          window.map.removeLayer(layer);
        }
      };
      row.appendChild(input);
      row.appendChild(createEl("span", {}, layerConfig.displayName || layerConfig.id));
      control.appendChild(row);
    });
    document.body.appendChild(control);
  }

  function applyBasemap(config) {
    if (!window.L || !window.map) return;
    var basemap = config.mapSettings && config.mapSettings.basemap;
    if (!basemap || basemap === "none") return;
    var url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    var attribution = "OpenStreetMap";
    if (basemap === "carto-voyager") {
      url = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
      attribution = "&copy; OpenStreetMap contributors &copy; CARTO";
    }
    if (basemap === "esri-imagery") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri";
    }
    window.L.tileLayer(url, { attribution: attribution }).addTo(window.map);
  }

  function applyBranding(config) {
    var branding = config.branding || {};
    if (branding.showHeader) {
      var header = createEl("div", { id: "q2ws-header" });
      header.className = "q2ws-logo-" + (branding.logoPlacement || "left");
      var logo = branding.logoPath && branding.logoPlacement !== "hidden"
        ? '<img src="' + escapeHtml(branding.logoPath) + '" alt="">'
        : "";
      header.innerHTML = logo + "<div><strong>" + escapeHtml(branding.title || "WebGIS") + "</strong><span>" + escapeHtml(branding.subtitle || "") + "</span></div>";
      document.body.insertBefore(header, document.body.firstChild);
    }
    if (branding.showFooter) {
      var footer = createEl("div", { id: "q2ws-footer" }, branding.footer || "");
      document.body.appendChild(footer);
    }
    if (branding.showWelcome) {
      var welcome = createEl("div", { id: "q2ws-welcome" });
      welcome.innerHTML = '<div><h2>' + escapeHtml(branding.title || "WebGIS") + '</h2><p>' + escapeHtml(branding.subtitle || "") + '</p><button type="button">Mulai Jelajah</button></div>';
      welcome.querySelector("button").onclick = function () {
        welcome.remove();
      };
      document.body.appendChild(welcome);
    }
  }

  function applyLegend(config) {
    var settings = config.legendSettings || {};
    if (settings.enabled === false) return;
    var groups = config.legendGroups && config.legendGroups.length
      ? config.legendGroups
      : [{ id: "all", label: "Layers", items: config.legend || [] }];
    if (!groups.length) return;
    var legend = createEl("aside", { id: "q2ws-legend" });
    legend.className = "q2ws-legend-" + (settings.position || "bottom-right");
    var button = createEl("button", { type: "button", class: "q2ws-legend-toggle", "aria-expanded": settings.collapsed ? "false" : "true" });
    button.appendChild(createEl("span", {}, settings.collapsed ? "+" : "-"));
    button.appendChild(createEl("strong", {}, "Legenda"));
    legend.appendChild(button);
    var content = createEl("div", { class: "q2ws-legend-content" });
    groups.forEach(function (group) {
      var visibleItems = (group.items || []).filter(function (item) { return item.visible !== false; });
      if (!visibleItems.length) return;
      var section = createEl("section", { class: "q2ws-legend-group" });
      if (settings.groupByLayer !== false) {
        section.appendChild(createEl("h4", {}, group.label || "Layer"));
      }
      visibleItems.forEach(function (item) {
        var row = createEl("div", { class: "q2ws-legend-row" });
        var swatch = createEl("span", { class: "q2ws-swatch q2ws-symbol-" + (item.symbolType || "polygon") });
        swatch.style.background = item.symbolType === "line" ? "transparent" : item.fillColor || "transparent";
        swatch.style.borderColor = item.strokeColor || item.fillColor || "#333";
        if (item.symbolType === "line") {
          swatch.style.borderTopWidth = Math.max(2, item.strokeWidth || 2) + "px";
        }
        if (item.dashArray) {
          swatch.style.borderStyle = "dashed";
        }
        row.appendChild(swatch);
        row.appendChild(createEl("span", {}, item.label));
        section.appendChild(row);
      });
      content.appendChild(section);
    });
    legend.appendChild(content);
    if (settings.collapsed) {
      legend.classList.add("q2ws-legend-collapsed");
      content.hidden = true;
    }
    button.onclick = function () {
      var collapsed = legend.classList.toggle("q2ws-legend-collapsed");
      content.hidden = collapsed;
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.firstChild.textContent = collapsed ? "+" : "-";
    };
    document.body.appendChild(legend);
  }

  function applyTextAnnotations(config) {
    if (!window.L || !window.map) return;
    (config.textAnnotations || []).forEach(function (feature) {
      if (!feature.geometry || feature.geometry.type !== "Point") return;
      var coords = feature.geometry.coordinates;
      var props = feature.properties || {};
      var icon = window.L.divIcon({
        className: "q2ws-text-label",
        html: '<span style="color:' + (props.color || "#172026") + ';font-size:' + (props.fontSize || 13) + 'px">' + escapeHtml(props.text || "") + "</span>"
      });
      window.L.marker([coords[1], coords[0]], { icon: icon }).addTo(window.map);
    });
  }

  function applyPopupStyle(config) {
    var popup = config.popupSettings || {};
    var accent = popup.accentColor || "#156f7a";
    var background = popup.backgroundColor || "#ffffff";
    var text = popup.textColor || "#172026";
    var label = popup.labelColor || "#4b5b66";
    var radius = Number(popup.radius == null ? 10 : popup.radius);
    var shadow = Number(popup.shadow == null ? 22 : popup.shadow);
    var style = popup.style || "card";
    var border = style === "minimal" ? "0" : "1px solid " + accent;
    var padding = style === "compact" ? "5px 7px" : "7px 9px";
    var css = [
      ".leaflet-popup-content-wrapper{border:" + border + ";border-radius:" + radius + "px;background:" + background + ";color:" + text + ";box-shadow:0 " + Math.max(6, shadow / 2) + "px " + Math.max(14, shadow) + "px rgba(0,0,0,.22);}",
      ".leaflet-popup-tip{background:" + background + ";box-shadow:0 8px 18px rgba(0,0,0,.16);}",
      ".studio-popup{border-collapse:collapse;min-width:210px;max-width:340px;font:12px Inter,Segoe UI,Arial,sans-serif;}",
      ".studio-popup th,.studio-popup td{border:1px solid rgba(82,103,113,.18);padding:" + padding + ";vertical-align:top;}",
      ".studio-popup th{width:42%;background:" + rgbaFromHex(accent, style === "compact" ? 0 : 0.09) + ";color:" + label + ";font-weight:750;text-align:left;}",
      ".studio-popup strong{color:" + accent + ";}"
    ].join("");
    var styleEl = createEl("style", { id: "q2ws-popup-style" }, css);
    document.head.appendChild(styleEl);
  }

  function rgbaFromHex(hex, opacity) {
    var value = String(hex || "").replace("#", "");
    if (value.length === 3) {
      value = value.split("").map(function (char) { return char + char; }).join("");
    }
    if (value.length !== 6) return "transparent";
    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    if ([r, g, b].some(function (channel) { return Number.isNaN(channel); })) return "transparent";
    return "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  ready(function () {
    fetch("q2ws-config.json")
      .then(function (response) { return response.json(); })
      .then(function (config) {
        document.documentElement.style.setProperty("--q2ws-accent", config.theme.accent);
        document.documentElement.style.setProperty("--q2ws-surface", config.theme.surface);
        document.documentElement.style.setProperty("--q2ws-text", config.theme.text);
        document.documentElement.style.setProperty("--q2ws-radius", config.theme.radius + "px");
        document.documentElement.style.setProperty("--q2ws-header-height", (config.theme.headerHeight || 48) + "px");
        applyBasemap(config);
        applyBranding(config);
        applyLayerConfig(config);
        applyInitialView(config);
        applyLayerToggle(config);
        applyPopupStyle(config);
        applyLegend(config);
        applyTextAnnotations(config);
      })
      .catch(function (error) {
        console.warn("qgis2web Studio runtime failed", error);
      });
  });
})();`;

export const q2wsCss = String.raw`:root {
  --q2ws-accent: #156f7a;
  --q2ws-surface: #ffffff;
  --q2ws-text: #172026;
  --q2ws-radius: 8px;
  --q2ws-header-height: 48px;
}

html, body {
  width: 100%;
  height: 100%;
  margin: 0;
}

#map {
  width: 100% !important;
  height: 100vh !important;
}

#q2ws-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: var(--q2ws-header-height);
  padding: 12px 22px;
  font-family: Inter, Segoe UI, Arial, sans-serif;
  background: color-mix(in srgb, var(--q2ws-accent) 88%, #111 12%);
  color: white;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
}

#q2ws-header.q2ws-logo-center {
  justify-content: center;
  text-align: center;
}

#q2ws-header.q2ws-logo-right {
  flex-direction: row-reverse;
  text-align: right;
}

#q2ws-header img {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 6px;
  background: rgba(255,255,255,0.16);
}

#q2ws-header div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

#q2ws-header span {
  font-size: 12px;
  opacity: 0.86;
}

#q2ws-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1200;
  padding: 8px 20px;
  font: 12px Inter, Segoe UI, Arial, sans-serif;
  text-align: center;
  color: rgba(255,255,255,0.86);
  background: color-mix(in srgb, var(--q2ws-accent) 78%, #111 22%);
}

#q2ws-legend {
  position: fixed;
  z-index: 1100;
  min-width: 190px;
  max-width: 280px;
  padding: 14px;
  border-radius: var(--q2ws-radius);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
  font: 13px Inter, Segoe UI, Arial, sans-serif;
  color: var(--q2ws-text);
}

#q2ws-legend.q2ws-legend-bottom-right {
  right: 58px;
  bottom: 52px;
}

#q2ws-legend.q2ws-legend-bottom-left {
  left: 14px;
  bottom: 52px;
}

#q2ws-legend.q2ws-legend-top-right {
  top: 76px;
  right: 248px;
}

#q2ws-legend.q2ws-legend-top-left {
  top: 76px;
  left: 14px;
}

#q2ws-layer-control {
  position: fixed;
  top: 76px;
  right: 14px;
  z-index: 1110;
  width: 220px;
  max-height: 42vh;
  overflow: auto;
  padding: 13px;
  border-radius: var(--q2ws-radius);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
  font: 13px Inter, Segoe UI, Arial, sans-serif;
  color: var(--q2ws-text);
}

#q2ws-layer-control h3 {
  margin: 0 0 9px;
  font-size: 13px;
}

#q2ws-layer-control label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  cursor: pointer;
}

#q2ws-layer-control span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#q2ws-legend.q2ws-legend-collapsed {
  min-width: 0;
  width: auto;
}

.q2ws-legend-toggle {
  width: 100%;
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--q2ws-text);
  cursor: pointer;
  font: 800 13px Inter, Segoe UI, Arial, sans-serif;
  text-align: left;
}

.q2ws-legend-content {
  display: grid;
  gap: 10px;
  margin-top: 8px;
}

.q2ws-legend-group h4 {
  margin: 0 0 6px;
  color: #4f606a;
  font-size: 13px;
}

.q2ws-legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}

.q2ws-swatch {
  width: 22px;
  height: 12px;
  border: 2px solid;
  border-radius: 3px;
  flex: 0 0 auto;
}

.q2ws-symbol-line {
  height: 0;
  border-left: 0;
  border-right: 0;
  border-bottom: 0;
  border-radius: 0;
}

#q2ws-welcome {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  background: rgba(5, 12, 18, 0.58);
}

#q2ws-welcome > div {
  width: min(460px, calc(100vw - 40px));
  padding: 28px;
  border-radius: 14px;
  background: white;
  font-family: Inter, Segoe UI, Arial, sans-serif;
}

#q2ws-welcome button {
  border: 0;
  border-radius: 8px;
  padding: 10px 16px;
  background: var(--q2ws-accent);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.q2ws-text-label span {
  padding: 3px 6px;
  border-radius: 5px;
  background: rgba(255,255,255,0.86);
  box-shadow: 0 4px 14px rgba(0,0,0,0.16);
  white-space: nowrap;
}`;
