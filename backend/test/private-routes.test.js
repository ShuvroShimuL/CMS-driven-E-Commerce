'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('cart and order APIs cannot fall back to public-role authentication', () => {
  for (const model of ['cart', 'order']) {
    const schema = require(`../src/api/${model}/content-types/${model}/schema.json`);
    global.strapi = { contentType: () => ({ ...schema, uid: `api::${model}.${model}` }) };
    const router = require(`../src/api/${model}/routes/${model}`);
    assert.equal(router.routes.length, 5);
    for (const route of router.routes) {
      assert.deepEqual(route.config.auth.strategies, ['api-token']);
    }
  }
  delete global.strapi;
});
