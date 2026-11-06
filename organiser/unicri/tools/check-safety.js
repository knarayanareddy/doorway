/**
 * Safety check for the Stop Before It Starts repository.
 *
 * This tool enforces the safety rules from SAFETY.md:
 * 1. Only test-trigger-* prefixed terms are allowed as trigger entries
 * 2. No suspicious trigger/term/keyword list files outside allowed locations
 * 3. JSON data files validate against their schemas
 *
 * IMPORTANT: This file does NOT contain any real abuse-related terms.
 * It works exclusively by allow-listing the "test-trigger-" prefix.
 *
 * Run: npm run check
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const TRIGGER_PREFIX = 'test-trigger-';

// Files that are allowed to contain trigger entries
const ALLOWED_TRIGGER_FILES = new Set([
  'mock-platform/fake-triggers.json',
]);

// File name patterns that look like trigger/term/keyword lists
const SUSPICIOUS_FILE_PATTERNS = [
  /terms/i,
  /keywords/i,
  /triggers/i,
  /blocklist/i,
  /wordlist/i,
  /search.?list/i,
];

// File extensions to scan for trigger entries
const SCAN_EXTENSIONS = new Set(['.json']);

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist']);

let errors = [];

/**
 * Recursively collect all file paths under a directory.
 */
async function walkDir(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...await walkDir(fullPath));
      }
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Check 1: Validate that fake-triggers.json only contains test-trigger-* entries.
 */
async function checkTriggerFiles(files) {
  for (const filePath of files) {
    const rel = relative(ROOT, filePath).replace(/\\/g, '/');
    if (!ALLOWED_TRIGGER_FILES.has(rel)) continue;

    try {
      const content = JSON.parse(await readFile(filePath, 'utf-8'));
      const triggers = Array.isArray(content) ? content : [];

      for (const entry of triggers) {
        const term = typeof entry === 'string' ? entry : entry.term;
        if (typeof term !== 'string' || !term.startsWith(TRIGGER_PREFIX)) {
          errors.push(
            `FAIL [trigger-prefix] ${rel}: "${term}" does not start with "${TRIGGER_PREFIX}"`
          );
        }
      }
    } catch (e) {
      errors.push(`FAIL [parse] ${rel}: could not parse JSON — ${e.message}`);
    }
  }
}

/**
 * Check 2: Flag suspicious file names that look like term/keyword lists.
 */
async function checkSuspiciousFiles(files) {
  for (const filePath of files) {
    const rel = relative(ROOT, filePath).replace(/\\/g, '/');
    if (ALLOWED_TRIGGER_FILES.has(rel)) continue;

    const name = basename(filePath);
    const ext = extname(filePath).toLowerCase();

    // Only flag data-like files
    if (!['.json', '.csv', '.txt', '.tsv'].includes(ext)) continue;

    for (const pattern of SUSPICIOUS_FILE_PATTERNS) {
      if (pattern.test(name)) {
        errors.push(
          `FAIL [suspicious-file] ${rel}: file name matches pattern ${pattern} — ` +
          `if this is intentional, add it to ALLOWED_TRIGGER_FILES in check-safety.js`
        );
        break;
      }
    }
  }
}

/**
 * Check 3: Validate JSON data files against their schemas.
 */
async function checkSchemas(files) {
  const ajv = new Ajv({ allErrors: true, strict: false, logger: false });

  // Map data files to their schemas
  const schemaMap = {
    'data/help-services.json': 'contract/schemas/help-services.schema.json',
    'data/message-blocks.json': 'contract/schemas/message-blocks.schema.json',
    'data/legal-confidentiality.json': 'contract/schemas/legal-confidentiality.schema.json',
    'mock-platform/fake-triggers.json': 'contract/schemas/trigger-event.schema.json',
  };

  for (const [dataRel, schemaRel] of Object.entries(schemaMap)) {
    const dataPath = join(ROOT, dataRel);
    const schemaPath = join(ROOT, schemaRel);

    try {
      await stat(dataPath);
    } catch {
      // Data file does not exist yet — skip (will be created in later stages)
      continue;
    }

    try {
      await stat(schemaPath);
    } catch {
      // Schema does not exist yet — skip
      continue;
    }

    try {
      const schema = JSON.parse(await readFile(schemaPath, 'utf-8'));
      const data = JSON.parse(await readFile(dataPath, 'utf-8'));
      // Remove $schema keyword so Ajv does not try to resolve the meta-schema URI
      delete schema.$schema;
      const validate = ajv.compile(schema);
      const valid = validate(data);

      if (!valid) {
        const details = validate.errors
          .map(e => `  ${e.instancePath || '/'}: ${e.message}`)
          .join('\n');
        errors.push(`FAIL [schema] ${dataRel} does not match ${schemaRel}:\n${details}`);
      }
    } catch (e) {
      errors.push(`FAIL [schema] Could not validate ${dataRel}: ${e.message}`);
    }
  }
}

/**
 * Main entry point.
 */
async function main() {
  console.log('Running safety checks...\n');

  const files = await walkDir(ROOT);

  await checkTriggerFiles(files);
  await checkSuspiciousFiles(files);
  await checkSchemas(files);

  if (errors.length > 0) {
    console.error(`\n${errors.length} safety check(s) failed:\n`);
    for (const err of errors) {
      console.error(`  ${err}\n`);
    }
    process.exit(1);
  }

  console.log('All safety checks passed.');
}

main();
