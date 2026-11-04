\set ON_ERROR_STOP on

-- This performs only the independently approved read-only identity check.
\ir sprint3-road-road-target-preflight.sql

\if :{?write_confirmation}
\else
  \echo 'write_confirmation is required'
  \quit 3
\endif
SELECT :'write_confirmation' = 'WRITE-S3QA-R2R-001@horse-transport-system/PRODUCTION'
  AS write_confirmed \gset
\if :write_confirmed
\else
  \echo 'write_confirmation does not authorize S3QA-R2R-001 on horse-transport-system/PRODUCTION'
  \quit 3
\endif

BEGIN;

DO $fixture$
DECLARE
  customer uuid;
  frc uuid;
  driver1 uuid;
  driver2 uuid;
  escort1 uuid;
  escort2 uuid;
  leg1_start constant timestamp := timestamp '2099-01-15 08:00:00';
  leg1_end constant timestamp := timestamp '2099-01-15 12:00:00';
  leg2_start constant timestamp := timestamp '2099-01-15 13:00:00';
  leg2_end constant timestamp := timestamp '2099-01-15 17:00:00';
BEGIN
  SELECT id INTO customer FROM users
  WHERE email = 'customer.s3demo@example.com' AND role = 'CUSTOMER' AND status = 'ACTIVE';
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

  IF customer IS NULL OR frc IS NULL OR driver1 IS NULL OR driver2 IS NULL
      OR escort1 IS NULL OR escort2 IS NULL THEN
    RAISE EXCEPTION 'Required ACTIVE synthetic accounts with exact roles are missing';
  END IF;
  IF driver1 = driver2 OR escort1 = escort2 THEN
    RAISE EXCEPTION 'ROAD-to-ROAD fixture requires distinct staff for its two legs';
  END IF;

  IF EXISTS (SELECT 1 FROM horses
      WHERE id = 'd4000000-0000-0000-0000-000000000001'
         OR microchip_id = 'S3QA-R2R-MICRO-001')
    OR EXISTS (SELECT 1 FROM transport_orders
      WHERE id = 'd4100000-0000-0000-0000-000000000001'
         OR order_code = 'S3QA-R2R-001')
    OR EXISTS (SELECT 1 FROM transport_order_horses
      WHERE id = 'd4200000-0000-0000-0000-000000000001')
    OR EXISTS (SELECT 1 FROM vehicles
      WHERE id IN ('d4300000-0000-0000-0000-000000000001',
                   'd4300000-0000-0000-0000-000000000002')
         OR plate_number IN ('S3QA-R2R-01', 'S3QA-R2R-02'))
    OR EXISTS (SELECT 1 FROM route_plans
      WHERE id = 'd4400000-0000-0000-0000-000000000001')
    OR EXISTS (SELECT 1 FROM route_legs
      WHERE id IN ('d4500000-0000-0000-0000-000000000001',
                   'd4500000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicles
      WHERE id IN ('d4600000-0000-0000-0000-000000000001',
                   'd4600000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicle_horses
      WHERE id IN ('d4700000-0000-0000-0000-000000000001',
                   'd4700000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_vehicle_executions
      WHERE id IN ('d4800000-0000-0000-0000-000000000001',
                   'd4800000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM checkpoints
      WHERE id = 'd4a00000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'An exact S3QA-R2R-001 identifier already exists; no rows were inserted';
  END IF;

  -- Match ExecutionStaffingService: non-completed ROAD overlap for Drivers.
  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.driver_id = driver1
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg1_start < leg.planned_arrival_at AND leg1_end > leg.planned_departure_at
  ) OR EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.driver_id = driver2
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg2_start < leg.planned_arrival_at AND leg2_end > leg.planned_departure_at
  ) THEN
    RAISE EXCEPTION 'A selected Driver has an overlapping non-completed ROAD assignment';
  END IF;

  -- Escorts must be free from both ROAD and AIR overlap.
  IF EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.escort_id = escort1
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg1_start < leg.planned_arrival_at AND leg1_end > leg.planned_departure_at
  ) OR EXISTS (
    SELECT 1 FROM air_leg_executions execution
    JOIN route_legs leg ON leg.id = execution.route_leg_id
    WHERE execution.escort_id = escort1
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg1_start < leg.planned_arrival_at AND leg1_end > leg.planned_departure_at
  ) OR EXISTS (
    SELECT 1 FROM road_vehicle_executions execution
    JOIN road_leg_vehicles road_vehicle ON road_vehicle.id = execution.road_leg_vehicle_id
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    WHERE execution.escort_id = escort2
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg2_start < leg.planned_arrival_at AND leg2_end > leg.planned_departure_at
  ) OR EXISTS (
    SELECT 1 FROM air_leg_executions execution
    JOIN route_legs leg ON leg.id = execution.route_leg_id
    WHERE execution.escort_id = escort2
      AND execution.status IN ('NOT_STARTED', 'IN_PROGRESS', 'DESTINATION')
      AND leg2_start < leg.planned_arrival_at AND leg2_end > leg.planned_departure_at
  ) THEN
    RAISE EXCEPTION 'A selected Escort has an overlapping non-completed ROAD/AIR assignment';
  END IF;

  -- New synthetic Vehicles must have no allocation history under their exact IDs.
  IF EXISTS (
    SELECT 1 FROM road_leg_vehicles road_vehicle
    JOIN route_legs leg ON leg.id = road_vehicle.route_leg_id
    JOIN route_plans plan ON plan.id = leg.route_plan_id
    JOIN transport_orders transport_order ON transport_order.id = plan.transport_order_id
    WHERE road_vehicle.vehicle_id IN ('d4300000-0000-0000-0000-000000000001',
                                      'd4300000-0000-0000-0000-000000000002')
      AND transport_order.status NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')
      AND ((leg1_start < leg.planned_arrival_at AND leg1_end > leg.planned_departure_at)
        OR (leg2_start < leg.planned_arrival_at AND leg2_end > leg.planned_departure_at))
  ) THEN
    RAISE EXCEPTION 'A synthetic Vehicle identifier has a conflicting allocation';
  END IF;

  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d4000000-0000-0000-0000-000000000001', customer, 'S3 QA Relay Star',
      'S3QA-R2R-PASS-001', 'S3QA-R2R-MICRO-001', 'Thoroughbred', 'MARE',
      date '2018-04-12', 'Synthetic ROAD-to-ROAD E2E horse', now());

  INSERT INTO transport_orders(id, order_code, customer_id, origin_address, origin_country,
      destination_address, destination_country, requested_departure_at, transport_mode,
      special_requirements, recipient_name, recipient_phone, recipient_email, status,
      approved_at, ready_to_ship_at, created_at)
  VALUES ('d4100000-0000-0000-0000-000000000001', 'S3QA-R2R-001', customer,
      'S3 QA Lexington Stable', 'US', 'S3 QA Atlanta Stable', 'US', leg1_start, 'ROAD',
      'Synthetic ROAD-to-ROAD E2E fixture only', 'S3 QA Receiver', '+10000000901',
      'customer.s3demo@example.com', 'READY_TO_SHIP', now(), now(), now());

  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d4200000-0000-0000-0000-000000000001',
      'd4100000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001', 'ELIGIBLE_FOR_EXPORT', now());

  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status,
      notes, created_at)
  VALUES
    ('d4300000-0000-0000-0000-000000000001', 'S3QA-R2R-01',
      'S3 QA Relay Van 1', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic ROAD-to-ROAD E2E Vehicle', now()),
    ('d4300000-0000-0000-0000-000000000002', 'S3QA-R2R-02',
      'S3 QA Relay Van 2', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic ROAD-to-ROAD E2E Vehicle', now());

  INSERT INTO route_plans(id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
  VALUES ('d4400000-0000-0000-0000-000000000001',
      'd4100000-0000-0000-0000-000000000001', 'APPROVED', frc, now(), now(), now());

  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES
    ('d4500000-0000-0000-0000-000000000001',
      'd4400000-0000-0000-0000-000000000001', 1, 'ROAD',
      'S3 QA Lexington Stable', 'S3 QA Nashville Transfer', leg1_start, leg1_end,
      null, null, null, null, 'READY', 'Synthetic non-final ROAD leg', now()),
    ('d4500000-0000-0000-0000-000000000002',
      'd4400000-0000-0000-0000-000000000001', 2, 'ROAD',
      'S3 QA Nashville Transfer', 'S3 QA Atlanta Stable', leg2_start, leg2_end,
      null, null, null, null, 'PLANNED', 'Synthetic final ROAD leg', now());

  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES
    ('d4600000-0000-0000-0000-000000000001',
      'd4500000-0000-0000-0000-000000000001',
      'd4300000-0000-0000-0000-000000000001', now()),
    ('d4600000-0000-0000-0000-000000000002',
      'd4500000-0000-0000-0000-000000000002',
      'd4300000-0000-0000-0000-000000000002', now());

  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id,
      transport_order_horse_id, assigned_at)
  VALUES
    ('d4700000-0000-0000-0000-000000000001',
      'd4500000-0000-0000-0000-000000000001',
      'd4600000-0000-0000-0000-000000000001',
      'd4200000-0000-0000-0000-000000000001', now()),
    ('d4700000-0000-0000-0000-000000000002',
      'd4500000-0000-0000-0000-000000000002',
      'd4600000-0000-0000-0000-000000000002',
      'd4200000-0000-0000-0000-000000000001', now());

  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id,
      status, assigned_at)
  VALUES
    ('d4800000-0000-0000-0000-000000000001',
      'd4600000-0000-0000-0000-000000000001', driver1, escort1, 'NOT_STARTED', now()),
    ('d4800000-0000-0000-0000-000000000002',
      'd4600000-0000-0000-0000-000000000002', driver2, escort2, 'NOT_STARTED', now());

  INSERT INTO checkpoints(id, route_leg_id, sequence_no, name, checkpoint_type, country_code,
      minimum_required_stop_minutes, planned_stop_duration_minutes, notes, created_at)
  VALUES ('d4a00000-0000-0000-0000-000000000001',
      'd4500000-0000-0000-0000-000000000001', 1, 'S3 QA Relay Rest Stop',
      'REST_STOP', 'US', 15, 20, 'Synthetic Leg 1 welfare checkpoint', now());
END
$fixture$;

COMMIT;
