ALTER TABLE transport_orders
    ADD COLUMN IF NOT EXISTS requested_delivery_date date;

CREATE INDEX IF NOT EXISTS idx_transport_orders_requested_delivery_date
    ON transport_orders (requested_delivery_date);
