import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('push ignores private text and unsafe URL; click opens only this workspace', async () => {
  const handlers = {}, shown = [], opened = [];
  const self = {registration:{scope:'https://chief.invalid/staff/',showNotification:async(title,options)=>shown.push({title,...options})},clients:{openWindow:async url=>opened.push(url)},addEventListener:(name,handler)=>{handlers[name]=handler}};
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),{self,URL});
  let pending;
  handlers.push({data:{json:()=>({title:'PRIVATE',body:'PRIVATE',url:'https://evil.invalid',tag:'private-text'})},waitUntil:p=>{pending=p}});
  await pending;
  assert.equal(shown.length,1);assert.equal(shown[0].body,'Sign in to view your update.');
  assert.equal(shown[0].data.url,'/staff/');assert.ok(!JSON.stringify(shown).includes('PRIVATE'));
  handlers.notificationclick({notification:{close(){},data:{url:'https://evil.invalid'}},waitUntil:p=>{pending=p}});await pending;
  assert.deepEqual(opened,['/staff/']);
});
