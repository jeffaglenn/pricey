-- Add threshold_price column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS threshold_price DECIMAL(10,2);

-- Add comment
COMMENT ON COLUMN products.threshold_price IS 'Price threshold for alerts and monitoring';
