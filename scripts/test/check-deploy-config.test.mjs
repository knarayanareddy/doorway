import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDoorOrigin } from '../check-deploy-config.mjs';

const toml = (origin) => `name = "doorway-edge"\n\n[vars]\nDOOR_ORIGIN = "${origin}"\n`;

test('the shipped .example placeholder is refused, and the message tells the deployer what to edit', () => {
  const r = checkDoorOrigin(toml('https://door.doorway.example'));
  assert.equal(r.ok, false);
  assert.match(r.message, /placeholder/);
  assert.match(r.message, /edge\/wrangler\.toml/);
});

test('a real origin passes', () => {
  assert.equal(checkDoorOrigin(toml('https://door.example.org')).ok, true, '"example" as a label is not the placeholder');
  assert.equal(checkDoorOrigin(toml('https://door.yourdomain.org')).ok, true);
});

test('an empty value is refused', () => {
  assert.equal(checkDoorOrigin(toml('')).ok, false);
});

test('a missing DOOR_ORIGIN line is refused', () => {
  assert.equal(checkDoorOrigin('name = "doorway-edge"\n').ok, false);
});

test('a value that is not a URL is refused', () => {
  assert.equal(checkDoorOrigin(toml('door.yourdomain.org')).ok, false);
});
