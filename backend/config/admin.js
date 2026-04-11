module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'mySecret'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'mySalt'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'mySalt2'),
    },
  },
});
