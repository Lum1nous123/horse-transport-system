\set ON_ERROR_STOP on

-- Run the independently pinned, read-only target/schema/data preflight first.
\ir sprint3-manual-20261101-target-preflight.sql

\if :{?write_confirmation_air_mvr}
\else
  \echo 'write_confirmation_air_mvr is required'
  \quit 3
\endif
\if :{?write_confirmation_air_final}
\else
  \echo 'write_confirmation_air_final is required'
  \quit 3
\endif

SELECT :'write_confirmation_air_mvr' =
       'WRITE-S3MANUAL-20261101-AIR-MVR@horse-transport-system/PRODUCTION'
  AS air_mvr_write_confirmed \gset
SELECT :'write_confirmation_air_final' =
       'WRITE-S3MANUAL-20261101-AIR-FINAL@horse-transport-system/PRODUCTION'
  AS air_final_write_confirmed \gset
\if :air_mvr_write_confirmed
\else
  \echo 'AIR-to-multi-vehicle-ROAD fixture write confirmation is invalid'
  \quit 3
\endif
\if :air_final_write_confirmed
\else
  \echo 'Final AIR fixture write confirmation is invalid'
  \quit 3
\endif

BEGIN;

DO $fixture$
DECLARE
  customer uuid;
  lm uuid;
  frc uuid;
  driver1 uuid;
  driver2 uuid;
  escort1 uuid;
  escort2 uuid;
  air_mvr_air_start constant timestamp := timestamp '2099-03-01 08:00:00';
  air_mvr_air_end constant timestamp := timestamp '2099-03-01 12:00:00';
  air_mvr_road_start constant timestamp := timestamp '2099-03-01 13:00:00';
  air_mvr_road_end constant timestamp := timestamp '2099-03-01 18:00:00';
  air_final_start constant timestamp := timestamp '2099-03-02 08:00:00';
  air_final_end constant timestamp := timestamp '2099-03-02 12:00:00';
