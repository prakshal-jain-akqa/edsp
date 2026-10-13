import { loadCSS } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";
import decorateBento from "../bento/bento.js";
import decorateCarousel from "../carousel/carousel.js";

/**
 * Banner = header fields + nestable media items (Carousel / Bento).
 * Media children are block/items so Universal Editor can show + for slides.
 */

const MEDIA_TYPES = {
  "banner-carousel": "carousel",
  carousel: "carousel",
  "banner-bento": "bento",
  bento: "bento",
};

const DECORATORS = {
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
 * @returns {string|null} 'carousel' | 'bento' | null
 */
function mediaTypeOf(el) {
  if (!el) return null;

  if (el.classList.contains("carousel")) return "carousel";
  if (el.classList.contains("bento")) return "bento";

  const model = el.getAttribute("data-aue-model")
    || el.querySelector(":scope > [data-aue-model]")?.getAttribute("data-aue-model");
  if (model && MEDIA_TYPES[model]) return MEDIA_TYPES[model];

  const label = (el.getAttribute("data-aue-label") || "").toLowerCase();
  if (label === "carousel" || label === "bento") return label;

  const filter = el.getAttribute("data-aue-filter") || "";
  if (filter === "banner-carousel" || filter === "carousel") return "carousel";
  if (filter === "banner-bento" || filter === "bento") return "bento";

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
 * Keep the authored media node as the block root so UE filter/+ stay attached.
 * @param {HTMLElement} host
 * @param {HTMLElement} mediaEl
 * @param {string} blockName
 */
async function loadMediaBlock(host, mediaEl, blockName) {
  const wrapper = document.createElement("div");
  wrapper.className = `banner-media banner-media-${blockName} ${blockName}-wrapper`;

  mediaEl.classList.add(blockName, "block");
  mediaEl.dataset.blockName = blockName;
  mediaEl.dataset.blockStatus = "initialized";

  // Preserve / restore container instrumentation for +
  const filterId = blockName === "carousel" ? "banner-carousel" : "banner-bento";
  if (!mediaEl.getAttribute("data-aue-filter")) {
    mediaEl.setAttribute("data-aue-filter", filterId);
  }
  if (!mediaEl.getAttribute("data-aue-type")) {
    mediaEl.setAttribute("data-aue-type", "container");
  }

  wrapper.append(mediaEl);
  host.append(wrapper);

  await loadCSS(`${window.hlx.codeBasePath}/blocks/${blockName}/${blockName}.css`);
  await DECORATORS[blockName](mediaEl);
  mediaEl.dataset.blockStatus = "loaded";
}

/**
 * @param {Element} block
 */
export default async function decorate(block) {
  const children = [...block.children];
  const mediaEntries = [];
  const metaRows = [];

  children.forEach((child) => {
    const type = mediaTypeOf(child);
    if (type) {
      mediaEntries.push({ el: /** @type {HTMLElement} */ (child), type });
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
    mediaEntries.map(({ el, type }) => loadMediaBlock(body, el, type)),
  );
}
