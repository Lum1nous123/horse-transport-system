\set ON_ERROR_STOP on

-- Reuse the owner-approved Supabase identity guard. It truthfully preserves
-- the PRODUCTION branch label and performs no writes.
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
  air_mvr_air_start constant timestamp := timestamp '2099-02-01 08:00:00';
  air_mvr_air_end constant timestamp := timestamp '2099-02-01 12:00:00';
  air_mvr_road_start constant timestamp := timestamp '2099-02-01 13:00:00';
  air_mvr_road_end constant timestamp := timestamp '2099-02-01 18:00:00';
  air_final_start constant timestamp := timestamp '2099-02-02 08:00:00';
  air_final_end constant timestamp := timestamp '2099-02-02 12:00:00';
BEGIN
  IF current_setting('transaction_read_only') <> 'on' THEN
    RAISE EXCEPTION 'Final browser fixture preflight must be read only';
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

  IF (SELECT count(*) FROM pg_enum enum_value
      JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
      WHERE enum_type.typname = 'transport_mode'
        AND enum_value.enumlabel IN ('AIR', 'COMBINED')) <> 2
      OR (SELECT count(*) FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'route_leg_type'
            AND enum_value.enumlabel IN ('AIR', 'ROAD')) <> 2
      OR (SELECT count(*) FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'route_leg_status'
            AND enum_value.enumlabel IN ('PLANNED', 'READY')) <> 2
      OR (SELECT count(*) FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'execution_status'
            AND enum_value.enumlabel = 'NOT_STARTED') <> 1
      OR (SELECT count(*) FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'order_status'
            AND enum_value.enumlabel = 'READY_TO_SHIP') <> 1
      OR (SELECT count(*) FROM pg_enum enum_value
          JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
          WHERE enum_type.typname = 'order_horse_document_status'
            AND enum_value.enumlabel = 'ELIGIBLE_FOR_EXPORT') <> 1 THEN
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
    RAISE EXCEPTION 'Multi-vehicle ROAD requires two distinct Drivers and two distinct Escorts';
  END IF;

  IF NOT (air_mvr_air_start < air_mvr_air_end
      AND air_mvr_air_end < air_mvr_road_start
      AND air_mvr_road_start < air_mvr_road_end
      AND air_mvr_road_end < air_final_start
      AND air_final_start < air_final_end) THEN
    RAISE EXCEPTION 'Fixture schedule is not strictly ordered and non-overlapping';
  END IF;

  IF EXISTS (SELECT 1 FROM horses
      WHERE id IN ('d5000000-0000-0000-0000-000000000001',
                   'd5000000-0000-0000-0000-000000000002',
                   'd5000000-0000-0000-0000-000000000003')
         OR microchip_id IN ('S3QA-AIR-MVR-MICRO-001', 'S3QA-AIR-MVR-MICRO-002',
                             'S3QA-AIR-FINAL-MICRO-001')
         OR passport_number IN ('S3QA-AIR-MVR-PASS-001', 'S3QA-AIR-MVR-PASS-002',
                                'S3QA-AIR-FINAL-PASS-001'))
    OR EXISTS (SELECT 1 FROM transport_orders
      WHERE id IN ('d5100000-0000-0000-0000-000000000001',
                   'd5100000-0000-0000-0000-000000000002')
         OR order_code IN ('S3QA-AIR-MVR-001', 'S3QA-AIR-FINAL-001'))
    OR EXISTS (SELECT 1 FROM transport_order_horses
      WHERE id IN ('d5200000-0000-0000-0000-000000000001',
                   'd5200000-0000-0000-0000-000000000002',
                   'd5200000-0000-0000-0000-000000000003'))
    OR EXISTS (SELECT 1 FROM vehicles
      WHERE id IN ('d5300000-0000-0000-0000-000000000001',
                   'd5300000-0000-0000-0000-000000000002')
         OR plate_number IN ('S3QA-AIR-MVR-01', 'S3QA-AIR-MVR-02'))
    OR EXISTS (SELECT 1 FROM route_plans
      WHERE id IN ('d5400000-0000-0000-0000-000000000001',
                   'd5400000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM route_legs
      WHERE id IN ('d5500000-0000-0000-0000-000000000001',
                   'd5500000-0000-0000-0000-000000000002',
                   'd5500000-0000-0000-0000-000000000003')
         OR air_reference IN ('S3QA-AIR-MVR-FLIGHT-001', 'S3QA-AIR-FINAL-FLIGHT-001'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicles
      WHERE id IN ('d5600000-0000-0000-0000-000000000001',
                   'd5600000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicle_horses
      WHERE id IN ('d5700000-0000-0000-0000-000000000001',
                   'd5700000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_vehicle_executions
      WHERE id IN ('d5800000-0000-0000-0000-000000000001',
                   'd5800000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM air_leg_executions
      WHERE id IN ('d5900000-0000-0000-0000-000000000001',
                   'd5900000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM checkpoints
      WHERE id = 'd5a00000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'A final browser fixture identifier or business key already exists';
  END IF;

  -- Drivers are checked only against non-completed ROAD assignments.
  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.driver_id IN (driver1, driver2)
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND air_mvr_road_start < leg.planned_arrival_at
      AND air_mvr_road_end > leg.planned_departure_at
  ) THEN
    RAISE EXCEPTION 'A selected Driver has an overlapping non-completed ROAD assignment';
  END IF;

  -- Escorts are checked against both ROAD and AIR non-completed assignments.
  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND ((execution.escort_id = escort1
            AND ((air_mvr_air_start < leg.planned_arrival_at AND air_mvr_air_end > leg.planned_departure_at)
              OR (air_mvr_road_start < leg.planned_arrival_at AND air_mvr_road_end > leg.planned_departure_at)
              OR (air_final_start < leg.planned_arrival_at AND air_final_end > leg.planned_departure_at)))
        OR (execution.escort_id = escort2
            AND air_mvr_road_start < leg.planned_arrival_at
            AND air_mvr_road_end > leg.planned_departure_at))
  ) OR EXISTS (
    SELECT 1 FROM air_leg_executions execution
    JOIN route_legs leg ON leg.id = execution.route_leg_id
    WHERE execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND ((execution.escort_id = escort1
            AND ((air_mvr_air_start < leg.planned_arrival_at AND air_mvr_air_end > leg.planned_departure_at)
              OR (air_mvr_road_start < leg.planned_arrival_at AND air_mvr_road_end > leg.planned_departure_at)
              OR (air_final_start < leg.planned_arrival_at AND air_final_end > leg.planned_departure_at)))
        OR (execution.escort_id = escort2
            AND air_mvr_road_start < leg.planned_arrival_at
            AND air_mvr_road_end > leg.planned_departure_at))
  ) THEN
    RAISE EXCEPTION 'A selected Escort has an overlapping non-completed ROAD/AIR assignment';
  END IF;

  IF EXISTS (
    SELECT 1 FROM road_leg_vehicles road_vehicle
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    JOIN route_plans plan ON plan.id = leg.route_plan_id
    JOIN transport_orders transport_order ON transport_order.id = plan.transport_order_id
    WHERE road_vehicle.vehicle_id IN ('d5300000-0000-0000-0000-000000000001',
                                      'd5300000-0000-0000-0000-000000000002')
      AND transport_order.status NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')
      AND air_mvr_road_start < leg.planned_arrival_at
      AND air_mvr_road_end > leg.planned_departure_at
  ) THEN
    RAISE EXCEPTION 'A synthetic Vehicle identifier has a conflicting allocation';
  END IF;
END
$preflight$;

SELECT 'S3QA-AIR-MVR-001' AS fixture,
       18 AS expected_setup_records,
       'READY_TO_SHIP' AS order_status,
       'READY,PLANNED' AS leg_statuses,
       'NOT_STARTED' AS execution_status,
       true AS collision_free,
       true AS staffing_overlap_free
UNION ALL
SELECT 'S3QA-AIR-FINAL-001', 6, 'READY_TO_SHIP', 'READY', 'NOT_STARTED', true, true;

ROLLBACK;
