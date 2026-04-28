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

  function applyBranding(config) {
    var branding = config.branding || {};
    if (branding.showHeader) {
      var header = createEl("div", { id: "q2ws-header" });
      header.innerHTML = "<strong>" + escapeHtml(branding.title || "WebGIS") + "</strong><span>" + escapeHtml(branding.subtitle || "") + "</span>";
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
    if (!config.legend || !config.legend.length) return;
    var legend = createEl("aside", { id: "q2ws-legend" });
    legend.innerHTML = "<h3>Legenda</h3>";
    config.legend.forEach(function (item) {
      if (item.visible === false) return;
      var row = createEl("div", { class: "q2ws-legend-row" });
      var swatch = createEl("span", { class: "q2ws-swatch" });
      swatch.style.background = item.fillColor || "transparent";
      swatch.style.borderColor = item.strokeColor || item.fillColor || "#333";
      row.appendChild(swatch);
      row.appendChild(createEl("span", {}, item.label));
      legend.appendChild(row);
    });
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
        applyBranding(config);
        applyLayerConfig(config);
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
  flex-direction: column;
  gap: 2px;
  padding: 12px 22px;
  font-family: Inter, Segoe UI, Arial, sans-serif;
  background: color-mix(in srgb, var(--q2ws-accent) 88%, #111 12%);
  color: white;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
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
  right: 14px;
  bottom: 52px;
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

#q2ws-legend h3 {
  margin: 0 0 10px;
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
