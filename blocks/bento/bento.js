import { createOptimizedPicture } from "../../scripts/aem.js";
import { moveInstrumentation } from "../../scripts/scripts.js";

/**
 * @param {Element} cell
 * @returns {string}
 */
function cellText(cell) {
  return cell?.textContent.trim() || "";
}

/**
 * @param {Element} row
 * @returns {HTMLElement}
 */
function buildItem(row) {
  const item = document.createElement("article");
  item.className = "bento-item";
  moveInstrumentation(row, item);

  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector("picture, img")) || cells[0];
  const remaining = cells.filter((cell) => cell !== imageCell);
  const linkCell = [...remaining].reverse().find((cell) => cell.querySelector("a"));
  const textCells = remaining.filter((cell) => cell !== linkCell);
  const badgeCell = textCells[0];
  const titleCell = textCells[1] || textCells[0];

  const media = document.createElement("div");
  media.className = "bento-media";
  const img = imageCell?.querySelector("img");
  if (img) {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [
      { width: "1200" },
    ]);
    moveInstrumentation(img, optimized.querySelector("img"));
    media.append(optimized);
  }
  if (imageCell) moveInstrumentation(imageCell, media);
  item.append(media);

  if (badgeCell && cellText(badgeCell)) {
    const badge = document.createElement("span");
    badge.className = "bento-badge";
    badge.textContent = cellText(badgeCell);
    moveInstrumentation(badgeCell, badge);
    item.append(badge);
  }

  const overlay = document.createElement("div");
  overlay.className = "bento-overlay";

  if (titleCell && cellText(titleCell)) {
    const title = document.createElement("h3");
    title.className = "bento-title";
    title.textContent = cellText(titleCell);
    moveInstrumentation(titleCell, title);
    overlay.append(title);
  }

  const link = linkCell?.querySelector("a");
  if (link) {
    link.className = "bento-link";
    link.setAttribute("aria-label", cellText(titleCell) || link.textContent || "Open");
    // Cover the card for clickability while keeping text visible
    if (!cellText(link) || cellText(link) === link.getAttribute("href")) {
      link.textContent = "";
    }
    moveInstrumentation(linkCell, link);
    item.append(link);
  }

  item.append(overlay);
  return item;
}

/**
 * @param {Element} block
 */
export default function decorate(block) {
  const rows = [...block.children];
  const grid = document.createElement("div");
  grid.className = "bento-grid";

  rows.forEach((row, index) => {
    const item = buildItem(row);
    if (index === 0) item.classList.add("bento-item-featured");
    grid.append(item);
  });

  block.replaceChildren(grid);
}
