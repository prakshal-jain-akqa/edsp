import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * AEM renders one model field per block row: block > div(row) > div(cell) > content.
 * @param {Element} row
 * @returns {Element|undefined}
 */
function getRowCell(row) {
  return row?.firstElementChild ?? undefined;
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const [
    titleRow,
    descriptionRow,
    submitLabelRow,
    endpointRow,
  ] = [...block.children];

  const titleCell = getRowCell(titleRow);
  const descriptionCell = getRowCell(descriptionRow);
  const submitLabelCell = getRowCell(submitLabelRow);
  const endpointCell = getRowCell(endpointRow);

  const title = titleCell?.textContent.trim() || '';
  const submitLabel = submitLabelCell?.textContent.trim() || 'Subscribe';
  const endpoint = endpointCell?.textContent.trim() || '';

  const heading = document.createElement('h2');
  heading.className = 'subscribe-title';
  heading.textContent = title;
  if (titleCell) moveInstrumentation(titleCell, heading);

  const description = document.createElement('div');
  description.className = 'subscribe-description';
  if (descriptionCell) {
    description.append(...descriptionCell.childNodes);
    moveInstrumentation(descriptionCell, description);
  }

  const form = document.createElement('form');
  form.className = 'subscribe-form';
  form.setAttribute('novalidate', '');

  const field = document.createElement('div');
  field.className = 'subscribe-field';

  const label = document.createElement('label');
  label.className = 'subscribe-label';

  const labelText = document.createElement('span');
  labelText.className = 'subscribe-label-text';
  labelText.textContent = 'Email';

  const input = document.createElement('input');
  input.type = 'email';
  input.name = 'email';
  input.required = true;
  input.autocomplete = 'email';
  input.placeholder = 'Email';
  input.setAttribute('aria-label', 'Email');
  label.append(labelText, input);
  field.append(label);

  const button = document.createElement('button');
  button.type = 'submit';
  button.className = 'subscribe-button';
  button.textContent = submitLabel;
  if (submitLabelCell) moveInstrumentation(submitLabelCell, button);

  form.append(field, button);

  if (endpoint) {
    form.action = endpoint;
    form.method = 'post';
  } else {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });
  }

  block.replaceChildren(heading, description, form);
}
