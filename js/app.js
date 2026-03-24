/* ══════════════════════════════════════════════════════
   VDA 6.3 Copiloto — Orquestador principal
   Responsabilidad: estado, eventos y ciclo de render.
   Delega lógica de datos a data-service.js
   y manipulación del DOM a renderer.js.
   ══════════════════════════════════════════════════════ */

import * as DS       from "./data-service.js";
import * as Renderer from "./renderer.js";

/* ── Constantes ──────────────────────────────────────── */

const DATA_FILES = [
  "data/audit_structure.json",
  "data/audit_guidance.json",
  "data/product_overrides.json",
];

/** Media query compartida — única fuente de verdad para el breakpoint mobile. */
const MOBILE_MQ = window.matchMedia("(max-width: 720px)");

/* ── Estado ───────────────────────────────────────────── */
const state = {
  structure: null,
  guidance:  null,
  overrides: null,
  selectedPhaseId: null,
  selectedSubId:   null,
  selectedLvlId:   null,
};

/* ── Referencias DOM ─────────────────────────────────── */
const el = {
  sidebarTree:    document.querySelector("#sidebarTree"),
  sidebar:        document.querySelector("#sidebar"),
  sidebarOverlay: document.querySelector("#sidebarOverlay"),
  menuToggle:     document.querySelector("#menuToggle"),
  emptyState:     document.querySelector("#emptyState"),
  contentPanel:   document.querySelector("#contentPanel"),
  selectionPath:  document.querySelector("#selectionPath"),
  guidanceTitle:  document.querySelector("#guidanceTitle"),
  guidanceId:     document.querySelector("#guidanceId"),
  appliedRules:   document.querySelector("#appliedRules"),
  contentBlocks:  document.querySelectorAll(".content-block"),
  // Inputs de contexto — único par, en el topbar (visible en desktop y mobile)
  productInput:   document.querySelector("#productInput"),
  processInput:   document.querySelector("#processInput"),
  // Contenedores de listas mapeados por campo
  listContainers: {
    que_pedir:              document.querySelector("#quePedir"),
    que_espero_ver:         document.querySelector("#queEsperoVer"),
    evidencias_tipicas:     document.querySelector("#evidenciasTipicas"),
    preguntas_de_contraste: document.querySelector("#preguntasContraste"),
    red_flags:              document.querySelector("#redFlags"),
    tips:                   document.querySelector("#tips"),
  },
};

/* ── Utilidades ──────────────────────────────────────── */

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ═══════════════════════════════════════════════════════
   INICIO
   ═══════════════════════════════════════════════════════ */
async function init() {
  try {
    const [structure, guidance, overrides] = await Promise.all(
      DATA_FILES.map((f) =>
        fetch(f).then((r) => {
          if (!r.ok) throw new Error(`No se pudo cargar ${f}`);
          return r.json();
        })
      )
    );

    state.structure = structure;
    state.guidance  = guidance;
    state.overrides = overrides;

    Renderer.buildSidebar(el.sidebarTree, state.structure?.phases ?? []);
    attachEvents();
    autoSelectFirst();
  } catch (err) {
    console.error("Error cargando datos:", err);
    if (el.emptyState) {
      el.emptyState.innerHTML =
        "<div class='empty-arrow'>⚠</div><h2>Error al cargar datos</h2>" +
        "<p>Comprueba que los archivos JSON están disponibles y recarga la página.</p>";
    }
  }
}

/* ═══════════════════════════════════════════════════════
   EVENTOS
   ═══════════════════════════════════════════════════════ */
function attachEvents() {
  el.sidebarTree.addEventListener("click", onSidebarClick);

  // Inputs de contexto — debounce para no disparar render en cada pulsación
  const debouncedRender = debounce(render, 200);
  el.productInput?.addEventListener("input", debouncedRender);
  el.processInput?.addEventListener("input", debouncedRender);

  // Sidebar mobile
  el.menuToggle?.addEventListener("click", toggleSidebar);
  el.sidebarOverlay?.addEventListener("click", closeSidebar);
}

function onSidebarClick(e) {
  const lvlBtn   = e.target.closest(".nav-lvl-btn");
  const subBtn   = e.target.closest(".nav-sub-btn");
  const phaseBtn = e.target.closest(".nav-phase-btn");

  if (lvlBtn) {
    selectItem(lvlBtn.dataset.phase, lvlBtn.dataset.sub, lvlBtn.dataset.lvl);
    closeSidebarOnMobile();
    return;
  }

  if (subBtn) {
    const hasLvls = subBtn.dataset.hasLvls === "true";
    if (hasLvls) {
      const lvlList = document.getElementById(`lvls-${subBtn.dataset.sub}`);
      const arrow   = subBtn.querySelector(".nav-sub-arrow");
      if (lvlList) {
        const isOpening = !lvlList.classList.contains("open");
        lvlList.classList.toggle("open");
        arrow?.classList.toggle("open");
        // Al abrir, seleccionar el primer subnivel automáticamente
        if (isOpening) {
          const firstLvl = lvlList.querySelector(".nav-lvl-btn");
          if (firstLvl) {
            selectItem(firstLvl.dataset.phase, firstLvl.dataset.sub, firstLvl.dataset.lvl);
          }
        }
      }
    } else {
      selectItem(subBtn.dataset.phase, subBtn.dataset.sub, null);
      closeSidebarOnMobile();
    }
    return;
  }

  if (phaseBtn) {
    const phaseId = phaseBtn.dataset.phase;
    document.querySelector(`#subs-${phaseId}`)?.classList.toggle("open");
    document.querySelector(`#chevron-${phaseId}`)?.classList.toggle("open");
    return;
  }
}

