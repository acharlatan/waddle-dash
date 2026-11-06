import test from 'node:test';
import assert from 'node:assert/strict';
import {setupMobileNavigation} from '../public/navigation.js';

function makeView(mobile = true) {
 const listeners = new Map();
 const classes = new Set();
 const focus = [];
 const active = {focus: () => focus.push('active')};
 const sidebar = {
  classList: {
   contains: value => classes.has(value),
   remove: value => classes.delete(value),
   toggle: value => classes.has(value) ? (classes.delete(value), false) : (classes.add(value), true)
  },
  querySelector: () => active
 };
 const attributes = {};
 const menu = {setAttribute: (key,value) => attributes[key]=value, focus: () => focus.push('menu')};
 const main = {focus: () => focus.push('main')};
 const doc = {
  querySelector: selector => ({'[data-menu]':menu,'#navigation-panel':sidebar,'#main':main})[selector],
  addEventListener: (type,fn) => listeners.set(type,fn),
  removeEventListener: type => listeners.delete(type)
 };
 const cleanup = setupMobileNavigation(doc, () => mobile);
 const click = selector => listeners.get('click')({target:{closest: query => query === selector ? {} : null}});
 const escape = () => {let prevented=false;listeners.get('keydown')({key:'Escape',preventDefault:()=>prevented=true});return prevented};
 return {click,escape,focus,attributes,classes,cleanup};
}

test('mobile navigation announces open state and Escape returns focus', () => {
 const view=makeView();
 view.click('[data-menu]');
 assert.equal(view.attributes['aria-expanded'],'true');
 assert.equal(view.classes.has('is-open'),true);
 assert.deepEqual(view.focus,['active']);
 assert.equal(view.escape(),true);
 assert.equal(view.attributes['aria-expanded'],'false');
 assert.equal(view.classes.has('is-open'),false);
 assert.deepEqual(view.focus,['active','menu']);
 view.cleanup();
});

test('choosing a mobile destination closes the menu and focuses the content', () => {
 const view=makeView();
 view.click('[data-menu]');
 view.click('#navigation-panel a');
 assert.equal(view.attributes['aria-expanded'],'false');
 assert.equal(view.classes.has('is-open'),false);
 assert.equal(view.focus.at(-1),'main');
});

test('desktop navigation does not steal focus or intercept Escape', () => {
 const view=makeView(false);
 view.click('#navigation-panel a');
 assert.deepEqual(view.focus,[]);
 assert.equal(view.escape(),false);
});
