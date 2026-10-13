import { loadCSS } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";
import decorateBento from "../bento/bento.js";
import decorateCarousel from "../carousel/carousel.js";

/**
 * Banner = section header + a dropped nested block (Carousel or Bento).
 */

const NESTED_BLOCKS = {
  carousel: decorateCarousel,
  bento: decorateBento,
};

/**
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell?.textContent.trim() || "";
}

/**
 * @param {Element} el
 * @returns {string|null}
 */
function nestedBlockName(el) {
  if (!el) return null;

  const classMatch = Object.keys(NESTED_BLOCKS).find((name) => el.classList.contains(name));
  if (classMatch) return classMatch;

  const model = el.getAttribute("data-aue-model")
    || el.querySelector(":scope > [data-aue-model]")?.getAttribute("data-aue-model");
  if (model && NESTED_BLOCKS[model]) return model;

  const label = (el.getAttribute("data-aue-label") || "").toLowerCase();
  if (label === "carousel" || label === "bento") return label;

  const inner = el.querySelector(":scope > .carousel, :scope > .bento");
  if (inner) {
    return Object.keys(NESTED_BLOCKS).find((name) => inner.classList.contains(name)) || null;
  }

  return null;
}

/**
 * Resolve the element that should be decorated as the nested block.
 * UE often inserts components with data-aue-model before the block class exists.
 * @param {Element} row
 * @returns {{ nested: HTMLElement, name: string }|null}
 */
function findNestedBlock(row) {
  const directName = nestedBlockName(row);
  if (directName) {
    if (row.classList.contains(directName)) {
      return { nested: /** @type {HTMLElement} */ (row), name: directName };
    }
    const inner = row.querySelector(`:scope > .${directName}`);
    if (inner) {
      return { nested: /** @type {HTMLElement} */ (inner), name: directName };
    }
    // Fresh UE insert: model/label present, class not yet applied
    return { nested: /** @type {HTMLElement} */ (row), name: directName };
  }

  const wrapped = row.querySelector(":scope > .carousel, :scope > .bento");
  if (wrapped) {
    const name = Object.keys(NESTED_BLOCKS).find((n) => wrapped.classList.contains(n));
    if (name) return { nested: /** @type {HTMLElement} */ (wrapped), name };
  }

  return null;
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
 * @param {HTMLElement} host
 * @param {HTMLElement} nested
 * @param {string} blockName
 * @param {Element} [hostRow]
 */
async function loadNestedBlock(host, nested, blockName, hostRow) {
  const wrapper = document.createElement("div");
  wrapper.className = `banner-media banner-media-${blockName} ${blockName}-wrapper`;

  // Ensure block class exists (UE inserts may only have data-aue-model)
  nested.classList.add(blockName, "block");
  nested.dataset.blockName = blockName;
  nested.dataset.blockStatus = "initialized";

  if (hostRow && hostRow !== nested) {
    moveInstrumentation(hostRow, nested);
  }

  wrapper.append(nested);
  host.append(wrapper);

  await loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`);
  await NESTED_BLOCKS[blockName](nested);
  nested.dataset.blockStatus = "loaded";
}

/**
 * @param {Element} block
 */
export default async function decorate(block) {
  const children = [...block.children];
  const nestedEntries = [];
  const metaRows = [];

  children.forEach((child) => {
    const found = findNestedBlock(child);
    if (found) {
      nestedEntries.push({ ...found, hostRow: child });
    } else {
      metaRows.push(child);
    }
  });

  const sources = metaRows.map((row) => (
    row.children.length === 1 ? row.children[0] : row
  ));
  const subtitleSrc = sources[0];
  const titleSrc = sources[1];
  const buttonSrc = sources.find((cell) => cell.querySelector("a")) || sources[2];

  const header = buildHeader(subtitleSrc, titleSrc, buttonSrc);
  const body = document.createElement("div");
  body.className = "banner-body";

  block.replaceChildren(header, body);

  await Promise.all(
    nestedEntries.map(({ nested, name, hostRow }) => (
      loadNestedBlock(body, nested, name, hostRow)
    )),
  );
}
