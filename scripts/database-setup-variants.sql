-- Update the products table to handle variants properly
-- Remove the old unique constraint and add a new one for reference+size

-- Drop the old constraint if it exists
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_reference_size_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_reference_key;

-- Add new unique constraint for reference + size combination
ALTER TABLE products ADD CONSTRAINT products_reference_size_unique UNIQUE (reference, size);

-- Add an index for better performance on reference lookups
CREATE INDEX IF NOT EXISTS idx_products_reference ON products(reference);

-- Update any existing duplicate barcodes by summing stock
WITH barcode_duplicates AS (
  SELECT bar_code, SUM(stock) as total_stock, MIN(id) as keep_id
  FROM products 
  WHERE bar_code IS NOT NULL AND bar_code != ''
  GROUP BY bar_code 
  HAVING COUNT(*) > 1
)
UPDATE products 
SET stock = barcode_duplicates.total_stock
FROM barcode_duplicates 
WHERE products.id = barcode_duplicates.keep_id;

-- Delete duplicate barcode entries (keeping the one with updated stock)
WITH barcode_duplicates AS (
  SELECT bar_code, MIN(id) as keep_id
  FROM products 
  WHERE bar_code IS NOT NULL AND bar_code != ''
  GROUP BY bar_code 
  HAVING COUNT(*) > 1
)
DELETE FROM products 
WHERE bar_code IN (SELECT bar_code FROM barcode_duplicates) 
AND id NOT IN (SELECT keep_id FROM barcode_duplicates);
