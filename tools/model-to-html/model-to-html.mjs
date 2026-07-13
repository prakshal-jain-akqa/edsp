#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  modelToHtml,
  modelToPreviewPage,
  resolveModelFromFile,
} from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const defaultOutputDir = repoRoot;

function printUsage() {
  console.log(`Usage:
  npm run preview:model -- <model-id> [options]

Options:
  --file <path>         Model source JSON (default: auto-discover)
  --container <name>    Render as container block (e.g. cards with card items)
  --items <n>           Container item count (default: 2)
  --multi-count <n>     Sample count for multi:true fields (default: 2)
  --samples             Use field labels when value is missing (default: empty)
  --mode <mode>         Force mode: block | container | button | metadata
  --class <name>        Block class name override
  --output <path>       Preview HTML output path (default: <id>-preview.html at project root)
  --stdout              Print block markup to stdout
  --no-write            Skip writing the preview HTML file

Examples:
  npm run preview:model -- subscribe
  npm run preview:model -- all-sample
  npm run preview:model -- hero --file blocks/hero/_hero.json
  npm run preview:model -- card --file blocks/cards/_cards.json --container cards --items 3
  npm run preview:model -- page-metadata --file models/_page.json --mode metadata

Local preview:
  npx @adobe/aem-cli up
  open http://localhost:3000/<model-id>-preview.html`);
}

/**
 * @param {string} modelId
 * @returns {string|null}
 */
function discoverModelFile(modelId) {
  const candidates = [];

  const blocksDir = path.join(repoRoot, 'blocks');
  if (fs.existsSync(blocksDir)) {
    fs.readdirSync(blocksDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        candidates.push(path.join(blocksDir, entry.name, `_${entry.name}.json`));
      });
  }

  candidates.push(path.join(repoRoot, 'models', `_${modelId}.json`));
  candidates.push(path.join(repoRoot, 'component-models.json'));

  return candidates.find((candidate) => {
    if (!fs.existsSync(candidate)) return false;
    const json = JSON.parse(fs.readFileSync(candidate, 'utf8'));
    const models = json.models || (json.id ? [json] : []);
    return models.some((entry) => entry.id === modelId);
  }) || null;
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function readHeadHtml(filePath) {
  if (!fs.existsSync(filePath)) {
    return [
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
      '  <script src="/scripts/aem.js" type="module"></script>',
      '  <script src="/scripts/scripts.js" type="module"></script>',
      '  <link rel="stylesheet" href="/styles/styles.css">',
    ].join('\n');
  }
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

/**
 * @param {string} blockClass
 * @param {object} options
 * @returns {string}
 */
function defaultOutputPath(blockClass, options) {
  if (options.output) {
    return path.isAbsolute(options.output)
      ? options.output
      : path.join(repoRoot, options.output);
  }
  return path.join(defaultOutputDir, `${blockClass}-preview.html`);
}

/**
 * @param {string[]} args
 * @returns {object}
 */
function parseArgs(args) {
  const options = {
    modelId: null,
    file: null,
    container: null,
    itemCount: 2,
    multiCount: 2,
    useSamples: false,
    mode: null,
    blockClass: null,
    output: null,
    stdout: false,
    noWrite: false,
  };

  const positional = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--file') {
      options.file = args[i += 1];
    } else if (arg === '--container') {
      options.container = args[i += 1];
    } else if (arg === '--items') {
      options.itemCount = Number(args[i += 1]);
    } else if (arg === '--multi-count') {
      options.multiCount = Number(args[i += 1]);
    } else if (arg === '--samples') {
      options.useSamples = true;
    } else if (arg === '--mode') {
      options.mode = args[i += 1];
    } else if (arg === '--class') {
      options.blockClass = args[i += 1];
    } else if (arg === '--output') {
      options.output = args[i += 1];
    } else if (arg === '--stdout') {
      options.stdout = true;
    } else if (arg === '--no-write') {
      options.noWrite = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      positional.push(arg);
    }
  }

  options.modelId = positional[0] || null;
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.modelId) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  const filePath = options.file
    ? path.resolve(options.file)
    : discoverModelFile(options.modelId);

  if (!filePath || !fs.existsSync(filePath)) {
    console.error(`Could not find model file for "${options.modelId}". Use --file.`);
    process.exit(1);
  }

  const fileJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const sourceJson = fileJson;

  const { model, definition, filter } = resolveModelFromFile(sourceJson, options.modelId);
  const resourceType = definition?.plugins?.xwalk?.page?.resourceType || '';
  const mode = options.container ? 'container' : options.mode;
  const blockClass = options.blockClass
    || options.container
    || model.id;

  const context = {
    resourceType,
    mode,
    container: options.container,
    blockClass,
    itemCount: options.itemCount,
    multiCount: options.multiCount,
    useSamples: options.useSamples,
    title: definition?.title || model.id,
    headHtml: readHeadHtml(path.join(repoRoot, 'head.html')),
  };

  const blockHtml = modelToHtml(model, context);
  const pageHtml = modelToPreviewPage(model, context);
  const outputPath = defaultOutputPath(blockClass, options);

  if (!options.noWrite) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, pageHtml);
  }

  if (options.stdout) {
    const notes = [
      `Model: ${model.id}`,
      `Source: ${path.relative(repoRoot, filePath)}`,
      `Mode: ${mode || 'auto'}`,
      filter ? `Container filter: ${filter.id}` : null,
      'Field collapse: Alt, Text, Title, Type, MimeType suffixes merge into base fields',
      'multi:true uses field value once; use --samples to fabricate multiple values',
    ].filter(Boolean);

    console.log('<!--');
    notes.forEach((note) => console.log(`  ${note}`));
    console.log('-->\n');
    console.log(blockHtml);
  }

  if (!options.noWrite) {
    console.log(`Written ${path.relative(repoRoot, outputPath)}`);
    console.log(`Preview: http://localhost:3000/${path.basename(outputPath)}`);
    console.log('Start dev server: npx @adobe/aem-cli up');
  }
}

main();
