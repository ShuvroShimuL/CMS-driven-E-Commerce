'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;
module.exports = createCoreRouter('api::cart.cart', {
  config: Object.fromEntries(['find', 'findOne', 'create', 'update', 'delete'].map(action => [
    action, { auth: { strategies: ['api-token'] } }
  ]))
});
