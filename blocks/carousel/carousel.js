import { createOptimizedPicture } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";

/**
 * Container block with top-level model + slide children:
 * - Parent properties (heading, subheading, button) → single-cell rows
 * - Optional legacy carousel-header item → one multi-cell row
 * - Slide items → multi-cell rows with an image
 */

/**
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell?.textContent.trim() || "";
}

/**
 * @param {Element} cell
 * @returns {HTMLAnchorElement|null}
 */
function findLink(cell) {
  return cell?.querySelector("a") || null;
}

/**
 * @param {Element} row
 * @returns {string|null}
 */
function rowModel(row) {
  return (
    row.getAttribute("data-aue-model")
    || row.querySelector("[data-aue-model]")?.getAttribute("data-aue-model")
    || null
  );
}

/**
 * @param {Element} row
 * @returns {boolean}
 */
function isSlideRow(row) {
  const model = rowModel(row);
  if (model === "slide") return true;
  if (model === "carousel-header") return false;
  return Boolean(row.querySelector("picture, img"));
}

/**
 * Unwrap a single-cell row to its cell, or return the row itself.
 * @param {Element} row
 * @returns {Element}
 */
function rowCell(row) {
  const cells = [...row.children];
  return cells.length === 1 ? cells[0] : row;
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
 * @param {Element|undefined} headingSrc
 * @param {Element|undefined} subheadingSrc
 * @param {Element|undefined} buttonSrc
 * @param {Element|undefined} instrumentationSrc
 * @returns {HTMLElement}
 */
function buildHeader(headingSrc, subheadingSrc, buttonSrc, instrumentationSrc) {
  const header = document.createElement("div");
  header.className = "carousel-header";

  const copy = document.createElement("div");
  copy.className = "carousel-copy";
  header.append(copy);

  if (instrumentationSrc) moveInstrumentation(instrumentationSrc, header);

  if (cellText(subheadingSrc)) {
    const subheading = document.createElement("p");
    subheading.className = "carousel-subheading";
    subheading.textContent = cellText(subheadingSrc);
    moveInstrumentation(subheadingSrc, subheading);
    copy.append(subheading);
  }

  if (cellText(headingSrc)) {
    const heading = document.createElement("h2");
    heading.className = "carousel-heading";
    heading.textContent = cellText(headingSrc);
    moveInstrumentation(headingSrc, heading);
    copy.append(heading);
  }

  const buttonLink = findLink(buttonSrc);
  if (buttonLink) {
    const actions = document.createElement("div");
    actions.className = "carousel-actions";
    buttonLink.className = "carousel-discover";
    if (!cellText(buttonLink) && buttonSrc) {
      const textOnly = [...buttonSrc.children].find(
        (el) => el !== buttonLink && cellText(el),
      );
      if (textOnly) buttonLink.textContent = cellText(textOnly);
      else if (cellText(buttonSrc) !== buttonLink.href) {
        const leftover = cellText(buttonSrc);
        if (leftover && leftover !== buttonLink.textContent) {
          buttonLink.textContent = leftover;
        }
      }
    }
    if (!cellText(buttonLink)) buttonLink.textContent = "Discover All";
    moveInstrumentation(buttonSrc, buttonLink);
    actions.append(buttonLink);
    header.append(actions);
  }

  return header;
}

/**
 * Resolve header fields from either:
 * - one multi-cell carousel-header row, or
 * - leading single-cell rows (heading, subheading, button) before slides
 * @param {Element[]} rows
 * @returns {object} header field sources plus slideRows
 */
function partitionRows(rows) {
  const slideRows = rows.filter(isSlideRow);
  const nonSlideRows = rows.filter((row) => !isSlideRow(row));

  const headerItem = nonSlideRows.find(
    (row) => rowModel(row) === "carousel-header" || row.children.length > 1,
  );

  if (headerItem && headerItem.children.length > 1) {
    const cells = [...headerItem.children];
    const buttonCell = cells.find((cell) => cell.querySelector("a")) || cells[2];
    return {
      headingSrc: cells[0],
      subheadingSrc: cells[1],
      buttonSrc: buttonCell,
      instrumentationSrc: headerItem,
      slideRows,
    };
  }

  // Flat / one-field-per-row header (current AEM output)
  const sources = nonSlideRows.map(rowCell);
  return {
    headingSrc: sources[0],
    subheadingSrc: sources[1],
    buttonSrc: sources.find((cell) => cell.querySelector("a")) || sources[2],
    instrumentationSrc: nonSlideRows[0],
    slideRows,
  };
}

/**
 * Slide cells: image (+alt), title, description, link (+text).
 * @param {Element} row
 * @returns {HTMLElement}
 */
function buildSlide(row) {
  const slide = document.createElement("article");
  slide.className = "carousel-slide";
  slide.setAttribute("role", "group");
  moveInstrumentation(row, slide);

  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector("picture, img")) || cells[0];
  const remaining = cells.filter((cell) => cell !== imageCell);
  // Prefer the last cell with a link (CTA), not links inside description
  const linkCell = [...remaining].reverse().find((cell) => cell.querySelector("a"))
    || remaining[remaining.length - 1];
  const textCells = remaining.filter((cell) => cell !== linkCell);
  const titleCell = textCells[0];
  const descriptionCell = textCells[1];

  const media = document.createElement("div");
  media.className = "carousel-media";
  const img = imageCell?.querySelector("img");
  if (img) {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [
      { width: "1200" },
    ]);
    moveInstrumentation(img, optimized.querySelector("img"));
    media.append(optimized);
  }
  if (imageCell) moveInstrumentation(imageCell, media);
  slide.append(media);

  const overlay = document.createElement("div");
  overlay.className = "carousel-overlay";

  const content = document.createElement("div");
  content.className = "carousel-content";

  if (titleCell && cellText(titleCell)) {
    const title = document.createElement("h3");
    title.className = "carousel-slide-title";
    title.textContent = cellText(titleCell);
    moveInstrumentation(titleCell, title);
    content.append(title);
  }

  if (descriptionCell && cellText(descriptionCell)) {
    const description = document.createElement("div");
    description.className = "carousel-slide-description";
    description.append(...descriptionCell.childNodes);
    moveInstrumentation(descriptionCell, description);
    content.append(description);
  }

  overlay.append(content);

  const link = findLink(linkCell);
  if (link) {
    link.className = "carousel-view";
    if (!cellText(link)) link.textContent = "View";
    if (linkCell) moveInstrumentation(linkCell, link);
    overlay.append(link);
  }

  slide.append(overlay);
  return slide;
}

