/**
 * Match a bulk-metadata URL pattern against the current pathname.
 * @param {string} pattern URL pattern from the spreadsheet (supports * and **)
 * @param {string} pathname Current page pathname
 * @returns {boolean}
 */
function matchesUrlPattern(pattern, pathname) {
  if (!pattern) return false;
  if (pattern === '**' || pattern === '*') return true;
  if (!pattern.includes('*')) {
    return pathname === pattern || pathname === `${pattern}/`;
  }
  const regex = new RegExp(
    `^${pattern.replace(/\*\*/g, '<<<STARSTAR>>>').replace(/\*/g, '[^/]*').replace(/<<<STARSTAR>>>/g, '.*')}$`,
  );
  return regex.test(pathname);
}

/**
 * @param {string[]} columns
 * @param {string[]} candidates
 * @returns {string|undefined}
 */
function findColumn(columns, candidates) {
  const normalized = new Map(columns.map((col) => [col.toLowerCase(), col]));
  return candidates.map((candidate) => normalized.get(candidate)).find(Boolean);
}

/**
 * Resolve metadata for a path from URL | name | value rows (top-to-bottom).
 * @param {object} sheet AEM spreadsheet JSON
 * @param {string} pathname
 * @returns {Record<string, string>}
 */
export function resolveMetaForPath(sheet, pathname) {
  const rows = sheet.data || [];
  const columns = sheet.columns || [];
  const urlKey = findColumn(columns, ['url']);
  const nameKey = findColumn(columns, ['name']);
  const valueKey = findColumn(columns, ['value']);

  if (!urlKey || !nameKey || !valueKey) return {};

  const meta = {};
  rows.forEach((row) => {
    const url = String(row[urlKey] ?? '').trim();
    const name = String(row[nameKey] ?? '').trim();
    const value = row[valueKey] ?? '';

    if (!url || !name || !matchesUrlPattern(url, pathname)) return;
    meta[name] = String(value);
  });
  return meta;
}

/**
 * Apply resolved metadata as <meta name="…"> tags in document.head.
 * @param {Record<string, string>} meta
 */
export function applyMetaTags(meta) {
  Object.entries(meta).forEach(([name, value]) => {
    const selector = `meta[name="${CSS.escape(name)}"]`;
    if (value === '') {
      document.querySelector(selector)?.remove();
      return;
    }
    let tag = document.querySelector(selector);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', name);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', value);
  });
}

let metaAuthoringPromise;

/**
 * Fetch meta-authoring.json and apply metadata for the current page.
 * @returns {Promise<void>}
 */
export function applyMetaAuthoring() {
  if (!metaAuthoringPromise) {
    metaAuthoringPromise = (async () => {
      try {
        const response = await fetch(`${window.hlx.codeBasePath}/meta-authoring.json`);
        if (!response.ok) return;
        const sheet = await response.json();
        const meta = resolveMetaForPath(sheet, window.location.pathname);
        applyMetaTags(meta);
      } catch {
        // spreadsheet is optional
      }
    })();
  }
  return metaAuthoringPromise;
}