/* ═══════════════════════════════════════════════════════
   SELECCIÓN
   ═══════════════════════════════════════════════════════ */
function selectItem(phaseId, subId, lvlId) {
  state.selectedPhaseId = phaseId;
  state.selectedSubId   = subId;
  state.selectedLvlId   = lvlId;

  // Limpiar selección anterior
  document.querySelectorAll(".nav-sub-btn, .nav-lvl-btn").forEach((btn) =>
    btn.classList.remove("active")
  );

  // Marcar activo
  if (lvlId) {
    document.querySelector(`.nav-lvl-btn[data-lvl="${lvlId}"]`)?.classList.add("active");
  } else if (subId) {
    document.querySelector(`.nav-sub-btn[data-sub="${subId}"]`)?.classList.add("active");
  }

  render();
}

function autoSelectFirst() {
  const firstPhase = state.structure?.phases?.[0];
  if (!firstPhase) return;

  // Expandir primera fase
  document.querySelector(`#subs-${firstPhase.id}`)?.classList.add("open");
  document.querySelector(`#chevron-${firstPhase.id}`)?.classList.add("open");

  const firstSub = firstPhase.subsections?.[0];
  if (!firstSub) return;

  // Si tiene subniveles, expandir y seleccionar el primero
  if (Array.isArray(firstSub.sublevels) && firstSub.sublevels.length > 0) {
    const lvlList = document.getElementById(`lvls-${firstSub.id}`);
    const arrow   = document.querySelector(`.nav-sub-btn[data-sub="${firstSub.id}"] .nav-sub-arrow`);
    lvlList?.classList.add("open");
    arrow?.classList.add("open");
    selectItem(firstPhase.id, firstSub.id, firstSub.sublevels[0].id);
  } else {
    selectItem(firstPhase.id, firstSub.id, null);
  }
}

/* ═══════════════════════════════════════════════════════
   RENDERIZADO
   ═══════════════════════════════════════════════════════ */
function render() {
  if (!state.selectedSubId) {
    Renderer.showEmpty(el.emptyState, el.contentPanel);
    return;
  }

  const phases       = state.structure?.phases ?? [];
  const phase        = DS.findPhase(phases, state.selectedPhaseId);
  const subsection   = DS.findSubsection(phases, state.selectedSubId);
  const sublevel     = DS.findSublevel(subsection, state.selectedLvlId);

  const meta         = sublevel ?? subsection;
  const guidanceKeys = DS.buildGuidanceKeyChain(phase?.id, subsection?.id, sublevel?.id);
  const baseGuidance = DS.resolveBaseGuidance(state.guidance?.items, guidanceKeys);

  if (!meta || !baseGuidance) {
    Renderer.showEmpty(el.emptyState, el.contentPanel);
    return;
  }

  const product          = el.productInput?.value ?? "";
  const process          = el.processInput?.value ?? "";
  const matchedRules     = DS.findMatchingRules(state.overrides?.rules ?? [], { product, process });
  const effectiveGuidance = DS.applyRuleAdjustments(guidanceKeys, baseGuidance, matchedRules);

  Renderer.showContent(el.emptyState, el.contentPanel);

  // Cabecera
  const pathParts = [phase?.id, subsection?.id, sublevel?.id].filter(Boolean);
  if (el.selectionPath) el.selectionPath.textContent = pathParts.join(" › ");
  if (el.guidanceTitle) el.guidanceTitle.textContent  = meta.title;
  if (el.guidanceId)    el.guidanceId.textContent     = meta.id;

  // Contenido — iteramos sobre REQUIRED_FIELDS para no duplicar la lógica
  for (const field of DS.REQUIRED_FIELDS) {
    Renderer.renderList(el.listContainers, field, effectiveGuidance[field]);
  }
  Renderer.updateBlockVisibility(el.contentBlocks, effectiveGuidance);
  Renderer.renderAppliedRules(el.appliedRules, matchedRules);
}

/* ── Sidebar mobile ──────────────────────────────────── */
function toggleSidebar() {
  el.sidebar?.classList.toggle("open");
  el.sidebarOverlay?.classList.toggle("visible");
  el.sidebarOverlay?.classList.toggle("hidden");
}

function closeSidebar() {
  el.sidebar?.classList.remove("open");
  el.sidebarOverlay?.classList.remove("visible");
  el.sidebarOverlay?.classList.add("hidden");
}

function closeSidebarOnMobile() {
  if (MOBILE_MQ.matches) closeSidebar();
}

/* ── Arranque ────────────────────────────────────────── */
init();
