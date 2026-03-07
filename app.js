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

const state = {
  structure: null,
  guidance: null,
  overrides: null
};

const elements = {
  phaseSelect: document.querySelector("#phaseSelect"),
  subsectionSelect: document.querySelector("#subsectionSelect"),
  sublevelField: document.querySelector("#sublevelField"),
  sublevelSelect: document.querySelector("#sublevelSelect"),
  productInput: document.querySelector("#productInput"),
  processInput: document.querySelector("#processInput"),
  selectionPath: document.querySelector("#selectionPath"),
  guidanceTitle: document.querySelector("#guidanceTitle"),
  guidanceId: document.querySelector("#guidanceId"),
  quePedir: document.querySelector("#quePedir"),
  queEsperoVer: document.querySelector("#queEsperoVer"),
  evidenciasTipicas: document.querySelector("#evidenciasTipicas"),
  preguntasContraste: document.querySelector("#preguntasContraste"),
  redFlags: document.querySelector("#redFlags"),
  appliedRules: document.querySelector("#appliedRules")
};

async function init() {
  try {
    const [structure, guidance, overrides] = await Promise.all(
      DATA_FILES.map((file) => fetch(file).then((response) => response.json()))
    );

    state.structure = structure;
    state.guidance = guidance;
    state.overrides = overrides;

    populatePhases();
    attachEvents();
    render();
  } catch (error) {
    console.error("Error cargando datos de auditoria:", error);
    elements.guidanceTitle.textContent = "No se pudieron cargar los datos";
    elements.guidanceId.textContent = "Error";
  }
}

function attachEvents() {
  elements.phaseSelect.addEventListener("change", () => {
    populateSubsections();
    render();
  });

  elements.subsectionSelect.addEventListener("change", () => {
    populateSublevels();
    render();
  });

  elements.sublevelSelect.addEventListener("change", render);
  elements.productInput.addEventListener("input", render);
  elements.processInput.addEventListener("input", render);
}

function populatePhases() {
  const phases = state.structure?.phases ?? [];
  elements.phaseSelect.innerHTML = phases
    .map((phase) => `<option value="${phase.id}">${phase.id} - ${phase.title}</option>`)
    .join("");

  populateSubsections();
}

function populateSubsections() {
  const phase = findPhase(elements.phaseSelect.value);
  const subsections = phase?.subsections ?? [];

  elements.subsectionSelect.innerHTML = subsections
    .map((subsection) => `<option value="${subsection.id}">${subsection.id} - ${subsection.title}</option>`)
    .join("");

  populateSublevels();
}

function populateSublevels() {
  const subsection = findSubsection(elements.subsectionSelect.value);
  const sublevels = subsection?.sublevels ?? [];

  if (!sublevels.length) {
    elements.sublevelSelect.innerHTML = "";
    elements.sublevelField.classList.add("hidden");
    return;
  }

  elements.sublevelSelect.innerHTML = sublevels
    .map((sublevel) => `<option value="${sublevel.id}">${sublevel.id} - ${sublevel.title}</option>`)
    .join("");

  elements.sublevelField.classList.remove("hidden");
}

function render() {
  const selection = getCurrentSelection();
  const baseGuidance = resolveBaseGuidance(selection.guidanceKeys);

  if (!selection.meta || !baseGuidance) {
    elements.selectionPath.textContent = "";
    elements.guidanceTitle.textContent = "Subapartado sin datos";
    elements.guidanceId.textContent = "N/A";
    REQUIRED_FIELDS.forEach((field) => renderList(field, []));
    hideAppliedRules();
    return;
  }

  const matchedRules = findMatchingRules({
    product: elements.productInput.value,
    process: elements.processInput.value
  });

  const effectiveGuidance = applyRuleAdjustments(
    selection.guidanceKeys,
    baseGuidance,
    matchedRules
  );

  elements.selectionPath.textContent = selection.pathLabel;
  elements.guidanceTitle.textContent = selection.meta.title;
  elements.guidanceId.textContent = selection.meta.id;

  renderList("que_pedir", effectiveGuidance.que_pedir);
  renderList("que_espero_ver", effectiveGuidance.que_espero_ver);
  renderList("evidencias_tipicas", effectiveGuidance.evidencias_tipicas);
  renderList("preguntas_de_contraste", effectiveGuidance.preguntas_de_contraste);
  renderList("red_flags", effectiveGuidance.red_flags);

  renderAppliedRules(matchedRules);
}