BEGIN
  -- Repeat every volatile guard inside the write transaction to close the gap
  -- between read-only preflight and insertion.
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
      WHERE id IN ('d6000000-0000-0000-0000-000000000001',
                   'd6000000-0000-0000-0000-000000000002',
                   'd6000000-0000-0000-0000-000000000003')
         OR microchip_id IN ('S3MANUAL-20261101-AIR-MVR-MICRO-001', 'S3MANUAL-20261101-AIR-MVR-MICRO-002',
                             'S3MANUAL-20261101-AIR-FINAL-MICRO-001')
         OR passport_number IN ('S3MANUAL-20261101-AIR-MVR-PASS-001', 'S3MANUAL-20261101-AIR-MVR-PASS-002',
                                'S3MANUAL-20261101-AIR-FINAL-PASS-001'))
    OR EXISTS (SELECT 1 FROM transport_orders
      WHERE id IN ('d6100000-0000-0000-0000-000000000001',
                   'd6100000-0000-0000-0000-000000000002')
         OR order_code IN ('S3MANUAL-20261101-AIR-MVR', 'S3MANUAL-20261101-AIR-FINAL'))
    OR EXISTS (SELECT 1 FROM transport_order_horses
      WHERE id IN ('d6200000-0000-0000-0000-000000000001',
                   'd6200000-0000-0000-0000-000000000002',
                   'd6200000-0000-0000-0000-000000000003'))
    OR EXISTS (SELECT 1 FROM vehicles
      WHERE id IN ('d6300000-0000-0000-0000-000000000001',
                   'd6300000-0000-0000-0000-000000000002')
         OR plate_number IN ('S3MANUAL-20261101-AIR-MVR-01', 'S3MANUAL-20261101-AIR-MVR-02'))
    OR EXISTS (SELECT 1 FROM route_plans
      WHERE id IN ('d6400000-0000-0000-0000-000000000001',
                   'd6400000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM route_legs
      WHERE id IN ('d6500000-0000-0000-0000-000000000001',
                   'd6500000-0000-0000-0000-000000000002',
                   'd6500000-0000-0000-0000-000000000003')
         OR air_reference IN ('S3MANUAL-20261101-AIR-MVR-FLIGHT-001', 'S3MANUAL-20261101-AIR-FINAL-FLIGHT-001'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicles
      WHERE id IN ('d6600000-0000-0000-0000-000000000001',
                   'd6600000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_leg_vehicle_horses
      WHERE id IN ('d6700000-0000-0000-0000-000000000001',
                   'd6700000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM road_vehicle_executions
      WHERE id IN ('d6800000-0000-0000-0000-000000000001',
                   'd6800000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM air_leg_executions
      WHERE id IN ('d6900000-0000-0000-0000-000000000001',
                   'd6900000-0000-0000-0000-000000000002'))
    OR EXISTS (SELECT 1 FROM checkpoints
      WHERE id = 'd6a00000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'A manual testing fixture identifier or business key already exists; no rows were inserted';
  END IF;

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
    WHERE road_vehicle.vehicle_id IN ('d6300000-0000-0000-0000-000000000001',
                                      'd6300000-0000-0000-0000-000000000002')
      AND transport_order.status NOT IN ('DELIVERED', 'REJECTED', 'CANCELLED')
      AND air_mvr_road_start < leg.planned_arrival_at
      AND air_mvr_road_end > leg.planned_departure_at
  ) THEN
    RAISE EXCEPTION 'A synthetic Vehicle identifier has a conflicting allocation';
  END IF;

  -- Fixture A: 18 records.
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d6000000-0000-0000-0000-000000000001', customer, 'S3 Manual Air Road Star',
      'S3MANUAL-20261101-AIR-MVR-PASS-001', 'S3MANUAL-20261101-AIR-MVR-MICRO-001', 'Thoroughbred', 'MARE',
      date '2018-04-12', 'Synthetic manual testing horse A1', now());

  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d6000000-0000-0000-0000-000000000002', customer, 'S3 Manual Air Road Moon',
      'S3MANUAL-20261101-AIR-MVR-PASS-002', 'S3MANUAL-20261101-AIR-MVR-MICRO-002', 'Warmblood', 'GELDING',
      date '2017-08-03', 'Synthetic manual testing horse A2', now());

  INSERT INTO transport_orders(id, order_code, customer_id, origin_address, origin_country,
      destination_address, destination_country, requested_departure_at, transport_mode,
      special_requirements, recipient_name, recipient_phone, recipient_email, status,
      approved_at, ready_to_ship_at, created_at)
  VALUES ('d6100000-0000-0000-0000-000000000001', 'S3MANUAL-20261101-AIR-MVR', customer,
      'S3 Manual JFK Cargo', 'US', 'S3 Manual Amsterdam Stable', 'NL', air_mvr_air_start, 'COMBINED',
      'Synthetic AIR-to-multi-vehicle-ROAD browser E2E fixture', 'S3 Manual Receiver A',
      '+10000000911', 'customer.s3demo@example.com', 'READY_TO_SHIP', now(), now(), now());

  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d6200000-0000-0000-0000-000000000001',
      'd6100000-0000-0000-0000-000000000001',
      'd6000000-0000-0000-0000-000000000001', 'ELIGIBLE_FOR_EXPORT', now());

  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d6200000-0000-0000-0000-000000000002',
      'd6100000-0000-0000-0000-000000000001',
      'd6000000-0000-0000-0000-000000000002', 'ELIGIBLE_FOR_EXPORT', now());

  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status,
      notes, created_at)
  VALUES ('d6300000-0000-0000-0000-000000000001', 'S3MANUAL-20261101-AIR-MVR-01',
      'S3 Manual Final Road Van 1', 'HORSE_VAN', 1, 'AVAILABLE',
      'Synthetic manual testing Vehicle A1', now());

  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status,
      notes, created_at)
  VALUES ('d6300000-0000-0000-0000-000000000002', 'S3MANUAL-20261101-AIR-MVR-02',
      'S3 Manual Final Road Van 2', 'HORSE_VAN', 1, 'AVAILABLE',
      'Synthetic manual testing Vehicle A2', now());

  INSERT INTO route_plans(id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
  VALUES ('d6400000-0000-0000-0000-000000000001',
      'd6100000-0000-0000-0000-000000000001', 'APPROVED', frc, now(), now(), now());

  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d6500000-0000-0000-0000-000000000001',
      'd6400000-0000-0000-0000-000000000001', 1, 'AIR',
      'S3 Manual JFK Cargo', 'S3 Manual Brussels Transfer', air_mvr_air_start, air_mvr_air_end,
      'S3 Manual Air', 'S3MANUAL-20261101-AIR-MVR-FLIGHT-001', 2, 'Synthetic two-horse air stalls',
      'READY', 'Synthetic non-final AIR leg', now());

  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d6500000-0000-0000-0000-000000000002',
      'd6400000-0000-0000-0000-000000000001', 2, 'ROAD',
      'S3 Manual Brussels Transfer', 'S3 Manual Amsterdam Stable', air_mvr_road_start, air_mvr_road_end,
      null, null, null, null, 'PLANNED', 'Synthetic final multi-vehicle ROAD leg', now());

  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d6600000-0000-0000-0000-000000000001',
      'd6500000-0000-0000-0000-000000000002',
      'd6300000-0000-0000-0000-000000000001', now());

  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d6600000-0000-0000-0000-000000000002',
      'd6500000-0000-0000-0000-000000000002',
      'd6300000-0000-0000-0000-000000000002', now());

  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id,
      transport_order_horse_id, assigned_at)
  VALUES ('d6700000-0000-0000-0000-000000000001',
      'd6500000-0000-0000-0000-000000000002',
      'd6600000-0000-0000-0000-000000000001',
      'd6200000-0000-0000-0000-000000000001', now());

  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id,
      transport_order_horse_id, assigned_at)
  VALUES ('d6700000-0000-0000-0000-000000000002',
      'd6500000-0000-0000-0000-000000000002',
      'd6600000-0000-0000-0000-000000000002',
      'd6200000-0000-0000-0000-000000000002', now());

  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id,
      status, assigned_at)
  VALUES ('d6800000-0000-0000-0000-000000000001',
      'd6600000-0000-0000-0000-000000000001', driver1, escort1, 'NOT_STARTED', now());

  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id,
      status, assigned_at)
  VALUES ('d6800000-0000-0000-0000-000000000002',
      'd6600000-0000-0000-0000-000000000002', driver2, escort2, 'NOT_STARTED', now());

  INSERT INTO air_leg_executions(id, route_leg_id, escort_id, status, assigned_at)
  VALUES ('d6900000-0000-0000-0000-000000000001',
      'd6500000-0000-0000-0000-000000000001', escort1, 'NOT_STARTED', now());

  INSERT INTO checkpoints(id, route_leg_id, sequence_no, name, checkpoint_type, country_code,
      minimum_required_stop_minutes, planned_stop_duration_minutes, notes, created_at)
  VALUES ('d6a00000-0000-0000-0000-000000000001',
      'd6500000-0000-0000-0000-000000000002', 1, 'S3 Manual Multi-Vehicle Rest Stop',
      'REST_STOP', 'BE', 15, 20, 'Shared checkpoint; each Vehicle records its own arrival and welfare', now());

  -- Fixture B: 6 records.
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d6000000-0000-0000-0000-000000000003', customer, 'S3 Manual Final Air Cloud',
      'S3MANUAL-20261101-AIR-FINAL-PASS-001', 'S3MANUAL-20261101-AIR-FINAL-MICRO-001', 'Arabian', 'MARE',
      date '2019-02-18', 'Synthetic manual testing horse B1', now());

  INSERT INTO transport_orders(id, order_code, customer_id, origin_address, origin_country,
      destination_address, destination_country, requested_departure_at, transport_mode,
      special_requirements, recipient_name, recipient_phone, recipient_email, status,
      approved_at, ready_to_ship_at, created_at)
  VALUES ('d6100000-0000-0000-0000-000000000002', 'S3MANUAL-20261101-AIR-FINAL', customer,
      'S3 Manual Brussels Cargo', 'BE', 'S3 Manual Dubai Stable', 'AE', air_final_start, 'AIR',
      'Synthetic single-leg final AIR browser E2E fixture', 'S3 Manual Receiver B',
      '+10000000912', 'customer.s3demo@example.com', 'READY_TO_SHIP', now(), now(), now());

  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d6200000-0000-0000-0000-000000000003',
      'd6100000-0000-0000-0000-000000000002',
      'd6000000-0000-0000-0000-000000000003', 'ELIGIBLE_FOR_EXPORT', now());

  INSERT INTO route_plans(id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
  VALUES ('d6400000-0000-0000-0000-000000000002',
      'd6100000-0000-0000-0000-000000000002', 'APPROVED', frc, now(), now(), now());

  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d6500000-0000-0000-0000-000000000003',
      'd6400000-0000-0000-0000-000000000002', 1, 'AIR',
      'S3 Manual Brussels Cargo', 'S3 Manual Dubai Stable', air_final_start, air_final_end,
      'S3 Manual Air', 'S3MANUAL-20261101-AIR-FINAL-FLIGHT-001', 1, 'Synthetic single-horse air stall',
      'READY', 'Synthetic single final AIR leg', now());

  INSERT INTO air_leg_executions(id, route_leg_id, escort_id, status, assigned_at)
  VALUES ('d6900000-0000-0000-0000-000000000002',
      'd6500000-0000-0000-0000-000000000003', escort1, 'NOT_STARTED', now());

  IF (SELECT count(*) FROM horses
      WHERE id IN ('d6000000-0000-0000-0000-000000000001',
                   'd6000000-0000-0000-0000-000000000002')) <> 2
      OR (SELECT count(*) FROM route_legs
          WHERE route_plan_id = 'd6400000-0000-0000-0000-000000000001') <> 2
      OR (SELECT count(*) FROM road_leg_vehicle_horses
          WHERE route_leg_id = 'd6500000-0000-0000-0000-000000000002') <> 2
      OR (SELECT count(*) FROM road_vehicle_executions
          WHERE road_leg_vehicle_id IN ('d6600000-0000-0000-0000-000000000001',
                                        'd6600000-0000-0000-0000-000000000002')) <> 2
      OR (SELECT count(*) FROM air_leg_executions
          WHERE id = 'd6900000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'S3MANUAL-20261101-AIR-MVR graph validation failed';
  END IF;

  IF (SELECT count(*) FROM horses
      WHERE id = 'd6000000-0000-0000-0000-000000000003') <> 1
      OR (SELECT count(*) FROM route_legs
          WHERE route_plan_id = 'd6400000-0000-0000-0000-000000000002') <> 1
      OR (SELECT count(*) FROM air_leg_executions
          WHERE id = 'd6900000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'S3MANUAL-20261101-AIR-FINAL graph validation failed';
  END IF;
END
$fixture$;

COMMIT;
