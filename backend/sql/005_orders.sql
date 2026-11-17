-- Orders and payments table for novel unlocks
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_id text UNIQUE NOT NULL,
  user_id integer REFERENCES users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  edition text NOT NULL DEFAULT 'Digital Lifetime Reading Pass',
  amount_inr integer NOT NULL DEFAULT 30,
  payment_gateway text NOT NULL DEFAULT 'simulation',
  payment_id text,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_customer_email_idx ON orders (lower(customer_email));
