const Database = require('./database-pg');

async function runMigration() {
  const db = new Database();
  
  try {
    await db.init();
    const pool = db.getPool();
    
    console.log('Running migration: Adding threshold_price column...');
    
    await pool.query(`
      ALTER TABLE products 
      ADD COLUMN IF NOT EXISTS threshold_price DECIMAL(10,2)
    `);
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runMigration();
