const url = 'https://cms-driven-e-commerce-api.onrender.com/api/v1/users/forgot-password';

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'shuvroshimul325@gmail.com'
  })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
