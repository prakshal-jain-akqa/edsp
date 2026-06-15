/**
 * The Metadata block is processed server-side by the EDS pipeline.
 * @param {Element} block The metadata block element
 */
export default function decorate(block) {
  block.classList.add('metadata-processed');
}
