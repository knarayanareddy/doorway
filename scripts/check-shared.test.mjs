import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportNames, describeChange } from './check-shared.mjs';

test('exportNames reads functions, consts, re-exports and default from the AST', () => {
  const src = [
    'export function a() {}',
    'export const b = 1, c = 2;',
    'const d = 3;',
    'export { d as e, d as \'f-g\' };',
    'export default function () {}',
  ].join('\n');
  assert.deepEqual(exportNames(src), ['a', 'b', 'c', 'default', 'e', 'f-g']);
});

test('exportNames ignores text that only looks like an export (comments and strings)', () => {
  assert.deepEqual(exportNames("// export function ghost() {}\nconst s = 'export const nope = 1';"), []);
});

test('describeChange reports added and removed exports and the line delta', () => {
  const before = 'export function keep() {}\nexport function gone() {}\n';
  const after = 'export function keep() {}\nexport function fresh() {}\nexport const more = 1;\n';
  assert.deepEqual(describeChange('card.js', before, after), {
    file: 'card.js',
    isNew: false,
    linesDelta: 1,
    exportsAdded: ['fresh', 'more'],
    exportsRemoved: ['gone'],
  });
});

test('describeChange on a new file (no HEAD version) counts every export as added', () => {
  const c = describeChange('new.js', null, 'export const x = 1;\n');
  assert.equal(c.isNew, true);
  assert.deepEqual(c.exportsAdded, ['x']);
  assert.deepEqual(c.exportsRemoved, []);
});
