import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * @param {Element} row
 * @returns {boolean}
 */
function isSlideRow(row) {
  return Boolean(row.querySelector('picture, img'));
}

/**
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell?.textContent.trim() || '';
}

/**
 * @param {Element} cell
 * @returns {HTMLAnchorElement|null}
 */
function findLink(cell) {
  return cell?.querySelector('a') || null;
}

/**
 * @param {number} index
 * @param {number} length
 * @returns {number}
 */
function wrapIndex(index, length) {
  if (!length) return 0;
  return ((index % length) + length) % length;
}

/**
 * Build the header from the first non-slide rows (eyebrow, title, CTA).
 * @param {Element[]} headerRows
 * @returns {HTMLElement}
 */
function buildHeader(headerRows) {
  const header = document.createElement('div');
  header.className = 'carousel-header';

  const copy = document.createElement('div');
  copy.className = 'carousel-copy';

  const [eyebrowRow, titleRow, ctaRow] = headerRows;
  const eyebrowCell = eyebrowRow?.firstElementChild;
  const titleCell = titleRow?.firstElementChild;
  const ctaCell = ctaRow?.firstElementChild;

  if (cellText(eyebrowCell)) {
    const eyebrow = document.createElement('p');
    eyebrow.className = 'carousel-eyebrow';
    eyebrow.textContent = cellText(eyebrowCell);
    moveInstrumentation(eyebrowCell, eyebrow);
    copy.append(eyebrow);
  }

  if (cellText(titleCell)) {
    const title = document.createElement('h2');
    title.className = 'carousel-title';
    title.textContent = cellText(titleCell);
    moveInstrumentation(titleCell, title);
    copy.append(title);
  }

  header.append(copy);

  const ctaLink = findLink(ctaCell);
  if (ctaLink) {
    const actions = document.createElement('div');
    actions.className = 'carousel-actions';
    ctaLink.className = 'carousel-discover';
    moveInstrumentation(ctaCell, ctaLink);
    actions.append(ctaLink);
    header.append(actions);
  }

  return header;
}

/**
 * @param {Element} row
 * @returns {HTMLElement}
 */
function buildSlide(row) {
  const slide = document.createElement('article');
  slide.className = 'carousel-slide';
  slide.setAttribute('role', 'group');
  moveInstrumentation(row, slide);

  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture, img')) || cells[0];
  const remaining = cells.filter((cell) => cell !== imageCell);
  const linkCell = remaining.find((cell) => cell.querySelector('a'));
  const textCells = remaining.filter((cell) => cell !== linkCell);
  const titleCell = textCells[0];
  const descriptionCell = textCells[1];

  const media = document.createElement('div');
  media.className = 'carousel-media';
  const img = imageCell?.querySelector('img');
  if (img) {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '1200' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    media.append(optimized);
  }
  if (imageCell) moveInstrumentation(imageCell, media);
  slide.append(media);

  const overlay = document.createElement('div');
  overlay.className = 'carousel-overlay';

  const content = document.createElement('div');
  content.className = 'carousel-content';

  if (titleCell && cellText(titleCell)) {
    const title = document.createElement('h3');
    title.className = 'carousel-slide-title';
    title.textContent = cellText(titleCell);
    moveInstrumentation(titleCell, title);
    content.append(title);
  }

  if (descriptionCell && cellText(descriptionCell)) {
    const description = document.createElement('div');
    description.className = 'carousel-slide-description';
    description.append(...descriptionCell.childNodes);
    moveInstrumentation(descriptionCell, description);
    content.append(description);
  }

  overlay.append(content);

  const link = findLink(linkCell);
  if (link) {
    link.className = 'carousel-view';
    moveInstrumentation(linkCell, link);
    overlay.append(link);
  }

  slide.append(overlay);
  return slide;
}

/**
 * Infinite loop carousel navigation.
 * @param {HTMLElement} track
 * @param {HTMLElement[]} slides
 * @param {HTMLButtonElement} prevBtn
 * @param {HTMLButtonElement} nextBtn
 */
function enableCarousel(track, slides, prevBtn, nextBtn) {
  let index = 0;

  const goTo = (nextIndex) => {
    index = wrapIndex(nextIndex, slides.length);

    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });

    const active = slides[index];
    if (!active) return;

    const trackRect = track.getBoundingClientRect();
    const slideRect = active.getBoundingClientRect();
    const offset = (slideRect.left + slideRect.width / 2)
      - (trackRect.left + trackRect.width / 2)
      + track.scrollLeft;
    track.scrollTo({ left: offset, behavior: 'smooth' });
  };

  prevBtn.addEventListener('click', () => goTo(index - 1));
  nextBtn.addEventListener('click', () => goTo(index + 1));

  slides.forEach((slide, i) => {
    slide.addEventListener('click', (event) => {
      if (event.target.closest('a')) return;
      if (i === index) return;
      goTo(i);
    });
  });

  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    }
  });

  goTo(0);
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const firstSlideIndex = rows.findIndex(isSlideRow);
  const headerRows = firstSlideIndex === -1 ? rows : rows.slice(0, firstSlideIndex);
  const slideRows = firstSlideIndex === -1 ? [] : rows.slice(firstSlideIndex);

  const header = buildHeader(headerRows);

  const stage = document.createElement('div');
  stage.className = 'carousel-stage';

  const track = document.createElement('div');
  track.className = 'carousel-track';
  track.setAttribute('tabindex', '0');
  track.setAttribute('role', 'region');
  track.setAttribute('aria-roledescription', 'carousel');
  track.setAttribute('aria-label', cellText(headerRows[1]?.firstElementChild) || 'Carousel');

  const slides = slideRows.map(buildSlide);
  slides.forEach((slide) => track.append(slide));

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'carousel-nav carousel-nav-prev';
  prevBtn.setAttribute('aria-label', 'Previous slide');
  prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'carousel-nav carousel-nav-next';
  nextBtn.setAttribute('aria-label', 'Next slide');
  nextBtn.innerHTML = '<span aria-hidden="true">›</span>';

  stage.append(track, prevBtn, nextBtn);
  block.replaceChildren(header, stage);

  if (slides.length) {
    enableCarousel(track, slides, prevBtn, nextBtn);
  } else {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
  }
}
