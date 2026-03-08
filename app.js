/* ══════════════════════════════════════════════════════
   VDA 6.3 Copiloto — Lógica de aplicación
   ══════════════════════════════════════════════════════ */

const DATA_FILES = [
  "data/audit_structure.json",
  "data/audit_guidance.json",
  "data/product_overrides.json"
];

const REQUIRED_FIELDS = [
  "que_pedir",
  "que_espero_ver",
  "evidencias_tipicas",
  "preguntas_de_contraste",
  "red_flags"
];

/* ── Estado global ───────────────────────────────────── */
const state = {
  structure: null,
  guidance: null,
  overrides: null,
  selectedPhaseId: null,
  selectedSubId: null,
  selectedLvlId: null,
  activeTab: "que_pedir"
};

/* ── Referencias DOM ─────────────────────────────────── */
const el = {
  sidebarTree:      document.querySelector("#sidebarTree"),
  sidebar:          document.querySelector("#sidebar"),
  sidebarOverlay:   document.querySelector("#sidebarOverlay"),
  menuToggle:       document.querySelector("#menuToggle"),
  emptyState:       document.querySelector("#emptyState"),
  contentPanel:     document.querySelector("#contentPanel"),
  selectionPath:    document.querySelector("#selectionPath"),
  guidanceTitle:    document.querySelector("#guidanceTitle"),
  guidanceId:       document.querySelector("#guidanceId"),
  appliedRules:     document.querySelector("#appliedRules"),
  quePedir:         document.querySelector("#quePedir"),
  queEsperoVer:     document.querySelector("#queEsperoVer"),
  evidenciasTipicas:document.querySelector("#evidenciasTipicas"),
  preguntasContraste:document.querySelector("#preguntasContraste"),
  redFlags:         document.querySelector("#redFlags"),
  // Topbar (desktop)
  productInput:     document.querySelector("#productInput"),
  processInput:     document.querySelector("#processInput"),
  // Mobile context
  productInputMobile:  document.querySelector("#productInputMobile"),
  processInputMobile:  document.querySelector("#processInputMobile")
};

/* ═══════════════════════════════════════════════════════
   INICIO
   ═══════════════════════════════════════════════════════ */
