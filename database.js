const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor(dbPath = 'products.db') {
    this.dbPath = path.join(__dirname, dbPath);
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          price REAL,
          url TEXT NOT NULL UNIQUE,
          scraped_at TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      this.db.run(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Products table created/verified');
          resolve();
        }
      });
    });
  }

  async saveProduct(productData) {
    return new Promise((resolve, reject) => {
      const { title, price, url, scrapedAt } = productData;
      
      const sql = `
        INSERT OR REPLACE INTO products (title, price, url, scraped_at)
        VALUES (?, ?, ?, ?)
      `;
      
      this.db.run(sql, [title, price, url, scrapedAt], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async getAllProducts() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products ORDER BY created_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getProductByUrl(url) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM products WHERE url = ?';
      
      this.db.get(sql, [url], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = Database;