function getCurrentSelection() {
  const phase = findPhase(elements.phaseSelect.value);
  const subsection = findSubsection(elements.subsectionSelect.value);
  const hasSublevels = Array.isArray(subsection?.sublevels) && subsection.sublevels.length > 0;
  const sublevel = hasSublevels ? findSublevel(subsection, elements.sublevelSelect.value) : null;
  const meta = sublevel ?? subsection ?? null;
  const guidanceKeys = buildGuidanceKeyChain(phase?.id, subsection?.id, sublevel?.id);
  const pathParts = [phase?.id, subsection?.id, sublevel?.id].filter(Boolean);

  return {
    meta,
    guidanceKeys,
    pathLabel: pathParts.join(" > ")
  };
}

function buildGuidanceKeyChain(phaseId, subsectionId, sublevelId) {
  const keys = [];

  if (phaseId) {
    keys.push(phaseId);
  }

  if (subsectionId) {
    keys.push(subsectionId);
  }

  if (sublevelId) {
    keys.push(sublevelId);
  }

  return keys;
}

function resolveBaseGuidance(guidanceKeys) {
  const merged = {};

  for (const key of guidanceKeys) {
    mergeGuidance(merged, state.guidance?.items?.[key] ?? null);
  }

  const hasContent = REQUIRED_FIELDS.some(
    (field) => Array.isArray(merged[field]) && merged[field].length > 0
  );

  return hasContent ? merged : null;
}

function findPhase(phaseId) {
  return state.structure?.phases?.find((phase) => phase.id === phaseId) ?? null;
}

function findSubsection(subsectionId) {
  for (const phase of state.structure?.phases ?? []) {
    const match = phase.subsections.find((subsection) => subsection.id === subsectionId);
    if (match) {
      return match;
    }
  }

  return null;
}

function findSublevel(subsection, sublevelId) {
  return subsection?.sublevels?.find((sublevel) => sublevel.id === sublevelId) ?? subsection?.sublevels?.[0] ?? null;
}

function normalizeText(value) {
  return (value || "").trim().toLowerCase();
}

function matchesCriteria(inputValue, tokens = []) {
  if (!tokens.length) {
    return true;
  }

  if (!inputValue) {
    return false;
  }

  return tokens.some((token) => inputValue.includes(token.toLowerCase()));
}

function findMatchingRules(context) {
  const productText = normalizeText(context.product);
  const processText = normalizeText(context.process);

  return (state.overrides?.rules ?? []).filter((rule) => {
    const productTokens = rule.when?.product_contains ?? [];
    const processTokens = rule.when?.process_contains ?? [];

    return matchesCriteria(productText, productTokens) && matchesCriteria(processText, processTokens);
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
  if (!patch) {
    return;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!patch[field]) {
      continue;
    }

    const baseList = Array.isArray(target[field]) ? target[field] : [];
    const patchList = Array.isArray(patch[field]) ? patch[field] : [String(patch[field])];

    target[field] = [...baseList, ...patchList.filter((item) => !baseList.includes(item))];
  }
}

function renderList(field, items) {
  const elementByField = {
    que_pedir: elements.quePedir,
    que_espero_ver: elements.queEsperoVer,
    evidencias_tipicas: elements.evidenciasTipicas,
    preguntas_de_contraste: elements.preguntasContraste,
    red_flags: elements.redFlags
  };

  const container = elementByField[field];
  const listItems = Array.isArray(items) ? items : [];

  if (!listItems.length) {
    container.innerHTML = "<li>Sin contenido para este nivel de auditoria.</li>";
    return;
  }

  container.innerHTML = listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderAppliedRules(rules) {
  if (!rules.length) {
    hideAppliedRules();
    return;
  }

  const labels = rules.map((rule) => `${rule.id} (${rule.name})`).join(" | ");
  elements.appliedRules.textContent = `Ajustes activos por producto/proceso: ${labels}`;
  elements.appliedRules.classList.remove("hidden");
}

function hideAppliedRules() {
  elements.appliedRules.textContent = "";
  elements.appliedRules.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init();
