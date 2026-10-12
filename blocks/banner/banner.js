import { loadCSS } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";
import decorateBento from "../bento/bento.js";
import decorateCarousel from "../carousel/carousel.js";

/**
 * Banner: header (subtitle, title, CTA) + layout variant (bento | carousel).
 * Nested bento/carousel blocks render the authored slides.
 */

/**
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell?.textContent.trim() || "";
}

/**
 * @param {Element} row
 * @returns {boolean}
 */
function isSlideRow(row) {
  const model = row.getAttribute("data-aue-model")
    || row.querySelector("[data-aue-model]")?.getAttribute("data-aue-model");
  if (model === "banner-slide") return true;
  return Boolean(row.querySelector("picture, img"));
}

/**
 * @param {Element} row
 * @returns {object} slide cell references
 */
function parseSlideCells(row) {
  const cells = [...row.children];
  const image = cells.find((cell) => cell.querySelector("picture, img")) || cells[0];
  const remaining = cells.filter((cell) => cell !== image);
  const link = [...remaining].reverse().find((cell) => cell.querySelector("a"))
    || remaining[remaining.length - 1];
  const textCells = remaining.filter((cell) => cell !== link);
  // banner-slide order after image: badge, title, description
  return {
    image,
    badge: textCells[0],
    title: textCells[1],
    description: textCells[2],
    link,
  };
}

/**
 * @param {Element|undefined} source
 * @returns {HTMLElement}
 */
function cloneCell(source) {
  const cell = document.createElement("div");
  if (source) {
    cell.innerHTML = source.innerHTML;
  }
  return cell;
}

/**
 * @param {Element[]} slideRows
 * @returns {HTMLElement[]}
 */
function toBentoRows(slideRows) {
  return slideRows.map((row) => {
    const {
      image, badge, title, link,
    } = parseSlideCells(row);
    const itemRow = document.createElement("div");
    itemRow.append(cloneCell(image), cloneCell(badge), cloneCell(title), cloneCell(link));
    moveInstrumentation(row, itemRow);
    return itemRow;
  });
}

/**
 * @param {Element[]} slideRows
 * @returns {HTMLElement[]}
 */
function toCarouselSlideRows(slideRows) {
  return slideRows.map((row) => {
    const {
      image, title, description, link,
    } = parseSlideCells(row);
    const itemRow = document.createElement("div");
    itemRow.append(
      cloneCell(image),
      cloneCell(title),
      cloneCell(description),
      cloneCell(link),
    );
    moveInstrumentation(row, itemRow);
    return itemRow;
  });
}

/**
 * @param {Element|undefined} subtitleSrc
 * @param {Element|undefined} titleSrc
 * @param {Element|undefined} buttonSrc
 * @returns {HTMLElement}
 */
function buildHeader(subtitleSrc, titleSrc, buttonSrc) {
  const header = document.createElement("div");
  header.className = "banner-header";

  if (cellText(subtitleSrc)) {
    const subtitle = document.createElement("p");
    subtitle.className = "banner-subtitle";
    subtitle.textContent = cellText(subtitleSrc);
    moveInstrumentation(subtitleSrc, subtitle);
    header.append(subtitle);
  }

  if (cellText(titleSrc)) {
    const title = document.createElement("h2");
    title.className = "banner-title";
    title.textContent = cellText(titleSrc);
    moveInstrumentation(titleSrc, title);
    header.append(title);
  }

  const buttonLink = buttonSrc?.querySelector("a");
  if (buttonLink) {
    const actions = document.createElement("div");
    actions.className = "banner-actions";
    buttonLink.className = "banner-cta";
    if (!cellText(buttonLink)) buttonLink.textContent = "Discover All";
    moveInstrumentation(buttonSrc, buttonLink);
    actions.append(buttonLink);
    header.append(actions);
  }

  return header;
}

/**
 * Mount a nested block without decorateBlock (avoids section class side-effects).
 * @param {HTMLElement} host
 * @param {string} blockName
 * @param {HTMLElement[]} rows
 */
async function mountNestedBlock(host, blockName, rows) {
  const wrapper = document.createElement("div");
  wrapper.className = `banner-media banner-media-${blockName} ${blockName}-wrapper`;

  const nested = document.createElement("div");
  nested.className = `${blockName} block`;
  nested.dataset.blockName = blockName;
  nested.dataset.blockStatus = "initialized";
  rows.forEach((row) => nested.append(row));
  wrapper.append(nested);
  host.append(wrapper);

  await loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`);
  const decorateFn = blockName === "carousel" ? decorateCarousel : decorateBento;
  await decorateFn(nested);
  nested.dataset.blockStatus = "loaded";
}

/**
 * @param {Element} block
 */
export default async function decorate(block) {
  const layout = block.classList.contains("carousel") ? "carousel" : "bento";
  const rows = [...block.children];
  const slideRows = rows.filter(isSlideRow);
  const metaRows = rows.filter((row) => !isSlideRow(row));

  // Parent fields render as single-cell rows: subtitle, title, link
  // (layout/classes is applied on the block and should not be treated as copy)
  const sources = metaRows
    .map((row) => (row.children.length === 1 ? row.children[0] : row))
    .filter((cell) => {
      const text = cellText(cell).toLowerCase();
      return text !== "bento" && text !== "carousel";
    });
  const subtitleSrc = sources[0];
  const titleSrc = sources[1];
  const buttonSrc = sources.find((cell) => cell.querySelector("a")) || sources[2];

  const header = buildHeader(subtitleSrc, titleSrc, buttonSrc);
  const mediaHost = document.createElement("div");
  mediaHost.className = "banner-body";

  block.replaceChildren(header, mediaHost);

  if (layout === "carousel") {
    // Banner already renders the section header; carousel only gets slides
    await mountNestedBlock(mediaHost, "carousel", toCarouselSlideRows(slideRows));
    return;
  }

  await mountNestedBlock(mediaHost, "bento", toBentoRows(slideRows));
}
