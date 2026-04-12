const url = 'https://cms-driven-e-commerce.vercel.app/api/mailer';
const secret = 'nmtkQnrxo+HgyGY/hMNKhg0lakUdy4TB8ws/BrRqM6c=';

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${secret}`
  },
  body: JSON.stringify({
    to: 'shuvroshimul325@gmail.com',
    subject: 'Test Email',
    htmlContent: '<p>Test</p>'
  })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
}).catch(console.error);
