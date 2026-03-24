/* ══════════════════════════════════════════════════════
   VDA 6.3 Copiloto — Capa de renderizado
   Responsabilidad: manipulación del DOM únicamente.
   Recibe datos como argumentos; no accede a estado global.
   ══════════════════════════════════════════════════════ */

import { REQUIRED_FIELDS } from "./data-service.js";

/* ── Seguridad ───────────────────────────────────────── */

/** Escapa HTML para prevenir XSS. */
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ── Sidebar ─────────────────────────────────────────── */

/** Construye el árbol de navegación a partir de las fases. */
export function buildSidebar(sidebarTree, phases = []) {
  sidebarTree.innerHTML = phases.map((phase) => {
    const subsHtml = phase.subsections.map((sub) => {
      const hasLvls = Array.isArray(sub.sublevels) && sub.sublevels.length > 0;

      const lvlsHtml = hasLvls
        ? `<ul class="nav-lvl-list" id="lvls-${sub.id}">
            ${sub.sublevels.map((lvl) => `
              <li>
                <button class="nav-lvl-btn"
                  data-phase="${phase.id}"
                  data-sub="${sub.id}"
                  data-lvl="${lvl.id}">
                  <span class="nav-lvl-id">${lvl.id}</span>
                  <span>${escapeHtml(lvl.title)}</span>
                </button>
              </li>`).join("")}
          </ul>`
        : "";

      return `
        <li class="nav-sub-item">
          <button class="nav-sub-btn"
            data-phase="${phase.id}"
            data-sub="${sub.id}"
            ${hasLvls ? 'data-has-lvls="true"' : ""}>
            <span class="nav-sub-id">${sub.id}</span>
            <span class="nav-sub-label">${escapeHtml(sub.title)}</span>
            ${hasLvls ? '<span class="nav-sub-arrow">›</span>' : ""}
          </button>
          ${lvlsHtml}
        </li>`;
    }).join("");

    return `
      <div class="nav-phase" id="phase-${phase.id}">
        <button class="nav-phase-btn" data-phase="${phase.id}">
          <span class="nav-phase-badge">${phase.id}</span>
          <span class="nav-phase-title">${escapeHtml(phase.title)}</span>
          <span class="nav-chevron" id="chevron-${phase.id}">›</span>
        </button>
        <ul class="nav-sub-list" id="subs-${phase.id}">
          ${subsHtml}
        </ul>
      </div>`;
  }).join("");
}

/* ── Contenido de guía ───────────────────────────────── */

/**
 * Renderiza una lista de ítems en el contenedor del campo dado.
 * @param {Record<string, HTMLElement>} containers - Mapa campo → elemento.
 * @param {string} field - Nombre del campo (debe existir en containers).
 * @param {string[]} items - Ítems a renderizar.
 */
export function renderList(containers, field, items) {
  const container = containers[field];
  if (!container) return;
  const list = Array.isArray(items) ? items : [];
  container.innerHTML = list.length
    ? list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li><em>Sin contenido para este nivel de auditoría.</em></li>";
}

/** Muestra u oculta cada bloque de contenido según si tiene datos. */
export function updateBlockVisibility(contentBlocks, guidance) {
  contentBlocks.forEach((block) => {
    const field = block.dataset.field;
    const items = Array.isArray(guidance[field]) ? guidance[field] : [];
    block.hidden = items.length === 0;
  });
}

/** Renderiza el banner de reglas de ajuste activas. */
export function renderAppliedRules(appliedRulesEl, rules) {
  if (!appliedRulesEl) return;
  if (!rules.length) {
    appliedRulesEl.hidden = true;
    appliedRulesEl.textContent = "";
    return;
  }
  appliedRulesEl.textContent =
    "Ajustes activos: " + rules.map((r) => `${r.id} — ${r.name}`).join(" | ");
  appliedRulesEl.hidden = false;
}

/* ── Visibilidad del panel ───────────────────────────── */

/** Muestra el estado vacío y oculta el panel de contenido. */
export function showEmpty(emptyState, contentPanel) {
  emptyState?.classList.remove("hidden");
  if (contentPanel) contentPanel.hidden = true;
}

/** Muestra el panel de contenido y oculta el estado vacío. */
export function showContent(emptyState, contentPanel) {
  emptyState?.classList.add("hidden");
  if (contentPanel) contentPanel.hidden = false;
}
