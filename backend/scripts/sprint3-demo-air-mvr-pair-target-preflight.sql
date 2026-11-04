\set ON_ERROR_STOP on

-- Reuse the owner-approved Supabase Shared Pooler identity guard. It keeps
-- the real PRODUCTION branch label separate from approved demo usage.
\ir sprint3-road-road-target-preflight.sql

BEGIN TRANSACTION READ ONLY;

DO $preflight$
DECLARE
  customer uuid;
  lm uuid;
  frc uuid;
  driver1 uuid;
  driver2 uuid;
  escort1 uuid;
  escort2 uuid;
  order_01_air_start constant timestamp := timestamp '2099-04-01 08:00:00';
  order_01_air_end constant timestamp := timestamp '2099-04-01 12:00:00';
  order_01_road_start constant timestamp := timestamp '2099-04-01 13:00:00';
  order_01_road_end constant timestamp := timestamp '2099-04-01 18:00:00';
  order_02_air_start constant timestamp := timestamp '2099-04-02 08:00:00';
  order_02_air_end constant timestamp := timestamp '2099-04-02 12:00:00';
  order_02_road_start constant timestamp := timestamp '2099-04-02 13:00:00';
  order_02_road_end constant timestamp := timestamp '2099-04-02 18:00:00';
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'Demo fixture preflight must be read only';
  END IF;

  IF to_regclass('public.users') IS NULL
      OR to_regclass('public.horses') IS NULL
      OR to_regclass('public.transport_orders') IS NULL
      OR to_regclass('public.transport_order_horses') IS NULL
      OR to_regclass('public.vehicles') IS NULL
      OR to_regclass('public.route_plans') IS NULL
      OR to_regclass('public.route_legs') IS NULL
      OR to_regclass('public.road_leg_vehicles') IS NULL
      OR to_regclass('public.road_leg_vehicle_horses') IS NULL
      OR to_regclass('public.road_vehicle_executions') IS NULL
      OR to_regclass('public.air_leg_executions') IS NULL
      OR to_regclass('public.checkpoints') IS NULL
      OR to_regclass('public.vehicle_checkpoint_arrivals') IS NULL
      OR to_regclass('public.welfare_evidence') IS NULL
      OR to_regclass('public.proofs_of_delivery') IS NULL
      OR to_regclass('public.notifications') IS NULL
      OR to_regclass('public.status_audit_logs') IS NULL
      OR to_regclass('public.flyway_schema_history') IS NULL THEN
    RAISE EXCEPTION 'Required Sprint 3 schema objects are missing';
  END IF;

  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'route_legs'
        AND column_name IN ('id', 'route_plan_id', 'sequence_no', 'leg_type', 'origin',
                            'destination', 'planned_departure_at', 'planned_arrival_at',
                            'air_provider_name', 'air_reference', 'air_capacity_horses',
                            'equipment_details', 'status', 'notes', 'created_at')) <> 15
      OR (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'road_vehicle_executions'
            AND column_name IN ('id', 'road_leg_vehicle_id', 'driver_id', 'escort_id',
                                'status', 'assigned_at')) <> 6
      OR (SELECT count(*) FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'air_leg_executions'
            AND column_name IN ('id', 'route_leg_id', 'escort_id', 'status', 'assigned_at')) <> 5 THEN
    RAISE EXCEPTION 'Required Sprint 3 fixture columns are missing';
  END IF;

  IF (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'transport_mode' AND e.enumlabel = 'COMBINED') <> 1
      OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'route_leg_type' AND e.enumlabel IN ('AIR', 'ROAD')) <> 2
      OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'route_leg_status' AND e.enumlabel IN ('PLANNED', 'READY')) <> 2
      OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'execution_status' AND e.enumlabel = 'NOT_STARTED') <> 1
      OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'order_status' AND e.enumlabel = 'READY_TO_SHIP') <> 1
      OR (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'order_horse_document_status' AND e.enumlabel = 'ELIGIBLE_FOR_EXPORT') <> 1 THEN
    RAISE EXCEPTION 'Required Sprint 3 enum values are missing';
  END IF;

  SELECT id INTO customer FROM users
  WHERE email = 'customer.s3demo@example.com' AND role = 'CUSTOMER' AND status = 'ACTIVE';
  SELECT id INTO lm FROM users
  WHERE email = 'lm.s3demo@example.com' AND role = 'LOGISTICS_MANAGER' AND status = 'ACTIVE';
  SELECT id INTO frc FROM users
  WHERE email = 'frc.s3demo@example.com' AND role = 'FLEET_ROUTE_COORDINATOR' AND status = 'ACTIVE';
  SELECT id INTO driver1 FROM users
  WHERE email = 'driver1.s3demo@example.com' AND role = 'DRIVER' AND status = 'ACTIVE';
  SELECT id INTO driver2 FROM users
  WHERE email = 'driver2.s3demo@example.com' AND role = 'DRIVER' AND status = 'ACTIVE';
  SELECT id INTO escort1 FROM users
  WHERE email = 'escort1.s3demo@example.com' AND role = 'ESCORT' AND status = 'ACTIVE';
  SELECT id INTO escort2 FROM users
  WHERE email = 'escort2.s3demo@example.com' AND role = 'ESCORT' AND status = 'ACTIVE';

  IF customer IS NULL OR lm IS NULL OR frc IS NULL OR driver1 IS NULL OR driver2 IS NULL
      OR escort1 IS NULL OR escort2 IS NULL THEN
    RAISE EXCEPTION 'Required ACTIVE Sprint 3 demo accounts with exact roles are missing';
  END IF;
  IF driver1 = driver2 OR escort1 = escort2 THEN
    RAISE EXCEPTION 'Each multi-vehicle ROAD leg requires two distinct Drivers and Escorts';
  END IF;
  IF NOT (order_01_air_start < order_01_air_end
      AND order_01_air_end < order_01_road_start
      AND order_01_road_start < order_01_road_end
      AND order_01_road_end < order_02_air_start
      AND order_02_air_start < order_02_air_end
      AND order_02_air_end < order_02_road_start
      AND order_02_road_start < order_02_road_end) THEN
    RAISE EXCEPTION 'Fixture schedules must be ordered and non-overlapping';
  END IF;

  IF EXISTS (SELECT 1 FROM horses
      WHERE id IN ('d7000000-0000-0000-0000-000000000001',
                   'd7000000-0000-0000-0000-000000000002',
                   'd7000000-0000-0000-0000-000000000003',
                   'd7000000-0000-0000-0000-000000000004')
         OR microchip_id IN ('S3DEMO-20261104-AIR-MVR-01-MICRO-001',
                             'S3DEMO-20261104-AIR-MVR-01-MICRO-002',
                             'S3DEMO-20261104-AIR-MVR-02-MICRO-001',
                             'S3DEMO-20261104-AIR-MVR-02-MICRO-002')
         OR passport_number IN ('S3DEMO-20261104-AIR-MVR-01-PASS-001',
                                'S3DEMO-20261104-AIR-MVR-01-PASS-002',
                                'S3DEMO-20261104-AIR-MVR-02-PASS-001',
                                'S3DEMO-20261104-AIR-MVR-02-PASS-002'))
    OR EXISTS (SELECT 1 FROM transport_orders
      WHERE id IN ('d7100000-0000-0000-0000-000000000001',
                   'd7100000-0000-0000-0000-000000000002')
         OR order_code IN ('S3DEMO-20261104-AIR-MVR-01', 'S3DEMO-20261104-AIR-MVR-02'))
    OR EXISTS (SELECT 1 FROM transport_order_horses
      WHERE id IN ('d7200000-0000-0000-0000-000000000001',
                   'd7200000-0000-0000-0000-000000000002',
                   'd7200000-0000-0000-0000-000000000003',
                   'd7200000-0000-0000-0000-000000000004'))
    OR EXISTS (SELECT 1 FROM vehicles
      WHERE id IN ('d7300000-0000-0000-0000-000000000001',
                   'd7300000-0000-0000-0000-000000000002',
                   'd7300000-0000-0000-0000-000000000003',
                   'd7300000-0000-0000-0000-000000000004')
         OR plate_number IN ('S3DEMO-20261104-MVR-01-A', 'S3DEMO-20261104-MVR-01-B',
                             'S3DEMO-20261104-MVR-02-A', 'S3DEMO-20261104-MVR-02-B'))
    OR EXISTS (SELECT 1 FROM route_plans
      WHERE id IN ('d7400000-0000-0000-0000-000000000001',
                   'd7400000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM route_legs
      WHERE id IN ('d7500000-0000-0000-0000-000000000001',
                   'd7500000-0000-0000-0000-000000000002',
                   'd7500000-0000-0000-0000-000000000003',
                   'd7500000-0000-0000-0000-000000000004')
         OR air_reference IN ('S3DEMO-20261104-AIR-MVR-01-FLIGHT-001',
                              'S3DEMO-20261104-AIR-MVR-02-FLIGHT-001'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicles
      WHERE id IN ('d7600000-0000-0000-0000-000000000001',
                   'd7600000-0000-0000-0000-000000000002',
                   'd7600000-0000-0000-0000-000000000003',
                   'd7600000-0000-0000-0000-000000000004'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicle_horses
      WHERE id IN ('d7700000-0000-0000-0000-000000000001',
                   'd7700000-0000-0000-0000-000000000002',
                   'd7700000-0000-0000-0000-000000000003',
                   'd7700000-0000-0000-0000-000000000004'))
    OR EXISTS (SELECT 1 FROM road_vehicle_executions
      WHERE id IN ('d7800000-0000-0000-0000-000000000001',
                   'd7800000-0000-0000-0000-000000000002',
                   'd7800000-0000-0000-0000-000000000003',
                   'd7800000-0000-0000-0000-000000000004'))
    OR EXISTS (SELECT 1 FROM air_leg_executions
      WHERE id IN ('d7900000-0000-0000-0000-000000000001',
                   'd7900000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM checkpoints
      WHERE id IN ('d7a00000-0000-0000-0000-000000000001',
                   'd7a00000-0000-0000-0000-000000000002')) THEN
    RAISE EXCEPTION 'A demo fixture identifier or business key already exists';
  END IF;

  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.driver_id IN (driver1, driver2)
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND ((order_01_road_start < leg.planned_arrival_at AND order_01_road_end > leg.planned_departure_at)
        OR (order_02_road_start < leg.planned_arrival_at AND order_02_road_end > leg.planned_departure_at))
  ) THEN
    RAISE EXCEPTION 'A selected Driver has an overlapping non-completed ROAD assignment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.escort_id IN (escort1, escort2)
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND ((order_01_air_start < leg.planned_arrival_at AND order_01_road_end > leg.planned_departure_at)
        OR (order_02_air_start < leg.planned_arrival_at AND order_02_road_end > leg.planned_departure_at))
  ) OR EXISTS (
    SELECT 1 FROM air_leg_executions execution
    JOIN route_legs leg ON leg.id = execution.route_leg_id
    WHERE execution.escort_id IN (escort1, escort2)
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND ((order_01_air_start < leg.planned_arrival_at AND order_01_road_end > leg.planned_departure_at)
        OR (order_02_air_start < leg.planned_arrival_at AND order_02_road_end > leg.planned_departure_at))
  ) THEN
    RAISE EXCEPTION 'A selected Escort has an overlapping non-completed ROAD/AIR assignment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM road_leg_vehicles road_vehicle
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    JOIN route_plans plan ON plan.id = leg.route_plan_id
    JOIN transport_orders transport_order ON transport_order.id = plan.transport_order_id
    WHERE road_vehicle.vehicle_id IN ('d7300000-0000-0000-0000-000000000001',
                                      'd7300000-0000-0000-0000-000000000002',
                                      'd7300000-0000-0000-0000-000000000003',
                                      'd7300000-0000-0000-0000-000000000004')
      AND transport_order.status NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')
      AND ((order_01_road_start < leg.planned_arrival_at AND order_01_road_end > leg.planned_departure_at)
        OR (order_02_road_start < leg.planned_arrival_at AND order_02_road_end > leg.planned_departure_at))
  ) THEN
    RAISE EXCEPTION 'A synthetic Vehicle identifier has a conflicting allocation';
  END IF;
END
$preflight$;

SELECT 'S3DEMO-20261104-AIR-MVR-01' AS fixture,
       18 AS expected_setup_records,
       'READY_TO_SHIP' AS order_status,
       'READY,PLANNED' AS leg_statuses,
       'NOT_STARTED' AS execution_status,
       true AS collision_free,
       true AS staffing_overlap_free
UNION ALL
SELECT 'S3DEMO-20261104-AIR-MVR-02', 18, 'READY_TO_SHIP', 'READY,PLANNED',
       'NOT_STARTED', true, true;

ROLLBACK;
