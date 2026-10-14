'use strict';
module.exports = require('@strapi/strapi').factories.createCoreRouter('api::order.order', {
  config: Object.fromEntries(['find', 'findOne', 'create', 'update', 'delete'].map(action => [
    action, { auth: { strategies: ['api-token'] } }
  ]))
});
