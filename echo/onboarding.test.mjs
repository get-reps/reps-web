import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const token = 'a'.repeat(43);
function page(kind, { hash = `#${kind === 'connect' ? 'request' : 'token'}=${token}&environment=staging`, search = '', mobile = false, hidden = false, scrubFails = false, response = { ok:true, json:async()=>({verified:true}) } } = {}) {
  const html = readFileSync(new URL(`./${kind}/index.html`, import.meta.url),'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = Object.fromEntries(['connect','confirm','title','intro','status','install'].map(id=>[id,{disabled:true,hidden:false,textContent:'',addEventListener(event,fn){this[event]=fn;}}]));
  const calls=[], navigations=[]; let ready;
  const window={location:{hash,search,pathname:`/echo/${kind}/`,assign:url=>{assert.equal(window.location.hash,'');navigations.push(url);}},history:{replaceState:()=>{if(scrubFails)throw Error('blocked');window.location.hash='';}}};
  vm.runInNewContext(script,{window,URLSearchParams,AbortController,setTimeout,clearTimeout,navigator:{userAgent:mobile?'iPhone':'Desktop',maxTouchPoints:mobile?5:0},document:{visibilityState:hidden?'hidden':'visible',addEventListener:(_event,fn)=>{ready=fn;},getElementById:id=>elements[id]},fetch:async(url,options)=>{calls.push({url,options});return response;}});
  ready();
  return {html,window,elements,calls,navigations,click:()=>elements[kind==='connect'?'connect':'confirm'].click?.()};
}
test('desktop connection is fragment-only, scrubbed, explicit and never requests Auth from the web',async()=>{
  const p=page('connect',{hash:`#request=${token}&environment=production`});
  assert.equal(p.window.location.hash,'');assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
  await p.click();assert.equal(p.calls.length,0);
  assert.deepEqual(p.navigations,[`reps://echo-connect#request=${token}&environment=production`]);
  assert.doesNotMatch(p.html,/analytics|localStorage|sessionStorage|access_token|refresh_token/);
});

test('visible mobile connection attempts the correct app once and retains its fallback',async()=>{
  for(const environment of ['production']){
    const p=page('connect',{mobile:true,hash:`#request=${token}&environment=${environment}`});
    const expected=`${environment==='staging'?'reps-echo-staging':'reps'}://echo-connect#request=${token}&environment=${environment}`;
    assert.deepEqual(p.navigations,[expected]);
    assert.equal(p.elements.connect.hidden,false);
    assert.equal(p.elements.connect.disabled,false);
    assert.equal(p.elements.install.hidden,environment==='staging');
    assert.equal(p.calls.length,0);
    await p.click();assert.deepEqual(p.navigations,[expected,expected]);
  }
  const hidden=page('connect',{mobile:true,hidden:true});assert.equal(hidden.navigations.length,0);
});

test('staging never launches the abandoned scheme or an ambiguous installed app',async()=>{
  for(const mobile of [true,false]){
    const p=page('connect',{mobile});await p.click();
    assert.deepEqual(p.navigations,[]);assert.deepEqual(p.calls,[]);
    assert.equal(p.elements.connect.hidden,true);assert.equal(p.elements.install.hidden,true);
    assert.match(p.elements.intro.textContent,/isn’t ready yet/);
    assert.equal(p.window.location.hash,'');
  }
});

test('mobile malformed or unscrubbable connection never attempts to open an app',async()=>{
  for(const options of [{hash:''},{hash:`#request=${token}&environment=evil`},{scrubFails:true},{search:`?request=${token}`}]){
    const p=page('connect',{mobile:true,...options});await p.click();
    assert.equal(p.navigations.length,0);assert.equal(p.calls.length,0);
  }
});

test('AASA preserves login and only enables Echo for the capable private staging app',()=>{
  const aasa=JSON.parse(readFileSync(new URL('../.well-known/apple-app-site-association',import.meta.url),'utf8'));
  const [production,staging]=aasa.applinks.details;
  assert.deepEqual(production.appIDs,['VS232T422C.io.getreps.app']);
  assert.deepEqual(staging.appIDs,['VS232T422C.io.getreps.app.dev']);
  assert.equal(production.components[0]['/'],'/login');
  assert.equal(production.components[0]['#'],'token_hash=*&type=*');
  // Existing App Store versions cannot parse HTTPS Echo links yet. Add the
  // production association only after a capable app release is available.
  assert.equal(production.components.length,1);
  for(const [entry,environment] of [[staging,'staging']]){
    const components=entry.components.filter(c=>c['/']!=='/login');
    assert.deepEqual(components.map(c=>c['/']),['/echo/connect/','/echo/connect']);
    assert.ok(components.every(c=>c['#']===`request=*&environment=${environment}`));
  }
  assert.equal(staging.components.some(c=>c['/']==='/login'),false);
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
