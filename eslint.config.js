/**
 * The privacy tripwire (review H3). An AST decides, not a line regex.
 *
 * This is a TRIPWIRE, not proof. It stops the obvious ways a well-meaning or
 * malicious change could add a second channel (XHR, Image beacon, WebSocket,
 * sendBeacon, cookies, geolocation, eval). It cannot see through dynamic access
 * like window['fe'+'tch']. The EVIDENCE is test/e2e/network.spec.js, which records
 * every request the real Door makes in a real browser, and the Door's CSP, which
 * makes the browser refuse anything but same-origin connections.
 *
 * Coverage: the visitor-path rules apply to shipped code (packages/doorway/src,
 * packages/core/src, packages/shared, edge/c.js). Tests and tooling get the rules
 * that still make sense for them, with named per-file exceptions below. prototype/
 * is NOT linted by this config (it is ignored here, and no TypeScript parser is installed). Only its e2e specs are
 * linted, by `npm run lint:prototype`. Its TypeScript is type-checked by `npm --prefix prototype run typecheck` instead.
 */
import js from '@eslint/js';
import globals from 'globals';

const NETWORK = ['XMLHttpRequest', 'Image', 'WebSocket', 'EventSource', 'Audio', 'Worker', 'SharedWorker', 'BroadcastChannel', 'RTCPeerConnection', 'WebTransport'];
const STORAGE = ['sessionStorage', 'indexedDB', 'caches', 'openDatabase', 'cookieStore'];

const restricted = (names, why) => names.map((name) => ({ name, message: why }));

// Beacons: `navigator.sendBeacon` through ANY object (window.navigator, globalThis.navigator?.sendBeacon,
// navigator['sendBeacon']) is caught by property name alone. Only send.js may use it, for the unload record.
const BEACON = { property: 'sendBeacon', message: 'Beacons bypass the validated send path. Only send.js may use the unload beacon.' };

// send.js holds the one legitimate beacon reference: `globalThis.navigator?.sendBeacon?.bind(globalThis.navigator)`,
// the unload record (docs/09). Inside send.js the property rule is replaced by these selectors, which allow exactly
// that reference and flag everything else: a call, a string-keyed access, or a reference through any other object.
const SEND_BEACON_ONLY = [
  { selector: "MemberExpression[property.name='sendBeacon']:not([object.type='MemberExpression'][object.object.name='globalThis'][object.property.name='navigator'])", message: 'send.js may reference the beacon only as globalThis.navigator?.sendBeacon (the unload record).' },
  { selector: "MemberExpression[property.value='sendBeacon']", message: 'No string-keyed beacon access.' },
  { selector: "CallExpression[callee.property.name='sendBeacon']", message: 'send.js never calls the beacon directly: the unload record goes through beaconImpl.' },
];

// The visitor-path syntax rules. Shared by the visitor block and by send.js, which keeps all of them.
const VISITOR_SYNTAX = [
  { selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(img|script|link|video|audio|object|embed|source|track|picture)$/i]", message: 'Elements that fetch resources are not allowed here.' },
  { selector: "AssignmentExpression[left.property.name=/^(src|srcset|data|ping)$/]", message: 'Setting a resource URL can fire a request.' },
  { selector: "ImportExpression", message: 'No dynamic imports: the bundle is one file.' },
  { selector: "MemberExpression[computed=true][property.type='BinaryExpression'][property.operator='+']", message: 'Computed member access with an expression can hide a forbidden API.' },
];

