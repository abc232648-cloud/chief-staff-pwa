import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const api = read('src/api/sops.ts');
const panel = read('src/features/sops/SopPanel.tsx');
const screens = read('src/screens/index.tsx');

test('S11 SOP content is read from a dedicated Chief assigned-SOP contract', () => {
  assert.match(api, /['"]\/api\/farm\/sops\/assigned['"]/);
  assert.match(screens, /SopPanel/);
});

test('S11 DEV SOPs are unmistakably fixtures', () => {
  assert.match(panel, /Development fixture/);
  assert.match(panel, /not an instruction issued by Chief/);
  assert.match(panel, /mock_isolated/);
});

test('S11 SOP display does not grant authority', () => {
  assert.match(panel, /does not grant additional task or policy authority/);
});
