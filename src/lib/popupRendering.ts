import type { Feature } from "geojson";
import type { LayerManifest, PopupField, PopupSettings, PopupTemplate } from "../types/project";

const popupTokenPattern = /\{\{\s*([A-Za-z0-9_:-]+)\s*\}\}/g;

export function popupStyleClass(style: PopupSettings["style"]): string {
  if (style === "compact") return "q2ws-popup-compact";
  if (style === "minimal") return "q2ws-popup-minimal";
  if (style === "original") return "q2ws-popup-original";
  return "q2ws-popup-card";
}

export function popupTitleForFeature(layer: LayerManifest, feature: Feature): string {
  const properties = (feature.properties || {}) as Record<string, unknown>;
  const headerField = layer.popupFields.find((field) => field.header && field.visible);
  if (headerField) {
    const value = properties[headerField.key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  const labelField = layer.label?.field;
  if (labelField) {
    const value = properties[labelField];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return layer.displayName;
}

export function visiblePopupRows(fields: PopupField[], properties: Record<string, unknown>): Array<{ key: string; label: string; value: string }> {
  return fields
    .filter((field) => field.visible)
    .map((field) => ({
      key: field.key,
      label: field.label || field.key,
      value: properties[field.key] == null ? "" : String(properties[field.key])
    }));
}

export function renderPopupTemplateHtml(templateHtml: string, feature: Feature): string {
  return sanitizePopupHtml(
    templateHtml.replace(popupTokenPattern, (_match, key: string) => escapeHtml((feature.properties as Record<string, unknown> | null)?.[key] ?? ""))
  );
}

export function renderLayerPopupHtml({
  layer,
  feature,
  settings
}: {
  layer: LayerManifest;
  feature: Feature;
  settings: PopupSettings;
}): string {
  if (layer.popupTemplate?.mode === "custom" || layer.popupTemplate?.mode === "original") {
    return renderPopupTemplateHtml(layer.popupTemplate.html, feature);
  }
  return renderStudioPopupHtml({ layer, feature, settings, template: layer.popupTemplate });
}

export function renderStudioPopupHtml({
  layer,
  feature,
  settings,
  template
}: {
  layer: LayerManifest;
  feature: Feature;
  settings: PopupSettings;
  template?: PopupTemplate;
}): string {
  if (settings.style === "original" && template?.html) {
    return renderPopupTemplateHtml(template.html, feature);
  }

  const properties = (feature.properties || {}) as Record<string, unknown>;
  const rows = visiblePopupRows(layer.popupFields, properties);
  const title = popupTitleForFeature(layer, feature);
  const className = popupStyleClass(settings.style);

  if (settings.style === "minimal") {
    const parts = rows
      .map((row) => `${escapeHtml(row.label)}: ${escapeHtml(row.value)}`)
      .join(" · ");
    return `<article class="q2ws-popup ${className}" style="--q2ws-popup-accent:${escapeHtml(settings.accentColor)};--q2ws-popup-bg:${escapeHtml(settings.backgroundColor)};--q2ws-popup-text:${escapeHtml(settings.textColor)};--q2ws-popup-label:${escapeHtml(settings.labelColor)};--q2ws-popup-radius:${settings.radius}px;--q2ws-popup-shadow:${settings.shadow}px"><header>${escapeHtml(title)}</header><p>${parts}</p></article>`;
  }

  const rowsHtml = rows.map((row) => `<li><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></li>`).join("");
  const footerHtml = settings.style === "compact" ? "" : `<footer>${escapeHtml(layer.displayName)}</footer>`;
  return `<article class="q2ws-popup ${className}" style="--q2ws-popup-accent:${escapeHtml(settings.accentColor)};--q2ws-popup-bg:${escapeHtml(settings.backgroundColor)};--q2ws-popup-text:${escapeHtml(settings.textColor)};--q2ws-popup-label:${escapeHtml(settings.labelColor)};--q2ws-popup-radius:${settings.radius}px;--q2ws-popup-shadow:${settings.shadow}px"><header>${escapeHtml(title)}</header><ul>${rowsHtml}</ul>${footerHtml}</article>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function sanitizePopupHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  const allowedTags = new Set(["TABLE", "TBODY", "THEAD", "TR", "TH", "TD", "STRONG", "BR", "SPAN", "DIV", "P", "B", "I", "EM"]);
  const allowedAttrs = new Set(["class", "id", "scope", "colspan", "rowspan"]);
  template.content.querySelectorAll("*").forEach((element) => {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(document.createTextNode(element.textContent || ""));
      return;
    }
    Array.from(element.attributes).forEach((attr) => {
      if (!allowedAttrs.has(attr.name.toLowerCase())) element.removeAttribute(attr.name);
    });
  });
  return template.innerHTML;
}