export default [
  { ignores: ['node_modules/**', 'dist/**', 'dist-hosted/**', 'organiser/**', 'vendor/**', 'research/**', 'prototype/**', 'playwright-report/**', 'test-results/**', '.keys/**', 'edge/.wrangler/**', 'prototype/node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node, __DOOR_ORIGIN__: 'readonly', __DEMO_LABS__: 'readonly' } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }] },
  },
  {
    // Everything that ships to a visitor's browser, plus the edge.
    files: ['packages/doorway/src/**/*.js', 'packages/core/src/**/*.js', 'packages/shared/*.js', 'edge/c.js'],
    ignores: ['packages/shared/core.test.js'],
    rules: {
      'no-restricted-globals': ['error',
        ...restricted(NETWORK, 'Not on the visitor path: the only network call is send.js -> fetch to the Door origin.'),
        ...restricted(STORAGE, 'The only storage key is doorway:v1, in localStorage, in widget.js.'),
        { name: 'fetch', message: 'Only send.js (and the loader\'s diagnostic) may make network calls.' },
        { name: 'localStorage', message: 'Only widget.js may touch localStorage, and only the doorway:v1 key.' },
        { name: 'name', message: 'window.name is a cross-site channel.' },
      ],
      'no-restricted-properties': ['error',
        { object: 'document', property: 'cookie', message: 'No cookies. Ever.' },
        BEACON,
        { object: 'navigator', property: 'geolocation', message: 'No geolocation.' },
        { object: 'navigator', property: 'plugins', message: 'Fingerprinting surface.' },
        { object: 'navigator', property: 'mediaDevices', message: 'Not needed, not allowed.' },
        { object: 'navigator', property: 'userAgentData', message: 'Fingerprinting surface.' },
        { object: 'screen', property: 'width', message: 'Fingerprinting surface.' },
        { object: 'window', property: 'fetch', message: 'Go through send.js.' },
        { object: 'globalThis', property: 'XMLHttpRequest', message: 'No second network channel.' },
        { property: 'toDataURL', message: 'Canvas fingerprinting.' },
        { property: 'getContext', message: 'Canvas fingerprinting.' },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': ['error', ...VISITOR_SYNTAX],
    },
  },
  {
    // The one place that may make the Door's network call. Its one beacon reference is allowed by SEND_BEACON_ONLY
    // (the property rule is not repeated here); every other rule above still applies to it.
    files: ['packages/doorway/src/send.js'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': ['error', { object: 'document', property: 'cookie', message: 'No cookies.' }],
      'no-restricted-syntax': ['error', ...VISITOR_SYNTAX, ...SEND_BEACON_ONLY],
    },
  },
  {
    // The one place that may touch storage. Key name is checked by the e2e network spec.
    files: ['packages/doorway/src/widget.js'],
    rules: {
      'no-restricted-globals': ['error', ...restricted(NETWORK, 'No second network channel.'), ...restricted(STORAGE, 'Only localStorage["doorway:v1"].'), { name: 'fetch', message: 'Go through send.js.' }],
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(img|script|link|video|audio|object|embed|source|track|picture)$/i]", message: 'Elements that fetch resources are not allowed here.' },
        { selector: "ImportExpression", message: 'No dynamic imports.' },
      ],
    },
  },
  {
    // The host-side loader: it creates the iframe and (diagnostics only) asks /v1/status.
    files: ['packages/doorway/src/loader.js', 'packages/doorway/src/loader-entry.js'],
    rules: {
      'no-restricted-globals': ['error', ...restricted(NETWORK, 'No second network channel.'), ...restricted([...STORAGE, 'localStorage'], 'The loader holds no state.')],
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(img|script|link|video|audio|object|embed|source|track|picture)$/i]", message: 'Only the Door iframe may be created.' },
      ],
      'no-restricted-properties': ['error', { object: 'document', property: 'cookie', message: 'No cookies.' }, BEACON],
    },
  },
  {
    // The edge reads Cloudflare bindings and fetches for verification — but never logs.
    files: ['edge/c.js'],
    rules: {
      'no-restricted-globals': ['error', ...restricted(NETWORK, 'No second channel.'), ...restricted([...STORAGE, 'localStorage'], 'No state outside D1.')],
      'no-restricted-properties': ['error',
        { object: 'console', property: 'log', message: 'The edge never logs.' }, { object: 'console', property: 'info', message: 'The edge never logs.' },
        { object: 'console', property: 'warn', message: 'The edge never logs.' }, { object: 'console', property: 'error', message: 'The edge never logs.' },
        { object: 'console', property: 'debug', message: 'The edge never logs.' },
        BEACON,
      ],
      // No override here: the edge keeps the visitor-path syntax rules (resource elements, src/data assignments,
      // dynamic import, computed member access). It has no legitimate use of any of them.
    },
  },
  {
    // Tests and tooling never ship to a visitor, so the visitor-path rules above do not apply. These rules
    // still do. Each exception is one file, one rule, with the reason; there are no blanket 'off's.
    files: ['scripts/**/*.{js,mjs}', 'test/**/*.{js,mjs}', '**/test/**/*.{js,mjs}', '**/*.test.{js,mjs}'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // No cookies, and no beacons, anywhere: a test that needs to read one says so in its file exception below.
      'no-restricted-properties': ['error', { object: 'document', property: 'cookie', message: 'No cookies.' }, BEACON],
      // A test may read storage and call fetch (it drives the real Door and the real edge). It may not open a
      // second network channel by constructor.
      'no-restricted-globals': ['error', ...restricted(NETWORK, 'Tests and tooling do not open a second network channel. Name the file and reason here if one must.')],
      'no-restricted-syntax': ['error',
        { selector: "MemberExpression[computed=true][property.type='BinaryExpression'][property.operator='+']", message: 'Computed member access with an expression can hide a forbidden API.' },
      ],
    },
  },
  {
    // EXCEPTION: the network spec proves the privacy claim by reading the page's own cookie jar (it must be
    // empty) and by trying an Image beacon, which the browser must refuse. Those two are the evidence itself.
    files: ['test/e2e/network.spec.js'],
    rules: {
      'no-restricted-globals': ['error', ...restricted(NETWORK.filter((n) => n !== 'Image'), 'Tests and tooling do not open a second network channel.')],
      'no-restricted-properties': ['error', BEACON],
    },
  },
];