async function init() {
  try {
    const [structure, guidance, overrides] = await Promise.all(
      DATA_FILES.map((f) => fetch(f).then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar ${f}`);
        return r.json();
      }))
    );

    state.structure = structure;
    state.guidance  = guidance;
    state.overrides = overrides;

    buildSidebar();
    attachEvents();
    autoSelectFirst();
  } catch (err) {
    console.error("Error cargando datos:", err);
    if (el.emptyState) {
      el.emptyState.innerHTML =
        "<div class='empty-arrow'>⚠</div><h2>Error al cargar datos</h2><p>Comprueba que los archivos JSON están disponibles y recarga la página.</p>";
    }
  }
}

/* ═══════════════════════════════════════════════════════
   SIDEBAR — construcción del árbol de navegación
   ═══════════════════════════════════════════════════════ */
function buildSidebar() {
  const phases = state.structure?.phases ?? [];

  el.sidebarTree.innerHTML = phases.map((phase) => {
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

/* ═══════════════════════════════════════════════════════
   EVENTOS
   ═══════════════════════════════════════════════════════ */
function attachEvents() {
  // Delegación en el árbol del sidebar
  el.sidebarTree.addEventListener("click", onSidebarClick);

  // Tabs
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => switchTab(tab.dataset.tab))
  );

  // Inputs de contexto — desktop y mobile en sincronía
  el.productInput?.addEventListener("input", () => {
    if (el.productInputMobile) el.productInputMobile.value = el.productInput.value;
    render();
  });
  el.processInput?.addEventListener("input", () => {
    if (el.processInputMobile) el.processInputMobile.value = el.processInput.value;
    render();
  });
  el.productInputMobile?.addEventListener("input", () => {
    if (el.productInput) el.productInput.value = el.productInputMobile.value;
    render();
  });
  el.processInputMobile?.addEventListener("input", () => {
    if (el.processInput) el.processInput.value = el.processInputMobile.value;
    render();
  });

  // Toggle sidebar mobile
  el.menuToggle?.addEventListener("click", toggleSidebar);
  el.sidebarOverlay?.addEventListener("click", closeSidebar);
}

function onSidebarClick(e) {
  const phaseBtn = e.target.closest(".nav-phase-btn");
  const subBtn   = e.target.closest(".nav-sub-btn");
  const lvlBtn   = e.target.closest(".nav-lvl-btn");

  if (lvlBtn) {
    selectItem(lvlBtn.dataset.phase, lvlBtn.dataset.sub, lvlBtn.dataset.lvl);
    closeSidebarOnMobile();
    return;
  }

  if (subBtn) {
    const hasLvls = subBtn.dataset.hasLvls === "true";
    if (hasLvls) {
      // Expandir/contraer los subniveles y auto-seleccionar el primero
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
    const subList = document.querySelector(`#subs-${phaseId}`);
    const chevron = document.querySelector(`#chevron-${phaseId}`);
    if (subList) {
      subList.classList.toggle("open");
      chevron?.classList.toggle("open");
    }
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

  // Actualizar clases activas en el sidebar
  document.querySelectorAll(".nav-sub-btn, .nav-lvl-btn").forEach((btn) =>
    btn.classList.remove("active")
  );

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
  const subList = document.querySelector(`#subs-${firstPhase.id}`);
  const chevron = document.querySelector(`#chevron-${firstPhase.id}`);
  subList?.classList.add("open");
  chevron?.classList.add("open");

  // Seleccionar primera subsección
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
   TABS
   ═══════════════════════════════════════════════════════ */
function switchTab(tabId) {
  state.activeTab = tabId;

  document.querySelectorAll(".tab").forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.tab === tabId)
  );
  document.querySelectorAll(".tab-pane").forEach((pane) =>
    pane.classList.toggle("active", pane.id === `pane-${tabId}`)
  );
}

/* ═══════════════════════════════════════════════════════
   RENDERIZADO
   ═══════════════════════════════════════════════════════ */
function render() {
  if (!state.selectedSubId) {
    showEmpty();
    return;
  }

  const phase      = findPhase(state.selectedPhaseId);
  const subsection = findSubsection(state.selectedSubId);
  const sublevel   = state.selectedLvlId
    ? findSublevel(subsection, state.selectedLvlId)
    : null;

  const meta         = sublevel ?? subsection;
  const guidanceKeys = buildGuidanceKeyChain(phase?.id, subsection?.id, sublevel?.id);
  const baseGuidance = resolveBaseGuidance(guidanceKeys);

  if (!meta || !baseGuidance) {
    showEmpty();
    return;
  }

  const product = el.productInput?.value ?? "";
  const process = el.processInput?.value ?? "";
  const matchedRules    = findMatchingRules({ product, process });
  const effectiveGuidance = applyRuleAdjustments(guidanceKeys, baseGuidance, matchedRules);

  // Mostrar panel de contenido
  el.emptyState?.classList.add("hidden");
  if (el.contentPanel) el.contentPanel.hidden = false;

  // Cabecera
  const pathParts = [phase?.id, subsection?.id, sublevel?.id].filter(Boolean);
  if (el.selectionPath) el.selectionPath.textContent = pathParts.join(" › ");
  if (el.guidanceTitle)  el.guidanceTitle.textContent  = meta.title;
  if (el.guidanceId)     el.guidanceId.textContent     = meta.id;

  // Listas
  renderList("que_pedir",            effectiveGuidance.que_pedir);
  renderList("que_espero_ver",       effectiveGuidance.que_espero_ver);
  renderList("evidencias_tipicas",   effectiveGuidance.evidencias_tipicas);
  renderList("preguntas_de_contraste", effectiveGuidance.preguntas_de_contraste);
  renderList("red_flags",            effectiveGuidance.red_flags);

  renderAppliedRules(matchedRules);
}

function showEmpty() {
  el.emptyState?.classList.remove("hidden");
  if (el.contentPanel) el.contentPanel.hidden = true;
}

/* ── Listas de contenido ─────────────────────────────── */
function renderList(field, items) {
  const containers = {
    que_pedir:              el.quePedir,
    que_espero_ver:         el.queEsperoVer,
    evidencias_tipicas:     el.evidenciasTipicas,
    preguntas_de_contraste: el.preguntasContraste,
    red_flags:              el.redFlags
  };

  const container = containers[field];
  if (!container) return;

  const list = Array.isArray(items) ? items : [];
  container.innerHTML = list.length
    ? list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li><em>Sin contenido para este nivel de auditoría.</em></li>";
}

function renderAppliedRules(rules) {
  if (!el.appliedRules) return;

  if (!rules.length) {
    el.appliedRules.hidden = true;
    el.appliedRules.textContent = "";
    return;
  }

  el.appliedRules.textContent =
    "Ajustes activos: " + rules.map((r) => `${r.id} — ${r.name}`).join(" | ");
  el.appliedRules.hidden = false;
}

/* ═══════════════════════════════════════════════════════
   LÓGICA DE DATOS (sin cambios respecto a v1)
   ═══════════════════════════════════════════════════════ */
function buildGuidanceKeyChain(phaseId, subsectionId, sublevelId) {
  if (sublevelId) return [sublevelId];
  if (subsectionId) return [subsectionId];
  if (phaseId) return [phaseId];
  return [];
}

function resolveBaseGuidance(guidanceKeys) {
  const merged = {};
  for (const key of guidanceKeys) {
    mergeGuidance(merged, state.guidance?.items?.[key] ?? null);
  }
  const hasContent = REQUIRED_FIELDS.some(
    (f) => Array.isArray(merged[f]) && merged[f].length > 0
  );
  return hasContent ? merged : null;
}

function findPhase(phaseId) {
  return state.structure?.phases?.find((p) => p.id === phaseId) ?? null;
}

function findSubsection(subId) {
  for (const phase of state.structure?.phases ?? []) {
    const match = phase.subsections.find((s) => s.id === subId);
    if (match) return match;
  }
  return null;
}

function findSublevel(subsection, lvlId) {
  if (!lvlId) return null;
  return subsection?.sublevels?.find((l) => l.id === lvlId) ?? null;
}

function findMatchingRules({ product, process }) {
  const productText = normalizeText(product);
  const processText = normalizeText(process);

  return (state.overrides?.rules ?? []).filter((rule) => {
    const productTokens = rule.when?.product_contains ?? [];
    const processTokens = rule.when?.process_contains ?? [];
    return matchesCriteria(productText, productTokens) &&
           matchesCriteria(processText, processTokens);
  });
}

function applyRuleAdjustments(guidanceKeys, baseGuidance, matchedRules) {
  const effective = structuredClone(baseGuidance);
  for (const rule of matchedRules) {
    mergeGuidance(effective, rule.adjustments?.["*"] ?? null);
    for (const key of guidanceKeys) {
      mergeGuidance(effective, rule.adjustments?.[key] ?? null);
    }
  }
  return effective;
}

function mergeGuidance(target, patch) {
  if (!patch) return;
  for (const field of REQUIRED_FIELDS) {
    if (!patch[field]) continue;
    const baseList  = Array.isArray(target[field]) ? target[field] : [];
    const patchList = Array.isArray(patch[field]) ? patch[field] : [String(patch[field])];
    target[field] = [...baseList, ...patchList.filter((item) => !baseList.includes(item))];
  }
}

/* ── Helpers ─────────────────────────────────────────── */
function normalizeText(v) {
  return (v || "").trim().toLowerCase();
}

function matchesCriteria(inputValue, tokens = []) {
  if (!tokens.length) return true;
  if (!inputValue) return false;
  return tokens.some((token) => inputValue.includes(token.toLowerCase()));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  if (window.innerWidth <= 720) closeSidebar();
}

/* ── Arranque ────────────────────────────────────────── */
init();
