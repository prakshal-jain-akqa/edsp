/**
 * Decorates the title-description block.
 * Handles both labeled rows (Title/Description) and simple two-row content.
 * @param {Element} block The title-description block element
 */
export default function decorate(block) {
  let titleContent;
  let descriptionContent;

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (!cells.length) return;

    if (cells.length > 1) {
      const label = cells[0].textContent.trim().toLowerCase();
      const valueCell = cells[1];

      if (label === 'title' && !titleContent) {
        titleContent = valueCell;
        return;
      }

      if ((label === 'description' || label === 'text') && !descriptionContent) {
        descriptionContent = valueCell;
        return;
      }

      if (!titleContent) titleContent = valueCell;
      else if (!descriptionContent) descriptionContent = valueCell;
      return;
    }

    const [singleCell] = cells;
    if (!titleContent) titleContent = singleCell;
    else if (!descriptionContent) descriptionContent = singleCell;
  });

  const content = document.createElement('div');
  content.className = 'title-description-content';

  if (titleContent) {
    const heading = document.createElement('h2');
    heading.className = 'title-description-title';
    heading.innerHTML = titleContent.innerHTML;
    content.append(heading);
  }

  if (descriptionContent) {
    const description = document.createElement('div');
    description.className = 'title-description-description';
    description.innerHTML = descriptionContent.innerHTML;
    content.append(description);
  }

  block.replaceChildren(content);
}
