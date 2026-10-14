CREATE SEQUENCE transport_order_code_seq
    START WITH 1
    INCREMENT BY 1;

SELECT setval(
    'transport_order_code_seq',
    COALESCE((
        SELECT MAX(CAST(SUBSTRING(order_code FROM '^ORD-([0-9]+)$') AS bigint))
        FROM transport_orders
        WHERE order_code ~ '^ORD-[0-9]+$'
    ), 0) + 1,
    false
);
