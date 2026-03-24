/* ══════════════════════════════════════════════════════
   VDA 6.3 Copiloto — Capa de datos
   Responsabilidad: carga, merge y resolución de guía.
   Funciones puras: ninguna toca el DOM ni el estado global.
   ══════════════════════════════════════════════════════ */

export const REQUIRED_FIELDS = [
  "que_pedir",
  "que_espero_ver",
  "evidencias_tipicas",
  "preguntas_de_contraste",
  "red_flags",
  "tips",
];

/* ── Helpers de texto ────────────────────────────────── */

/** Normaliza texto para comparación: minúsculas y sin espacios extra. */
export function normalizeText(v) {
  return (v || "").trim().toLowerCase();
}

/** Devuelve true si inputValue contiene alguno de los tokens. */
export function matchesCriteria(inputValue, tokens = []) {
  if (!tokens.length) return true;
  if (!inputValue) return false;
  return tokens.some((token) => inputValue.includes(token.toLowerCase()));
}

/* ── Resolución de guía ──────────────────────────────── */

/**
 * Construye la cadena de claves para buscar en el JSON de guía.
 * Máxima granularidad: sublevel > sub > fase.
 */
export function buildGuidanceKeyChain(phaseId, subsectionId, sublevelId) {
  if (sublevelId)   return [sublevelId];
  if (subsectionId) return [subsectionId];
  if (phaseId)      return [phaseId];
  return [];
}

/**
 * Fusiona un parche de guía sobre el objeto target.
 * Deduplicación por igualdad estricta de string.
 * Muta target intencionalmente (clonar antes de llamar si se necesita inmutabilidad).
 */
export function mergeGuidance(target, patch) {
  if (!patch) return;
  for (const field of REQUIRED_FIELDS) {
    if (!patch[field]) continue;
    const baseList  = Array.isArray(target[field]) ? target[field] : [];
    const patchList = Array.isArray(patch[field])  ? patch[field]  : [String(patch[field])];
    target[field] = [...baseList, ...patchList.filter((item) => !baseList.includes(item))];
  }
}

/** Resuelve la guía base para una cadena de claves dada. */
export function resolveBaseGuidance(items, guidanceKeys) {
  const merged = {};
  for (const key of guidanceKeys) {
    mergeGuidance(merged, items?.[key] ?? null);
  }
  const hasContent = REQUIRED_FIELDS.some(
    (f) => Array.isArray(merged[f]) && merged[f].length > 0
  );
  return hasContent ? merged : null;
}

/* ── Búsquedas en estructura ─────────────────────────── */

/** Busca una fase por ID. */
export function findPhase(phases = [], phaseId) {
  return phases.find((p) => p.id === phaseId) ?? null;
}

/** Busca una subsección por ID en todas las fases. */
export function findSubsection(phases = [], subId) {
  for (const phase of phases) {
    const match = phase.subsections.find((s) => s.id === subId);
    if (match) return match;
  }
  return null;
}

/** Busca un subnivel dentro de una subsección. */
export function findSublevel(subsection, lvlId) {
  if (!lvlId || !subsection) return null;
  return subsection.sublevels?.find((l) => l.id === lvlId) ?? null;
}

/* ── Reglas de ajuste ────────────────────────────────── */

/** Filtra las reglas del overrides que coinciden con producto/proceso. */
export function findMatchingRules(rules = [], { product, process }) {
  const productText = normalizeText(product);
  const processText = normalizeText(process);

  return rules.filter((rule) => {
    const productTokens = rule.when?.product_contains ?? [];
    const processTokens = rule.when?.process_contains ?? [];
    return (
      matchesCriteria(productText, productTokens) &&
      matchesCriteria(processText, processTokens)
    );
  });
}

/** Aplica los ajustes de las reglas coincidentes sobre una copia de la guía base. */
export function applyRuleAdjustments(guidanceKeys, baseGuidance, matchedRules) {
  const effective = structuredClone(baseGuidance);
  for (const rule of matchedRules) {
    mergeGuidance(effective, rule.adjustments?.["*"] ?? null);
    for (const key of guidanceKeys) {
      mergeGuidance(effective, rule.adjustments?.[key] ?? null);
    }
  }
  return effective;
}
