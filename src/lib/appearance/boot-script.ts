// The no-flash script (roadmap 3.11). `__root.tsx` renders it with `ScriptOnce` as the first thing in
// <head>, carrying the request's CSP nonce, so it runs before the stylesheet and the body: the saved
// theme class and token overrides are on <html> at first paint. It only replays the snapshot
// `applyAppearance` stored, so it stays tiny and needs none of the settings logic. It is plain ES5
// on purpose (it is inlined as text, never bundled) and ignores anything that isn't a custom property.

export const BOOT_SNAPSHOT_KEY = "highelo-appearance-boot";

export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(BOOT_SNAPSHOT_KEY)})||"null");if(!s||s.v!==1)return;var r=document.documentElement;if(s.scheme==="dark"||s.scheme==="light")r.classList.add(s.scheme);var v=s.vars||{};for(var k in v){if(/^--[a-z0-9-]+$/.test(k)&&typeof v[k]==="string")r.style.setProperty(k,v[k])}}catch(e){}})()`;
