export const q2wsRuntime = String.raw`(function () {
  // Runtime overlays configuration onto the original qgis2web export.
  // It intentionally depends on globals created by the preserved index.html,
  // especially window.map and window.layer_* variables.
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
      applyLayerPopupAndLabels(layer, layerConfig);
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

  function applyLayerPopupAndLabels(layer, layerConfig) {
    if (!layer || !layer.eachLayer) return;
    layer.eachLayer(function (featureLayer) {
      var feature = featureLayer.feature;
      if (!feature) return;
      if (featureLayer.unbindPopup && layerConfig.popupTemplate) {
        featureLayer.unbindPopup();
        if (layerConfig.popupEnabled !== false) {
          featureLayer.bindPopup(renderPopup(layerConfig, feature), layerConfig.popupSettings ? { className: "popup-layer-" + layerConfig.id } : {});
        }
      }
      if (featureLayer.unbindTooltip && layerConfig.label) {
        featureLayer.unbindTooltip();
        if (layerConfig.label.enabled && layerConfig.label.field) {
          var labelValue = feature.properties && feature.properties[layerConfig.label.field];
          if (labelValue != null && labelValue !== "") {
            featureLayer.bindTooltip(renderLabel(layerConfig, feature), {
              permanent: Boolean(layerConfig.label.permanent),
              offset: window.L.point(layerConfig.label.offset || [0, 0]),
              className: "q2ws-label " + (layerConfig.label.className || "")
            });
          }
        }
      }
    });
  }

  function renderLabel(layerConfig, feature) {
    var label = layerConfig.label || {};
    if (label.htmlTemplate) {
      return sanitizeLabelHtml(String(label.htmlTemplate || "").replace(/\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g, function (_match, key) {
        return escapeHtml(feature.properties && feature.properties[key]);
      }));
    }
    var labelValue = feature.properties && feature.properties[label.field];
    return escapeHtml(labelValue);
  }

  function renderPopup(layerConfig, feature) {
    var template = layerConfig.popupTemplate;
    if (template && (template.mode === "original" || template.mode === "custom")) {
      return sanitizePopupHtml(String(template.html || "").replace(/\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g, function (_match, key) {
        return escapeHtml(feature.properties && feature.properties[key]);
      }));
    }
    var rows = (layerConfig.popupFields || []).filter(function (field) { return field.visible; }).map(function (field) {
      var value = escapeHtml(feature.properties && feature.properties[field.key]);
      return field.header
        ? '<tr><td colspan="2"><strong>' + escapeHtml(field.label) + '</strong><br>' + value + '</td></tr>'
        : '<tr><th>' + escapeHtml(field.label) + '</th><td>' + value + '</td></tr>';
    }).join("");
    return '<table class="studio-popup">' + rows + '</table>';
  }

  function sanitizeLabelHtml(html) {
    var template = document.createElement("template");
    template.innerHTML = html;
    var allowedTags = ["DIV", "SPAN", "B", "I", "EM", "STRONG", "BR"];
    var allowedAttrs = ["class", "style"];
    template.content.querySelectorAll("*").forEach(function (element) {
      if (allowedTags.indexOf(element.tagName) === -1) {
        element.replaceWith(document.createTextNode(element.textContent || ""));
        return;
      }
      Array.from(element.attributes).forEach(function (attr) {
        if (allowedAttrs.indexOf(attr.name.toLowerCase()) === -1) element.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
  }

  function sanitizePopupHtml(html) {
    var template = document.createElement("template");
    template.innerHTML = html;
    var allowedTags = ["TABLE", "TBODY", "THEAD", "TR", "TH", "TD", "STRONG", "BR", "SPAN", "DIV", "P", "B", "I", "EM"];
    var allowedAttrs = ["class", "id", "scope", "colspan", "rowspan"];
    template.content.querySelectorAll("*").forEach(function (element) {
      if (allowedTags.indexOf(element.tagName) === -1) {
        element.replaceWith(document.createTextNode(element.textContent || ""));
        return;
      }
      Array.from(element.attributes).forEach(function (attr) {
        if (allowedAttrs.indexOf(attr.name.toLowerCase()) === -1) element.removeAttribute(attr.name);
      });
    });
    return template.innerHTML;
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
    var settings = config.mapSettings || {};
    var mode = settings.layerControlMode || "original";
    if (mode === "original") return;
    var layers = (config.layers || []).filter(function (layerConfig) {
      return layerConfig.showInLayerControl !== false && window[layerConfig.layerVariable];
    });
    if (!layers.length) return;
    var originalControl = document.querySelector(".leaflet-control-layers");
    if (originalControl) {
      originalControl.style.display = "none";
    }
    var control = createEl("aside", { id: "q2ws-layer-control", class: "q2ws-layer-control-" + mode });
    var header = createEl("button", { type: "button", class: "q2ws-layer-control-header", "aria-expanded": mode === "compact" ? "false" : "true" });
    header.appendChild(createEl("strong", {}, "Layers"));
    control.appendChild(header);
    var content = createEl("div", { class: "q2ws-layer-control-content" });
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
      content.appendChild(row);
    });
    if (mode === "tree") {
      content.classList.add("q2ws-layer-control-tree");
    }
    var legendSection = buildLegendSection(config);
    if (legendSection && (config.legendSettings || {}).placement === "inside-control") {
      content.appendChild(legendSection);
    }
    if (mode === "compact") {
      content.hidden = true;
      header.onclick = function () {
        content.hidden = !content.hidden;
        header.setAttribute("aria-expanded", content.hidden ? "false" : "true");
      };
    }
    control.appendChild(content);
    document.body.appendChild(control);
  }

  function applyBasemap(config) {
    if (!window.L || !window.map) return;
    var selected = config.mapSettings && config.mapSettings.basemap;
    if (!selected || selected === "none") return;
    var basemaps = (config.basemaps || []).filter(function (item) { return item.enabled !== false; });
    var basemap = basemaps.find(function (item) { return item.id === selected; }) || basemaps.find(function (item) { return item.default; }) || basemaps[0];
    if (!basemap || !basemap.url) return;
    window.map.eachLayer(function (layer) {
      if (layer && layer._url && layer._url === basemap.url) return;
      if (layer && layer._url && !layer.feature) window.map.removeLayer(layer);
    });
    window.L.tileLayer(basemap.url, { attribution: basemap.attribution || "", maxZoom: basemap.maxZoom || 20 }).addTo(window.map);
  }

  function applyDisabledWidgets(config) {
    var widgets = (config.runtime && config.runtime.widgets) || [];
    widgets.forEach(function (widget) {
      if (widget.enabled !== false) return;
      if (widget.id === "measure") {
        removeControlCandidate(window.measureControl);
        removeElements(".leaflet-control-measure, .leaflet-measure-resultpopup");
        return;
      }
      if (widget.id === "photon") {
        removeControlCandidate(window.photonControl);
        removeElements(".leaflet-control-photon, .leaflet-photon, .photon-autocomplete");
        return;
      }
      if (widget.id === "layersTree") {
        removeElements(".leaflet-control-layers");
        return;
      }
      if (widget.id === "scale") {
        removeElements(".leaflet-control-scale");
        return;
      }
      if (widget.id === "fullscreen") {
        removeElements(".leaflet-control-fullscreen");
        return;
      }
      if (widget.id === "hash") {
        removeHashControl();
        return;
      }
      if (widget.id === "labels") {
        disableLabels(config);
        return;
      }
      if (widget.id === "highlight") {
        clearHighlightState(config);
        return;
      }
      if (widget.id === "pattern" || widget.id === "rotatedMarker") {
        return;
      }
      console.warn("qgis2web Studio cannot disable this preserved widget automatically:", widget.id);
    });
  }

  function removeControlCandidate(control) {
    if (!control) return;
    try {
      if (window.map && window.map.removeControl && control.remove) {
        control.remove();
        return;
      }
      if (window.map && window.map.removeControl) {
        window.map.removeControl(control);
      }
    } catch (error) {
      console.warn("qgis2web Studio failed to remove widget control", error);
    }
  }

  function removeElements(selector) {
    document.querySelectorAll(selector).forEach(function (element) {
      element.remove();
    });
  }

  function removeHashControl() {
    var hashControl = window.hash;
    if (hashControl && typeof hashControl.remove === "function") {
      hashControl.remove();
    }
    if (window.history && window.location.hash) {
      window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
    }
  }

  function disableLabels(config) {
    removeElements(".q2ws-label, .leaflet-tooltip");
    (config.layers || []).forEach(function (layerConfig) {
      var layer = window[layerConfig.layerVariable];
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer(function (featureLayer) {
        if (featureLayer.unbindTooltip) featureLayer.unbindTooltip();
      });
    });
  }

  function clearHighlightState(config) {
    if (!window.L) return;
    (config.layers || []).forEach(function (layerConfig) {
      var layer = window[layerConfig.layerVariable];
      if (!layer || !layer.eachLayer) return;
      layer.eachLayer(function (featureLayer) {
        if (featureLayer.setStyle && featureLayer.feature) {
          featureLayer.setStyle(styleFor(layerConfig, featureLayer.feature));
        }
      });
    });
  }

  function applySidebar(config) {
    var sidebar = config.sidebar || {};
    if (!sidebar.enabled) return;
    document.body.classList.add("q2ws-has-sidebar", "q2ws-has-sidebar-" + (sidebar.side || "right"));
    var panel = createEl("aside", { id: "q2ws-sidebar", class: "q2ws-sidebar-" + (sidebar.side || "right") });
    panel.style.width = Math.max(260, Math.min(520, Number(sidebar.width || 360))) + "px";
    panel.innerHTML = renderMarkdown(sidebar.content || "");
    document.body.appendChild(panel);
  }

  function renderMarkdown(markdown) {
    var lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    var html = [];
    var listType = "";
    var paragraph = [];
    function flushParagraph() {
      if (paragraph.length) {
        html.push("<p>" + inlineMarkdown(paragraph.join(" ")) + "</p>");
        paragraph = [];
      }
    }
    function closeList() {
      if (listType) {
        html.push("</" + listType + ">");
        listType = "";
      }
    }
    function openList(type) {
      if (listType === type) return;
      closeList();
      html.push("<" + type + ">");
      listType = type;
    }
    lines.forEach(function (line) {
      var trimmed = line.trim();
      if (!trimmed) {
        flushParagraph();
        closeList();
        return;
      }
      var heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        html.push("<h" + heading[1].length + ">" + inlineMarkdown(heading[2]) + "</h" + heading[1].length + ">");
        return;
      }
      var blockquote = trimmed.match(/^>\s+(.+)$/);
      if (blockquote) {
        flushParagraph();
        closeList();
        html.push("<blockquote>" + inlineMarkdown(blockquote[1]) + "</blockquote>");
        return;
      }
      var unorderedListItem = trimmed.match(/^(?:[-*])\s+(.+)$/);
      if (unorderedListItem) {
        flushParagraph();
        openList("ul");
        html.push("<li>" + inlineMarkdown(unorderedListItem[1]) + "</li>");
        return;
      }
      var orderedListItem = trimmed.match(/^\d+\.\s+(.+)$/);
      if (orderedListItem) {
        flushParagraph();
        openList("ol");
        html.push("<li>" + inlineMarkdown(orderedListItem[1]) + "</li>");
        return;
      }
      paragraph.push(trimmed);
    });
    flushParagraph();
    closeList();
    return html.join("");
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\x60([^\x60]+)\x60/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  function applyBranding(config) {
    var branding = config.branding || {};
    if (branding.showHeader && branding.headerPlacement !== "hidden") {
      document.body.classList.add("q2ws-has-header", "q2ws-has-header-" + (branding.headerPlacement || "top-full"));
      var header = createEl("div", { id: "q2ws-header" });
      header.className = "q2ws-header-" + (branding.headerPlacement || "top-full") + " q2ws-logo-" + (branding.logoPlacement || "left");
      var logo = branding.logoPath && branding.logoPlacement !== "hidden"
        ? '<img src="' + escapeHtml(branding.logoPath) + '" alt="">'
        : "";
      header.innerHTML = logo + "<div><strong>" + escapeHtml(branding.title || "WebGIS") + "</strong><span>" + escapeHtml(branding.subtitle || "") + "</span></div>";
      document.body.insertBefore(header, document.body.firstChild);
    }
    if (branding.showFooter && branding.footerPlacement !== "hidden") {
      var footer = createEl("div", { id: "q2ws-footer", class: "q2ws-footer-" + (branding.footerPlacement || "bottom-full") }, branding.footer || "");
      document.body.appendChild(footer);
    }
    var welcomeConfig = branding.welcome || {};
    if ((branding.showWelcome || welcomeConfig.enabled) && welcomeConfig.enabled !== false) {
      var storageKey = "q2ws-welcome-seen-" + (branding.title || "map");
      if (welcomeConfig.showOnce && localStorage.getItem(storageKey)) return;
      var welcome = createEl("div", { id: "q2ws-welcome", class: "q2ws-welcome-" + (welcomeConfig.placement || "center") });
      welcome.innerHTML = '<div><h2>' + escapeHtml(welcomeConfig.title || branding.title || "WebGIS") + '</h2><div class="q2ws-welcome-content">' + renderMarkdown(welcomeConfig.subtitle || branding.subtitle || "") + '</div><button type="button">' + escapeHtml(welcomeConfig.ctaLabel || "Mulai jelajah") + '</button></div>';
      var dismiss = function () {
        if (welcomeConfig.showOnce) localStorage.setItem(storageKey, "1");
        welcome.remove();
      };
      welcome.querySelector("button").onclick = dismiss;
      document.body.appendChild(welcome);
      if (welcomeConfig.autoDismiss && welcomeConfig.autoDismiss !== "never") {
        setTimeout(dismiss, Number(welcomeConfig.autoDismiss) * 1000);
      }
    }
  }

  function buildLegendSection(config) {
    var settings = config.legendSettings || {};
    if (settings.enabled === false || settings.placement === "hidden") return null;
    var groups = config.legendGroups && config.legendGroups.length
      ? config.legendGroups
      : [{ id: "all", label: "Layers", items: config.legend || [] }];
    if (!groups.length) return null;
    var legend = createEl("aside", { class: "q2ws-legend-section" });
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
    return legend;
  }

  function applyLegend(config) {
    var settings = config.legendSettings || {};
    if (!settings.placement || settings.placement === "inside-control" || settings.placement === "hidden") return;
    var legend = buildLegendSection(config);
    if (!legend) return;
    legend.id = "q2ws-legend";
    legend.classList.add("q2ws-legend-" + settings.placement.replace("floating-", ""));
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

  function applyLabelCss(config) {
    var css = (config.layers || []).map(function (layerConfig) {
      var label = layerConfig.label || {};
      if (!label.className || !label.cssText) return "";
      return "." + label.className + " { " + label.cssText + " }";
    }).filter(Boolean).join("\n");
    if (!css) return;
    var style = document.getElementById("q2ws-label-css");
    if (!style) {
      style = createEl("style", { id: "q2ws-label-css" });
      document.head.appendChild(style);
    }
    style.textContent = css;
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
      ".leaflet-popup-content{max-width:min(360px,72vw);margin:12px 14px;overflow-wrap:anywhere;line-height:1.42;}",
      ".studio-popup{width:100%;min-width:220px;max-width:340px;table-layout:fixed;border-collapse:separate;border-spacing:0;font:12px Inter,Segoe UI,Arial,sans-serif;}",
      ".studio-popup th,.studio-popup td{border:1px solid rgba(82,103,113,.14);padding:" + padding + ";vertical-align:top;white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.36;}",
      ".studio-popup th{width:38%;background:" + rgbaFromHex(accent, style === "compact" ? 0 : 0.09) + ";color:" + label + ";font-weight:750;text-align:left;}",
      ".studio-popup strong{color:" + accent + ";}"
    ].join("");
    var styleEl = createEl("style", { id: "q2ws-popup-style" }, css);
    document.head.appendChild(styleEl);
    (config.layers || []).forEach(function (layerConfig) {
      if (!layerConfig.popupSettings) return;
      var override = layerConfig.popupSettings;
      var layerCss = ".popup-layer-" + layerConfig.id + " .leaflet-popup-content-wrapper{border-color:" + (override.accentColor || accent) + ";border-radius:" + (override.radius || radius) + "px;background:" + (override.backgroundColor || background) + ";color:" + (override.textColor || text) + ";}" +
        ".popup-layer-" + layerConfig.id + " .leaflet-popup-tip{background:" + (override.backgroundColor || background) + ";}" +
        ".popup-layer-" + layerConfig.id + " .studio-popup th{color:" + (override.labelColor || label) + ";}" +
        ".popup-layer-" + layerConfig.id + " .studio-popup strong{color:" + (override.accentColor || accent) + ";}";
      document.head.appendChild(createEl("style", {}, layerCss));
    });
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

  function showRuntimeError(error) {
    var message = error && error.message ? error.message : "Unknown runtime error.";
    var panel = createEl("div", { id: "q2ws-runtime-error", role: "alert" });
    panel.innerHTML = "<strong>Studio runtime failed to initialize.</strong><span>Check q2ws-config.json and the browser console.</span><code>" + escapeHtml(message) + "</code>";
    document.body.appendChild(panel);
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
        applySidebar(config);
        applyLabelCss(config);
        applyLayerConfig(config);
        applyInitialView(config);
        applyLayerToggle(config);
        applyDisabledWidgets(config);
        applyPopupStyle(config);
        applyLegend(config);
        applyTextAnnotations(config);
      })
      .catch(function (error) {
        console.warn("qgis2web Studio runtime failed", error);
        showRuntimeError(error);
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

body.q2ws-has-header .leaflet-top {
  top: calc(var(--q2ws-header-height) + 32px);
}

body.q2ws-has-header-top-left-pill .leaflet-top.leaflet-left,
body.q2ws-has-header-top-center-card .leaflet-top.leaflet-left,
body.q2ws-has-header-top-right-pill .leaflet-top.leaflet-right {
  top: calc(var(--q2ws-header-height) + 40px);
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

#q2ws-header.q2ws-header-top-left-pill,
#q2ws-header.q2ws-header-top-right-pill,
#q2ws-header.q2ws-header-top-center-card {
  right: auto;
  left: auto;
  min-width: 280px;
  max-width: min(520px, calc(100vw - 28px));
  margin: 12px;
  border-radius: calc(var(--q2ws-radius) + 8px);
}

#q2ws-header.q2ws-header-top-left-pill {
  left: 0;
}

#q2ws-header.q2ws-header-top-right-pill {
  right: 0;
}

#q2ws-header.q2ws-header-top-center-card {
  left: 50%;
  transform: translateX(-50%);
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

.q2ws-label {
  padding: 2px 5px;
  border: 0;
  background: transparent;
  color: var(--q2ws-text);
  font-weight: 700;
  text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
}

#q2ws-sidebar {
  position: fixed;
  top: calc(var(--q2ws-header-height) + 32px);
  bottom: 56px;
  z-index: 1090;
  overflow: auto;
  padding: 16px;
  border-radius: var(--q2ws-radius);
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.22);
  font: 13px Inter, Segoe UI, Arial, sans-serif;
  line-height: 1.55;
  color: var(--q2ws-text);
}

#q2ws-sidebar.q2ws-sidebar-left {
  left: 14px;
}

#q2ws-sidebar.q2ws-sidebar-right {
  right: 14px;
}

#q2ws-sidebar h1,
#q2ws-sidebar h2,
#q2ws-sidebar h3 {
  margin: 0 0 10px;
  color: var(--q2ws-accent);
}

#q2ws-sidebar p,
#q2ws-sidebar ul,
#q2ws-sidebar ol,
#q2ws-sidebar blockquote {
  margin: 0 0 12px;
}

#q2ws-sidebar ul,
#q2ws-sidebar ol {
  padding-left: 20px;
}

#q2ws-sidebar blockquote {
  padding-left: 12px;
  border-left: 3px solid color-mix(in srgb, var(--q2ws-accent) 42%, white 58%);
  color: color-mix(in srgb, var(--q2ws-text) 82%, white 18%);
}

#q2ws-sidebar a {
  color: var(--q2ws-accent);
}

#q2ws-sidebar code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
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

#q2ws-footer.q2ws-footer-bottom-left-pill,
#q2ws-footer.q2ws-footer-bottom-right-pill {
  right: auto;
  left: auto;
  bottom: 14px;
  max-width: min(520px, calc(100vw - 28px));
  margin: 0 14px;
  border-radius: 999px;
}

#q2ws-footer.q2ws-footer-bottom-left-pill {
  left: 0;
}

#q2ws-footer.q2ws-footer-bottom-right-pill {
  right: 0;
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

body.q2ws-has-header-top-full #q2ws-legend.q2ws-legend-top-left,
body.q2ws-has-header-top-full #q2ws-legend.q2ws-legend-top-right,
body.q2ws-has-header-top-full #q2ws-layer-control {
  top: 96px;
}

body.q2ws-has-header-top-left-pill #q2ws-legend.q2ws-legend-top-left,
body.q2ws-has-header-top-center-card #q2ws-legend.q2ws-legend-top-left,
body.q2ws-has-header-top-right-pill #q2ws-legend.q2ws-legend-top-right,
body.q2ws-has-header-top-left-pill #q2ws-layer-control,
body.q2ws-has-header-top-center-card #q2ws-layer-control,
body.q2ws-has-header-top-right-pill #q2ws-layer-control {
  top: 92px;
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

#q2ws-layer-control.q2ws-layer-control-compact {
  width: auto;
  min-width: 150px;
}

.q2ws-layer-control-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
  border: 0;
  background: transparent;
  color: var(--q2ws-text);
  cursor: pointer;
  text-align: left;
}

.q2ws-layer-control-content {
  display: grid;
  gap: 3px;
  margin-top: 8px;
}

.q2ws-layer-control-tree label {
  padding-left: 10px;
  border-left: 2px solid rgba(21, 111, 122, 0.18);
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

#q2ws-runtime-error {
  position: fixed;
  left: 50%;
  top: 18px;
  z-index: 2000;
  display: grid;
  gap: 5px;
  max-width: min(520px, calc(100vw - 28px));
  padding: 14px 16px;
  transform: translateX(-50%);
  border: 1px solid #f0c36b;
  border-radius: var(--q2ws-radius);
  background: #fff8e8;
  color: #503706;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.2);
  font: 13px Inter, Segoe UI, Arial, sans-serif;
}

#q2ws-runtime-error code {
  overflow: auto;
  max-width: 100%;
  font-size: 12px;
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

#q2ws-welcome.q2ws-welcome-bottom {
  align-items: end;
  place-items: end center;
  padding: 20px;
}

#q2ws-welcome > div {
  width: min(520px, calc(100vw - 24px));
  padding: 24px;
  border-radius: calc(var(--q2ws-radius) + 6px);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 24px 48px rgba(0,0,0,0.28);
}

.q2ws-welcome-content {
  color: var(--q2ws-text);
  line-height: 1.55;
}

.q2ws-welcome-content :is(p, ul, ol, blockquote) {
  margin: 0 0 12px;
}

.q2ws-welcome-content ul,
.q2ws-welcome-content ol {
  padding-left: 20px;
}

.q2ws-welcome-content blockquote {
  padding-left: 12px;
  border-left: 3px solid color-mix(in srgb, var(--q2ws-accent) 42%, white 58%);
  color: color-mix(in srgb, var(--q2ws-text) 82%, white 18%);
}

.q2ws-welcome-content a {
  color: var(--q2ws-accent);
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
