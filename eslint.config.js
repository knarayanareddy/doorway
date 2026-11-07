/**
 * The privacy tripwire (review H3). An AST decides, not a line regex.
 *
 * This is a TRIPWIRE, not proof. It stops the obvious ways a well-meaning or
 * malicious change could add a second channel (XHR, Image beacon, WebSocket,
 * sendBeacon, cookies, geolocation, eval). It cannot see through dynamic access
 * like window['fe'+'tch']. The EVIDENCE is test/e2e/network.spec.js, which records
 * every request the real Door makes in a real browser, and the Door's CSP, which
 * makes the browser refuse anything but same-origin connections.
 */
import js from '@eslint/js';
import globals from 'globals';

const NETWORK = ['XMLHttpRequest', 'Image', 'WebSocket', 'EventSource', 'Audio', 'Worker', 'SharedWorker', 'BroadcastChannel', 'RTCPeerConnection', 'WebTransport'];
const STORAGE = ['sessionStorage', 'indexedDB', 'caches', 'openDatabase', 'cookieStore'];

const restricted = (names, why) => names.map((name) => ({ name, message: why }));

export default [
  { ignores: ['node_modules/**', 'dist/**', 'dist-hosted/**', 'organiser/**', 'vendor/**', 'research/**', 'mock-platform/**', 'prototype/**', 'playwright-report/**', 'test-results/**', '.keys/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser, ...globals.node, __DOOR_ORIGIN__: 'readonly' } },
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
        { object: 'navigator', property: 'sendBeacon', message: 'Beacons bypass the validated send path.' },
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
      'no-restricted-syntax': ['error',
        { selector: "CallExpression[callee.property.name='createElement'][arguments.0.value=/^(img|script|link|video|audio|object|embed|source|track|picture)$/i]", message: 'Elements that fetch resources are not allowed here.' },
        { selector: "AssignmentExpression[left.property.name=/^(src|srcset|data|ping)$/]", message: 'Setting a resource URL can fire a request.' },
        { selector: "ImportExpression", message: 'No dynamic imports: the bundle is one file.' },
        { selector: "MemberExpression[computed=true][property.type='BinaryExpression'][property.operator='+']", message: 'Computed member access with an expression can hide a forbidden API.' },
      ],
    },
  },
  {
    // The one place that may make the Door's network call.
    files: ['packages/doorway/src/send.js'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': ['error', { object: 'document', property: 'cookie', message: 'No cookies.' }] },
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
      'no-restricted-properties': ['error', { object: 'document', property: 'cookie', message: 'No cookies.' }, { object: 'navigator', property: 'sendBeacon', message: 'No beacons.' }],
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
      ],
      'no-restricted-syntax': 'off',
    },
  },
  {
    // Tests may use anything; they do not ship.
    files: ['**/test/**', '**/*.test.js', 'scripts/**', 'eslint.config.js', 'test/**'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off', 'no-restricted-syntax': 'off' },
  },
];
