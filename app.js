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
  productInput: document.querySelector("#productInput"),
  processInput: document.querySelector("#processInput"),
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
    console.error("Error cargando datos de auditoría:", error);
    elements.guidanceTitle.textContent = "No se pudieron cargar los datos";
    elements.guidanceId.textContent = "Error";
  }
}

function attachEvents() {
  elements.phaseSelect.addEventListener("change", () => {
    populateSubsections();
    render();
  });

  elements.subsectionSelect.addEventListener("change", render);
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
  const phaseId = elements.phaseSelect.value;
  const phase = findPhase(phaseId);

  elements.subsectionSelect.innerHTML = (phase?.subsections ?? [])
    .map(
      (sub) =>
        `<option value="${sub.id}">${sub.id} - ${sub.title}</option>`
    )
    .join("");
}

function render() {
  const subsectionId = elements.subsectionSelect.value;
  const subsectionMeta = findSubsection(subsectionId);
  const baseGuidance = state.guidance?.items?.[subsectionId] ?? null;

  if (!subsectionMeta || !baseGuidance) {
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

  const effectiveGuidance = applyRuleAdjustments(subsectionId, baseGuidance, matchedRules);

  elements.guidanceTitle.textContent = subsectionMeta.title;
  elements.guidanceId.textContent = subsectionMeta.id;

  renderList("que_pedir", effectiveGuidance.que_pedir);
  renderList("que_espero_ver", effectiveGuidance.que_espero_ver);
  renderList("evidencias_tipicas", effectiveGuidance.evidencias_tipicas);
  renderList("preguntas_de_contraste", effectiveGuidance.preguntas_de_contraste);
  renderList("red_flags", effectiveGuidance.red_flags);

  renderAppliedRules(matchedRules);
}

function findPhase(phaseId) {
  return state.structure?.phases?.find((phase) => phase.id === phaseId);
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

    const productOk = matchesCriteria(productText, productTokens);
    const processOk = matchesCriteria(processText, processTokens);

    return productOk && processOk;
  });
}

function applyRuleAdjustments(subsectionId, baseGuidance, matchedRules) {
  const effective = structuredClone(baseGuidance);

  for (const rule of matchedRules) {
    const specificAdjustment = rule.adjustments?.[subsectionId] ?? null;
    const globalAdjustment = rule.adjustments?.["*"] ?? null;

    mergeGuidance(effective, globalAdjustment);
    mergeGuidance(effective, specificAdjustment);
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
    container.innerHTML = "<li>Sin contenido para este subapartado.</li>";
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
