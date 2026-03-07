# Copiloto de Auditoría VDA 6.3 (P2-P7)

Aplicación web estática, sin backend, orientada a auditoría de proceso en tiempo real.

## Stack

- HTML
- CSS
- JavaScript vanilla
- Datos en JSON editable (`data/*.json`)

## Qué hace esta primera versión

- Permite seleccionar fase (`P2` a `P7`) y subapartado.
- Permite introducir producto y proceso/tecnología en campos abiertos.
- Muestra para cada subapartado:
  - `id`
  - `titulo`
  - `que_pedir`
  - `que_espero_ver`
  - `evidencias_tipicas`
  - `preguntas_de_contraste`
  - `red_flags`
- Parte de una guía base general y aplica ajustes por producto/proceso cuando hay coincidencias en `data/product_overrides.json`.

## Estructura

- `index.html`
- `styles.css`
- `app.js`
- `data/audit_structure.json`
- `data/audit_guidance.json`
- `data/product_overrides.json`
- `netlify.toml`

## Ejecución local

Como usa `fetch` para cargar JSON, se debe levantar con un servidor HTTP local.
Una opción simple es usar Node:

```bash
npx serve .
```

Abrir en el navegador:

```text
http://localhost:3000
```

## Despliegue en Netlify

1. Sube este repositorio a GitHub/GitLab/Bitbucket.
2. En Netlify, crea un sitio desde ese repositorio.
3. Build command: dejar vacío.
4. Publish directory: `.` (ya definido en `netlify.toml`).
5. Despliega.

## Cómo editar contenido de auditoría

- Estructura de fases/subapartados: `data/audit_structure.json`
- Guía base por subapartado: `data/audit_guidance.json`
- Ajustes por producto/proceso: `data/product_overrides.json`

Los cambios en JSON se reflejan al recargar la página.

## Fuera de alcance en esta versión

- Gestión de hallazgos
- Scoring
- Backend o persistencia de datos
