import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const token = 'a'.repeat(43);
function page(kind, { hash = `#${kind === 'connect' ? 'request' : 'token'}=${token}&environment=staging`, search = '', mobile = false, hidden = false, scrubFails = false, response = { ok:true, json:async()=>({verified:true}) } } = {}) {
  const html = readFileSync(new URL(`./${kind}/index.html`, import.meta.url),'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = Object.fromEntries(['connect','confirm','title','intro','status','install'].map(id=>[id,{disabled:true,hidden:false,textContent:'',addEventListener(event,fn){this[event]=fn;}}]));
  const calls=[], navigations=[],windowListeners={}; let ready,reloads=0;
  const window={addEventListener:(event,fn)=>{windowListeners[event]=fn;},location:{hash,search,pathname:`/echo/${kind}/`,reload:()=>{reloads++;},assign:url=>{navigations.push(url);}},history:{replaceState:()=>{if(scrubFails)throw Error('blocked');window.location.hash='';}}};
  vm.runInNewContext(script,{window,URLSearchParams,AbortController,setTimeout,clearTimeout,navigator:{userAgent:mobile?'iPhone':'Desktop',maxTouchPoints:mobile?5:0},document:{visibilityState:hidden?'hidden':'visible',addEventListener:(_event,fn)=>{ready=fn;},getElementById:id=>elements[id]},fetch:async(url,options)=>{calls.push({url,options});return typeof response==='function'?response():response;}});
  ready();
  return {html,window,elements,calls,navigations,click:()=>elements[kind==='connect'?'connect':'confirm'].click?.(),navigateFragment:(hash,{dispatch=true}={})=>{window.location.hash=hash;if(dispatch)windowListeners.hashchange?.();},reloads:()=>reloads};
}

test('replacement connection fences clicks before hashchange dispatch',async()=>{
  const p=page('connect',{hash:`#request=${token}&environment=production`});
  p.navigateFragment(`#request=${'b'.repeat(43)}&environment=production`,{dispatch:false});
  await p.click();assert.equal(p.navigations.length,0);assert.equal(p.reloads(),0);
});

test('replacement waitlist fences clicks and late bodies before hashchange dispatch',async()=>{
  const fresh=`#token=${'b'.repeat(43)}&environment=production`;
  const idle=page('waitlist');idle.navigateFragment(fresh,{dispatch:false});await idle.click();
  assert.equal(idle.calls.length,0);assert.equal(idle.reloads(),0);
  let complete,signalReading;const readingBody=new Promise(resolve=>{signalReading=resolve;});
  const pending=new Promise(resolve=>{complete=resolve;});
  const p=page('waitlist',{response:{ok:true,json:()=>{signalReading();return pending;}}});
  const first=p.click();await readingBody;
  p.navigateFragment(fresh,{dispatch:false});complete({verified:true});await first;
  assert.notEqual(p.elements.title.textContent,'You’re on the list');
  p.navigateFragment(fresh);assert.equal(p.reloads(),1);
});
test('a fresh connection link in an existing tab reinitializes before any app launch',()=>{
  for(const initial of ['#request=bad&environment=production',`#request=${token}&environment=production`]){
    const p=page('connect',{hash:initial});
    assert.equal(p.reloads(),0,'scrubbing with replaceState must not trigger reload');
    p.navigateFragment(`#request=${'b'.repeat(43)}&environment=production`);
    assert.equal(p.reloads(),1);assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
    p.click();
    assert.equal(p.elements.connect.disabled,true);
    assert.equal(p.navigations.length,0,'a click during reload cannot reuse the previous token');
  }
});

test('replacement waitlist link fences the previous confirmation before reloading',async()=>{
  for(const hash of ['',`#token=${token}&environment=production`]){
    const p=page('waitlist',{hash});
    p.navigateFragment(`#token=${'b'.repeat(43)}&environment=production`);
    await p.click();
    assert.equal(p.reloads(),1);assert.equal(p.elements.confirm.disabled,true);
    assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
  }
});

test('replacement waitlist link ignores late confirmation of the earlier request',async()=>{
  let complete;const pending=new Promise(resolve=>{complete=resolve;});
  const p=page('waitlist',{response:()=>pending});const first=p.click();
  p.navigateFragment(`#token=${'b'.repeat(43)}&environment=production`);
  assert.equal(p.calls[0].options.signal.aborted,true);
  complete({ok:true,json:async()=>({verified:true})});await first;await p.click();
  assert.equal(p.calls.length,1);assert.notEqual(p.elements.title.textContent,'You’re on the list');
});

test('replacement waitlist link ignores a late confirmation body too',async()=>{
  let complete,signalReading;const pending=new Promise(resolve=>{complete=resolve;});
  const readingBody=new Promise(resolve=>{signalReading=resolve;});
  const p=page('waitlist',{response:{ok:true,json:()=>{signalReading();return pending;}}});
  const first=p.click();await readingBody;
  p.navigateFragment(`#token=${'b'.repeat(43)}&environment=production`);
  complete({verified:true});await first;
  assert.notEqual(p.elements.title.textContent,'You’re on the list');
});
test('desktop connection is fragment-only, scrubbed, explicit and never requests Auth from the web',async()=>{
  const p=page('connect',{hash:`#request=${token}&environment=production`});
  assert.equal(p.window.location.hash,'');assert.equal(p.calls.length,0);assert.equal(p.navigations.length,0);
  await p.click();assert.equal(p.calls.length,0);
  assert.deepEqual(p.navigations,[`reps://echo-connect#request=${token}&environment=production`]);
  assert.doesNotMatch(p.html,/analytics|localStorage|sessionStorage|access_token|refresh_token/);
});

test('mobile connection never probes for an app and opens only on the explicit installed-app choice',async()=>{
  for(const environment of ['production']){
    const p=page('connect',{mobile:true,hash:`#request=${token}&environment=${environment}`});
    const expected=`${environment==='staging'?'reps-echo-staging':'reps'}://echo-connect#request=${token}&environment=${environment}`;
    assert.deepEqual(p.navigations,[]);
    assert.equal(p.elements.connect.hidden,false);
    assert.equal(p.elements.connect.disabled,false);
    assert.equal(p.elements.install.hidden,environment==='staging');
    assert.equal(p.calls.length,0);
    await p.click();assert.deepEqual(p.navigations,[expected]);
  }
  const hidden=page('connect',{mobile:true,hidden:true});assert.equal(hidden.navigations.length,0);
});

test('installation is a direct credential-free App Store link, separate from the app launch',()=>{
  const p=page('connect',{mobile:true,hash:`#request=${token}&environment=production`});
  assert.match(p.html,/<button id="connect" class="action action-open"[^>]*>I already have REPS<\/button>/);
  assert.match(p.html,/<a id="install" class="action action-install" href="https:\/\/apps\.apple\.com\/app\/id6759216018" rel="noreferrer">Install REPS<\/a>/);
  assert.equal(p.navigations.length,0);
  assert.equal(p.calls.length,0);
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

test('AASA permits set links and scoped login while keeping production connection links on the website',()=>{
  const aasa=JSON.parse(readFileSync(new URL('../.well-known/apple-app-site-association',import.meta.url),'utf8'));
  const production=aasa.applinks.details.find(entry=>entry.appIDs.includes('VS232T422C.io.getreps.app'));
  const staging=aasa.applinks.details.find(entry=>entry.appIDs.includes('VS232T422C.io.getreps.app.dev'));
  assert.deepEqual(production.appIDs,['VS232T422C.io.getreps.app']);
  assert.deepEqual(staging.appIDs,['VS232T422C.io.getreps.app.dev']);
  assert.deepEqual(production.components.map(c=>c['/']).sort(),['/echo-set','/login']);
  const login=production.components.find(c=>c['/']==='/login');
  assert.equal(login['#'],'token_hash=*&type=*');
  const set=production.components.find(c=>c['/']==='/echo-set');
  assert.equal(set.exclude,undefined);
  // Set links were deliberately enabled; connection links still use the web
  // bridge until a compatible production app release is available.
  assert.equal(production.components.some(c=>c['/'].startsWith('/echo/connect')),false);
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
