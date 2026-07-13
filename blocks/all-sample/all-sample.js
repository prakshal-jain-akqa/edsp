import { moveInstrumentation } from '../../scripts/scripts.js';

/** Renderable field labels in model order (collapsed fields omitted). */
const FIELD_LABELS = [
  'Text',
  'Text Area',
  'Rich Text',
  'Multi Text',
  'Number',
  'Boolean',
  'Date Time',
  'Select',
  'Multiselect',
  'Checkbox Group',
  'Radio Group',
  'Image',
  'Link',
  'AEM Tags',
  'Content Fragment',
  'Experience Fragment',
  'Container Items',
];

/**
 * @param {Element} cell
 * @returns {boolean}
 */
function hasCellContent(cell) {
  if (!cell) return false;
  return Boolean(cell.textContent.trim() || cell.querySelector('a, img, picture, ul, ol'));
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const header = document.createElement('div');
  header.className = 'all-sample-header';
  header.innerHTML = '<h2>All Sample</h2><p>Universal Editor field types rendered from the block model.</p>';

  const grid = document.createElement('div');
  grid.className = 'all-sample-grid';

  [...block.children].forEach((row, index) => {
    const cell = row.firstElementChild;
    if (!cell) return;

    const label = FIELD_LABELS[index] || `Field ${index + 1}`;
    const field = document.createElement('article');
    field.className = 'all-sample-field';
    field.dataset.field = label.toLowerCase().replace(/\s+/g, '-');

    const labelEl = document.createElement('div');
    labelEl.className = 'all-sample-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('div');
    valueEl.className = 'all-sample-value';

    if (hasCellContent(cell)) {
      valueEl.append(...cell.childNodes);
      moveInstrumentation(cell, valueEl);
    } else {
      valueEl.classList.add('is-empty');
      valueEl.textContent = 'Empty';
    }

    field.append(labelEl, valueEl);
    grid.append(field);
  });

  block.replaceChildren(header, grid);
}
