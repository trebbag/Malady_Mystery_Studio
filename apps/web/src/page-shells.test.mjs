import assert from 'node:assert/strict';
import test from 'node:test';

import { webComponentMap } from './component-map.mjs';
import { webPageShells } from './page-shells.mjs';
import { webRouteManifest } from './route-manifest.mjs';

test('page shells exist for every route manifest entry', () => {
  const shellPaths = new Set(webPageShells.map((shell) => shell.path));

  for (const route of webRouteManifest) {
    assert.equal(shellPaths.has(route.path), true, `missing page shell for ${route.path}`);
  }
});

test('page shells only reference known placeholder components', () => {
  const componentNames = new Set(webComponentMap.map((component) => component.name));

  for (const shell of webPageShells) {
    for (const component of shell.components) {
      assert.equal(componentNames.has(component.name), true, `unknown component ${component.name}`);
    }
  }
});
