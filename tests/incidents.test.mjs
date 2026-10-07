import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = path => fs.readFileSync(path, 'utf8');
const api = read('src/api/incidents.ts');
const panel = read('src/features/incidents/IncidentEmergencyPanel.tsx');
const screens = read('src/screens/index.tsx');

test('S10 keeps incidents/emergencies separate from ordinary worker reports', () => {
  assert.match(api, /['"]\/api\/farm\/incidents['"]/);
  assert.match(panel, /Report emergency to Chief/);
  assert.match(screens, /IncidentEmergencyPanel/);
});

test('S10 requires explicit Chief receipt before saying received', () => {
  assert.match(panel, /UNCONFIRMED_INCIDENT_RECEIPT/);
  assert.match(panel, /Received by Chief/);
  assert.match(panel, /downstream routing is not inferred/i);
});

test('S10 never claims Staff created STOP or external delivery', () => {
  assert.match(panel, /does not create a STOP/);
  assert.match(panel, /does not.*prove.*external notification/i);
  assert.doesNotMatch(panel, /STOP created|STOP active|owner notified|supervisor notified/i);
});

test('S10 development identities cannot submit live incidents', () => {
  assert.match(panel, /Development identities cannot submit incidents or emergencies to Chief/);
  assert.match(panel, /identity\.isSimulated/);
});
