import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const token = 'a'.repeat(43);
function page(kind, { hash = `#${kind === 'connect' ? 'request' : 'token'}=${token}&environment=staging`, scrubFails = false, response = { ok:true, json:async()=>({verified:true}) } } = {}) {
  const html = readFileSync(new URL(`./${kind}/index.html`, import.meta.url),'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = Object.fromEntries(['connect','confirm','title','status'].map(id=>[id,{disabled:true,hidden:false,textContent:'',addEventListener(event,fn){this[event]=fn;}}]));
  const calls=[], navigations=[]; let ready;
  const window={location:{hash,pathname:`/echo/${kind}/`,assign:url=>navigations.push(url)},history:{replaceState:()=>{if(scrubFails)throw Error('blocked');window.location.hash='';}}};
  vm.runInNewContext(script,{window,URLSearchParams,AbortController,setTimeout,clearTimeout,document:{addEventListener:(_event,fn)=>{ready=fn;},getElementById:id=>elements[id]},fetch:async(url,options)=>{calls.push({url,options});return response;}});
  ready();
  return {html,window,elements,calls,navigations,click:()=>elements[kind==='connect'?'connect':'confirm'].click?.()};
}
test('connection is fragment-only, scrubbed, explicit and never requests Auth from the web',async()=>{
  const p=page('connect');
  assert.equal(p.window.location.hash,'');assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
  await p.click();assert.equal(p.calls.length,0);
  assert.deepEqual(p.navigations,[`reps://echo-connect#request=${token}&environment=staging`]);
  assert.doesNotMatch(p.html,/analytics|localStorage|sessionStorage|access_token|refresh_token/);
});
test('both bridges reject malformed, extra, duplicate, unscubbable and unknown environment requests',async()=>{
  for(const kind of ['connect','waitlist']){
    const key=kind==='connect'?'request':'token';
    for(const hash of ['',`#${key}=short&environment=staging`,`#${key}=${token}&environment=evil`,`#${key}=${token}&environment=staging&environment=production`,`#${key}=${token}&environment=staging&${key}=${token}`,`#${key}=${token}&environment=staging&redirect=https://evil.test`]){
      const p=page(kind,{hash});await p.click();assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
    }
    const p=page(kind,{scrubFails:true});await p.click();assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
  }
});
test('waitlist scanners cannot confirm; deliberate click verifies only email on exact environment host',async()=>{
  const p=page('waitlist');assert.equal(p.calls.length,0);await p.click();await p.click();
  assert.equal(p.calls.length,1);
  assert.equal(p.calls[0].url,'https://ecxgtkoaerunnfklhglx.supabase.co/functions/v1/echo-gateway/waitlist-confirm');
  assert.deepEqual(JSON.parse(p.calls[0].options.body),{token});
  assert.equal(p.calls[0].options.credentials,'omit');assert.equal(p.calls[0].options.redirect,'error');
  assert.equal(p.navigations.length,0);assert.equal(p.elements.title.textContent,'You’re on the list');
});
test('waitlist false or failed confirmation never displays a successful enrollment',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>({verified:false})}]){
    const p=page('waitlist',{response});await p.click();assert.notEqual(p.elements.title.textContent,'You’re on the list');assert.equal(p.elements.confirm.hidden,true);
  }
});
