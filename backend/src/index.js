'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * @param {Object} options
   * @param {Object} options.strapi - The Strapi instance
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * @param {Object} options
   * @param {Object} options.strapi - The Strapi instance
   */
  bootstrap(/*{ strapi }*/) {},
};
