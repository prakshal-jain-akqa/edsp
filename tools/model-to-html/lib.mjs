const COLLAPSE_SUFFIXES = ['MimeType', 'Alt', 'Text', 'Title', 'Type'];

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * AEM delivers richtext without the outer paragraph wrapper.
 * @param {string} html
 * @returns {string}
 */
function stripOuterParagraph(html) {
  const trimmed = String(html ?? '').trim();
  const match = trimmed.match(/^<p>([\s\S]*)<\/p>$/i);
  return match ? match[1] : trimmed;
}

/**
 * @param {object} field
 * @param {number} index
 * @param {boolean} useSamples
 * @returns {string}
 */
function sampleValue(field, index = 0, useSamples = false) {
  if (Array.isArray(field.value)) {
    return String(field.value[index] ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(field, 'value')) {
    return String(field.value ?? '');
  }
  if (!useSamples) {
    return index > 0 ? '' : '';
  }
  const suffix = index > 0 ? ` ${index + 1}` : '';
  return `${field.label || field.name}${suffix}`;
}

/**
 * @param {object} field
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @returns {string[]}
 */
function getMultiFieldValues(field, multiCount, useSamples) {
  if (Array.isArray(field.value)) {
    return field.value.map((value) => String(value ?? ''));
  }
  if (Object.prototype.hasOwnProperty.call(field, 'value')) {
    const value = field.value;
    if (value === '' || value === null || value === undefined) {
      return [];
    }
    return [String(value)];
  }
  if (useSamples) {
    return Array.from({ length: multiCount }, (_, index) => sampleValue(field, index, true))
      .filter((value) => value !== '');
  }
  return [];
}

/**
 * @param {object[]} fields
 * @returns {object[]} fields that render as their own row/cell group
 */
export function getRenderableFields(fields) {
  const names = fields.map((field) => field.name);
  return fields.filter((field) => {
    const collapse = getCollapseInfo(field.name, names);
    return !collapse;
  });
}

/**
 * @param {string} fieldName
 * @param {string[]} fieldNames
 * @returns {{ base: string, suffix: string }|null}
 */
export function getCollapseInfo(fieldName, fieldNames) {
  return COLLAPSE_SUFFIXES
    .map((suffix) => ({ suffix, base: fieldName.slice(0, -suffix.length) }))
    .find(({ suffix, base }) => fieldName.endsWith(suffix)
      && base !== fieldName
      && fieldNames.includes(base)) || null;
}

/**
 * @param {object[]} fields
 * @param {string} baseName
 * @returns {Record<string, object>}
 */
function getCollapsedSiblings(fields, baseName) {
  return Object.fromEntries(
    fields
      .filter((field) => field.name.startsWith(baseName) && field.name !== baseName)
      .map((field) => [field.name, field]),
  );
}

/**
 * @param {object} field
 * @param {Record<string, object>} siblings
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @param {{ linkAsButton?: boolean }} renderOptions
 * @returns {string}
 */
function renderFieldContent(
  field,
  siblings = {},
  multiCount = 1,
  useSamples = false,
  renderOptions = {},
) {
  const { component, name } = field;
  const { linkAsButton = false } = renderOptions;

  switch (component) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date-time': {
      if (field.multi) {
        const parts = getMultiFieldValues(field, multiCount, useSamples);
        if (!parts.length) return '';
        return parts.map(escapeHtml).join('<br>');
      }
      return escapeHtml(sampleValue(field, 0, useSamples));
    }

    case 'boolean':
      return field.value === false ? '' : 'true';

    case 'select':
    case 'radio-group': {
      const selected = field.value
        ?? field.options?.find((option) => option.value)?.value
        ?? '';
      return escapeHtml(String(selected));
    }

    case 'multiselect': {
      if (field.value !== undefined && field.value !== null && field.value !== '') {
        return escapeHtml(String(field.value));
      }
      const selected = field.options?.slice(0, 2).map((option) => option.value || option.name) ?? [];
      return escapeHtml(selected.join(','));
    }

    case 'checkbox-group': {
      const selected = Array.isArray(field.value)
        ? field.value
        : field.options?.slice(0, 2).map((option) => option.value || option.name) ?? [];
      if (!selected.length) return '';
      return `<ul>${selected.map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
    }

    case 'aem-tag':
      return escapeHtml(sampleValue(field, 0, useSamples));

    case 'richtext': {
      if (field.multi) {
        const parts = getMultiFieldValues(field, multiCount, useSamples);
        return parts.map((value) => stripOuterParagraph(value)).join('');
      }
      return stripOuterParagraph(sampleValue(field, 0, useSamples));
    }

    case 'reference': {
      const altField = siblings[`${name}Alt`];
      if (altField) {
        const href = sampleValue(field, 0, useSamples);
        const alt = sampleValue(altField, 0, useSamples);
        return `<a href="${escapeHtml(href)}">${escapeHtml(alt)}</a>`;
      }
      const values = getMultiFieldValues(field, multiCount, useSamples);
      const count = values.length || (field.multi ? multiCount : 1);
      const pictures = Array.from({ length: count }, (_, index) => (
        `<picture><img loading="lazy" alt="" src="/media/sample-${name}-${index + 1}.png" width="750" height="422"></picture>`
      ));
      return pictures.join(field.multi ? '' : '');
    }

    case 'aem-content': {
      const textField = siblings[`${name}Text`] || siblings.linkText;
      const titleField = siblings[`${name}Title`] || siblings.linkTitle;
      const typeField = siblings[`${name}Type`] || siblings.linkType;
      const href = sampleValue(field, 0, useSamples);
      const text = textField ? sampleValue(textField, 0, useSamples) : href;
      const title = titleField ? sampleValue(titleField, 0, useSamples) : text;
      if (linkAsButton) {
        const typeValue = typeField?.value ?? typeField?.options?.find((option) => option.value)?.value ?? '';
        const className = typeValue ? `button ${typeValue}` : 'button';
        return `<a href="${escapeHtml(href)}" class="${escapeHtml(className)}" title="${escapeHtml(title)}">${escapeHtml(text)}</a>`;
      }
      return `<strong><a href="${escapeHtml(href)}" title="${escapeHtml(title)}">${escapeHtml(text)}</a></strong>`;
    }

    case 'aem-content-fragment':
    case 'aem-experience-fragment': {
      const path = sampleValue(field, 0, useSamples);
      if (!path) return '';
      return `<a href="${escapeHtml(path)}">${escapeHtml(path)}</a>`;
    }

    case 'container':
      return renderContainerField(field, multiCount, useSamples);

    case 'tab':
      return (field.fields || [])
        .map((child) => renderCell(child, {}, multiCount, 0, useSamples, renderOptions))
        .join('');

    default:
      return escapeHtml(sampleValue(field, 0, useSamples));
  }
}

/**
 * @param {object} field
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @returns {string}
 */
function renderContainerField(field, multiCount, useSamples) {
  const children = field.fields || [];
  const instances = field.multi && useSamples ? multiCount : 1;
  if (field.multi && !useSamples) {
    return '';
  }
  return Array.from({ length: instances }, () => {
    const cells = children.map((child) => renderCell(child, {}, 1, 0, useSamples)).join('');
    return `<div>${cells}</div>`;
  }).join('');
}

/**
 * @param {object} field
 * @param {Record<string, object>} siblings
 * @param {number} multiCount
 * @param {number} index
 * @param {boolean} useSamples
 * @param {{ linkAsButton?: boolean }} renderOptions
 * @returns {string}
 */
function renderCell(
  field,
  siblings = {},
  multiCount = 1,
  index = 0,
  useSamples = false,
  renderOptions = {},
) {
  const content = renderFieldContent(field, siblings, multiCount, useSamples, renderOptions);
  if (field.component === 'container' || field.component === 'tab') {
    return content;
  }
  return `<div>${content}</div>`;
}

/**
 * @param {object} field
 * @param {object[]} allFields
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @param {{ linkAsButton?: boolean }} renderOptions
 * @returns {string}
 */
function renderCollapsedRow(field, allFields, multiCount, useSamples = false, renderOptions = {}) {
  const siblings = getCollapsedSiblings(allFields, field.name);
  const content = renderFieldContent(field, siblings, multiCount, useSamples, renderOptions);

  if (field.name === 'title' && siblings.titleType) {
    const level = siblings.titleType.value || siblings.titleType.options?.[0]?.value || 'h2';
    return renderRow(`<${level}>${escapeHtml(sampleValue(field))}</${level}>`);
  }

  return renderRow(content);
}

/**
 * @param {string} cellContent
 * @returns {string}
 */
function renderRow(cellContent) {
  return `<div>\n    <div>${cellContent}</div>\n  </div>`;
}

/**
 * @param {object[]} fields
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @param {{ linkAsButton?: boolean }} renderOptions
 * @returns {string}
 */
export function renderBlockRows(fields, multiCount = 2, useSamples = false, renderOptions = {}) {
  const flatFields = flattenFields(fields);
  const renderable = getRenderableFields(flatFields);

  return renderable.map((field) => {
    if (field.component === 'container' && field.multi) {
      if (!useSamples) {
        return renderRow('');
      }
      return Array.from({ length: multiCount }, () => {
        const cells = (field.fields || [])
          .map((child) => renderCell(child, {}, 1, 0, useSamples, renderOptions))
          .join('\n      ');
        return `<div>\n      ${cells}\n  </div>`;
      }).join('\n  ');
    }

    if (field.component === 'container') {
      const cells = (field.fields || [])
        .map((child) => renderCell(child, {}, 1, 0, useSamples, renderOptions))
        .join('\n      ');
      return `<div>\n      ${cells}\n  </div>`;
    }

    const siblings = getCollapsedSiblings(flatFields, field.name);
    if (field.name === 'title' || field.component === 'aem-content' || field.name === 'link') {
      return renderCollapsedRow(field, flatFields, multiCount, useSamples, renderOptions);
    }

    if (field.component === 'reference' && siblings[`${field.name}Alt`]) {
      return renderCollapsedRow(field, flatFields, multiCount, useSamples, renderOptions);
    }

    const content = renderFieldContent(field, siblings, multiCount, useSamples, renderOptions);
    return renderRow(content);
  }).join('\n  ');
}

/**
 * @param {object[]} fields
 * @returns {object[]}
 */
function flattenFields(fields) {
  return fields.flatMap((field) => {
    if (field.component === 'tab') {
      return field.fields || [];
    }
    return [field];
  });
}

/**
 * @param {object} model
 * @param {object} options
 * @returns {string}
 */
export function modelToBlockHtml(model, options = {}) {
  const blockClass = options.blockClass || model.id;
  const rows = renderBlockRows(
    model.fields || [],
    options.multiCount ?? 2,
    options.useSamples ?? false,
    options.renderOptions ?? {},
  );
  return `<div class="${escapeHtml(blockClass)}">\n  ${rows}\n</div>`;
}

/**
 * @param {object} itemModel
 * @param {object} options
 * @returns {string}
 */
export function containerBlockToHtml(itemModel, options = {}) {
  const blockClass = options.blockClass || 'block';
  const itemCount = options.itemCount ?? 2;
  const rows = Array.from({ length: itemCount }, () => {
    const cells = getRenderableFields(flattenFields(itemModel.fields || []))
      .map((field) => {
        const siblings = getCollapsedSiblings(itemModel.fields || [], field.name);
        const content = renderFieldContent(
          field,
          siblings,
          options.multiCount ?? 2,
          options.useSamples ?? false,
        );
        return `    <div>\n      ${content}\n    </div>`;
      })
      .join('\n');
    return `  <div>\n${cells}\n  </div>`;
  }).join('\n');

  return `<div class="${escapeHtml(blockClass)}">\n${rows}\n</div>`;
}

/**
 * @param {object} model
 * @returns {string}
 */
export function buttonModelToHtml(model) {
  const fields = model.fields || [];
  const siblings = Object.fromEntries(fields.map((field) => [field.name, field]));
  const link = fields.find((field) => field.component === 'aem-content' || field.name === 'link') || fields[0];
  const content = renderFieldContent(link, siblings, 1, false, { linkAsButton: true });
  return `<p class="button-container">\n  ${content}\n</p>`;
}

/**
 * @param {object} model
 * @param {number} multiCount
 * @param {boolean} useSamples
 * @returns {string}
 */
export function metadataModelToHtml(model, multiCount = 2, useSamples = false) {
  const rows = (model.fields || []).map((field) => {
    const siblings = getCollapsedSiblings(model.fields || [], field.name);
    const content = renderFieldContent(field, siblings, field.multi ? multiCount : 1, useSamples);
    return `    <div>\n      <div>${field.name}</div>\n      <div>${content}</div>\n    </div>`;
  }).join('\n');

  return `<div class="metadata">\n${rows}\n</div>`;
}

/**
 * @param {string} contentHtml
 * @param {'block'|'button'|'metadata'|'container'} mode
 * @returns {string}
 */
export function wrapPreviewMainContent(contentHtml, mode = 'block') {
  if (mode === 'button') {
    return `<div class="section">\n    ${contentHtml}\n  </div>`;
  }
  return `<div class="section">\n    ${contentHtml}\n  </div>`;
}

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.contentHtml
 * @param {'block'|'button'|'metadata'|'container'} [options.mode]
 * @param {string} [options.headHtml]
 * @param {string} [options.lang]
 * @returns {string}
 */
export function buildPreviewPageHtml({
  title,
  contentHtml,
  mode = 'block',
  headHtml = '',
  lang = 'en',
}) {
  const mainContent = wrapPreviewMainContent(contentHtml, mode);
  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <title>${escapeHtml(title)}</title>
${headHtml}
</head>
<body>
  <header></header>
  <main>
    ${mainContent}
  </main>
  <footer></footer>
</body>
</html>
`;
}

/**
 * @param {object} model
 * @param {object} context
 * @returns {string}
 */
export function modelToPreviewPage(model, context = {}) {
  const resourceType = context.resourceType || '';
  const mode = context.mode || inferMode(resourceType, model.id, context);
  const contentHtml = modelToHtml(model, context);
  const title = context.title || model.id;

  return buildPreviewPageHtml({
    title: `${title} preview`,
    contentHtml,
    mode,
    headHtml: context.headHtml || '',
    lang: context.lang || 'en',
  });
}

/**
 * @param {object} model
 * @param {object} context
 * @returns {string}
 */
export function modelToHtml(model, context = {}) {
  const resourceType = context.resourceType || '';
  const mode = context.mode || inferMode(resourceType, model.id, context);

  switch (mode) {
    case 'button':
      return buttonModelToHtml(model);
    case 'metadata':
      return metadataModelToHtml(model, context.multiCount, context.useSamples);
    case 'container':
      return containerBlockToHtml(model, context);
    case 'block':
    default:
      return modelToBlockHtml(model, context);
  }
}

/**
 * @param {string} resourceType
 * @param {string} modelId
 * @param {object} context
 * @returns {'block'|'button'|'metadata'|'container'}
 */
function inferMode(resourceType, modelId, context) {
  if (context.mode) return context.mode;
  if (modelId.endsWith('-metadata') || modelId === 'page-metadata') return 'metadata';
  if (resourceType.includes('/button/')) return 'button';
  if (context.container) return 'container';
  return 'block';
}

/**
 * @param {object} fileJson
 * @param {string} modelId
 * @returns {{ model: object, definition?: object, filter?: object }}
 */
export function resolveModelFromFile(fileJson, modelId) {
  const models = fileJson.models || (fileJson.id ? [fileJson] : []);
  const model = models.find((entry) => entry.id === modelId);
  if (!model) {
    throw new Error(`Model "${modelId}" not found in file`);
  }

  const definition = (fileJson.definitions || []).find((entry) => {
    const template = entry.plugins?.xwalk?.page?.template;
    return entry.id === modelId || template?.model === modelId;
  });

  const filter = (fileJson.filters || []).find((entry) => entry.id === definition?.plugins?.xwalk?.page?.template?.filter);

  return { model, definition, filter };
}
