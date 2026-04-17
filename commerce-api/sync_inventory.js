const { Pool } = require('pg');

const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
const STRAPI_KEY = process.env.STRAPI_API_TOKEN || 'f795c3cc23cd4cfc95a3c4142dbf574d9bad8890fa5c32981410b0ea5e409dfda781fe2205409e59571632826d9116867f0f2dae1282e42b66d340d54ceefa43a964b76248aab7b7ff4998a11e54a12b63484a81dbfc605fe2989ec8bfb51d548e453e7f93fc1f9fa83312ce4dae9ed9949b038b880ad02e19c4ffd6ae34c478';

async function sync() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.vhjpcyinxotihfusjwli:yWbySBCJusunn47Z@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
  });

  try {
    console.log('Fetching products from Strapi...');
    const res = await fetch(`${STRAPI_URL}/api/products`, {
      headers: {
        'Authorization': `Bearer ${STRAPI_KEY}`
      }
    });
    const json = await res.json();
    const products = json.data;
    
    if (!products) {
       console.log("No products fetched", json);
       return;
    }

    console.log(`Found ${products.length} products. Seeding DB...`);
    
    for (const p of products) {
      const { id } = p;
      const { title, slug, price, stock } = p.attributes;
      
      await pool.query(`
        INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty, reserved_qty)
        VALUES ($1, $2, $3, $4, $5, 0)
        ON CONFLICT (strapi_id) DO UPDATE SET
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          available_qty = EXCLUDED.available_qty,
          updated_at = CURRENT_TIMESTAMP
      `, [id, slug, title, price, stock]);
      console.log(`Seeded: ${title} (id: ${id}, qty: ${stock})`);
    }
    console.log('Done!');
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

sync();
