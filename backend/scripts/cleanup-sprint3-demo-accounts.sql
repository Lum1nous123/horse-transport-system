\set ON_ERROR_STOP on
BEGIN;
DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM transport_orders WHERE order_code LIKE 'S3DEMO-%') THEN
    RAISE EXCEPTION 'Remove Sprint 3 demo fixtures before removing demo accounts';
  END IF;
END
$cleanup$;
DELETE FROM users WHERE email IN (
  'lm.s3demo@example.com',
  'driver1.s3demo@example.com',
  'driver2.s3demo@example.com',
  'escort1.s3demo@example.com',
  'escort2.s3demo@example.com',
  'customer.s3demo@example.com',
  'ts.s3demo@example.com',
  'frc.s3demo@example.com'
);
COMMIT;