/**
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
      slide.classList.toggle("is-active", i === index);
      slide.setAttribute("aria-hidden", i === index ? "false" : "true");
    });

    const active = slides[index];
    if (!active) return;

    const trackRect = track.getBoundingClientRect();
    const slideRect = active.getBoundingClientRect();
    const offset = slideRect.left
      + slideRect.width / 2
      - (trackRect.left + trackRect.width / 2)
      + track.scrollLeft;
    track.scrollTo({ left: offset, behavior: "smooth" });
  };

  prevBtn.addEventListener("click", () => goTo(index - 1));
  nextBtn.addEventListener("click", () => goTo(index + 1));

  slides.forEach((slide, i) => {
    slide.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      if (i === index) return;
      goTo(i);
    });
  });

  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    }
    if (event.key === "ArrowRight") {
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
  const {
    headingSrc,
    subheadingSrc,
    buttonSrc,
    instrumentationSrc,
    slideRows,
  } = partitionRows(rows);

  const header = buildHeader(
    headingSrc,
    subheadingSrc,
    buttonSrc,
    instrumentationSrc,
  );

  const stage = document.createElement("div");
  stage.className = "carousel-stage";

  const track = document.createElement("div");
  track.className = "carousel-track";
  track.setAttribute("tabindex", "0");
  track.setAttribute("role", "region");
  track.setAttribute("aria-roledescription", "carousel");
  track.setAttribute(
    "aria-label",
    header.querySelector(".carousel-heading")?.textContent || "Carousel",
  );

  const slides = slideRows.map(buildSlide);
  slides.forEach((slide) => track.append(slide));

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "carousel-nav carousel-nav-prev";
  prevBtn.setAttribute("aria-label", "Previous slide");
  prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "carousel-nav carousel-nav-next";
  nextBtn.setAttribute("aria-label", "Next slide");
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
