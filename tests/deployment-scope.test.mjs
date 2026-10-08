import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const register = fs.readFileSync('src/pwa/register.ts', 'utf8');

test('Staff retires any legacy root-scoped Chief worker before scoped registration', () => {
  assert.match(register, /scopePath === ['"]\/['"]/);
  assert.match(register, /script\.endsWith\(['"]\/sw\.js['"]\)/);
  assert.match(register, /await reg\.unregister\(\)/);
  assert.match(register, /base !== ['"]\/staff\/['"]/);
});
