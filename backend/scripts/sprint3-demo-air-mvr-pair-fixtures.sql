\set ON_ERROR_STOP on

-- This script is intentionally write-capable. It must only run after the
-- independently pinned, read-only target and data preflight passes.
\ir sprint3-demo-air-mvr-pair-target-preflight.sql

\if :{?write_confirmation_order_01}
\else
  \echo 'write_confirmation_order_01 is required'
  \quit 3
\endif
\if :{?write_confirmation_order_02}
\else
  \echo 'write_confirmation_order_02 is required'
  \quit 3
\endif

SELECT :'write_confirmation_order_01' =
       'WRITE-S3DEMO-20261104-AIR-MVR-01@horse-transport-system/PRODUCTION'
  AS order_01_write_confirmed \gset
SELECT :'write_confirmation_order_02' =
       'WRITE-S3DEMO-20261104-AIR-MVR-02@horse-transport-system/PRODUCTION'
  AS order_02_write_confirmed \gset
\if :order_01_write_confirmed
\else
  \echo 'Order 01 fixture write confirmation is invalid'
  \quit 3
\endif
\if :order_02_write_confirmed
\else
  \echo 'Order 02 fixture write confirmation is invalid'
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
  order_01_air_start constant timestamp := timestamp '2099-04-01 08:00:00';
  order_01_air_end constant timestamp := timestamp '2099-04-01 12:00:00';
  order_01_road_start constant timestamp := timestamp '2099-04-01 13:00:00';
  order_01_road_end constant timestamp := timestamp '2099-04-01 18:00:00';
  order_02_air_start constant timestamp := timestamp '2099-04-02 08:00:00';
  order_02_air_end constant timestamp := timestamp '2099-04-02 12:00:00';
  order_02_road_start constant timestamp := timestamp '2099-04-02 13:00:00';
  order_02_road_end constant timestamp := timestamp '2099-04-02 18:00:00';
BEGIN
  -- Repeat volatile guards inside the write transaction to close the gap
  -- between read-only preflight and insertion.
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
    RAISE EXCEPTION 'A demo fixture identifier or business key already exists; no rows were inserted';
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

  -- Order 01: exactly 18 records.
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d7000000-0000-0000-0000-000000000001', customer, 'S3 Demo Aurora',
      'S3DEMO-20261104-AIR-MVR-01-PASS-001', 'S3DEMO-20261104-AIR-MVR-01-MICRO-001',
      'Thoroughbred', 'MARE', date '2018-04-12', 'Synthetic demo horse 01-A', now());
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d7000000-0000-0000-0000-000000000002', customer, 'S3 Demo Comet',
      'S3DEMO-20261104-AIR-MVR-01-PASS-002', 'S3DEMO-20261104-AIR-MVR-01-MICRO-002',
      'Warmblood', 'GELDING', date '2017-08-03', 'Synthetic demo horse 01-B', now());
  INSERT INTO transport_orders(id, order_code, customer_id, origin_address, origin_country,
      destination_address, destination_country, requested_departure_at, transport_mode,
      special_requirements, recipient_name, recipient_phone, recipient_email, status,
      approved_at, ready_to_ship_at, created_at)
  VALUES ('d7100000-0000-0000-0000-000000000001', 'S3DEMO-20261104-AIR-MVR-01', customer,
      'Demo JFK Cargo Terminal', 'US', 'Demo Amsterdam Stable', 'NL', order_01_air_start,
      'COMBINED', 'Synthetic AIR-to-multi-vehicle-ROAD demo fixture 01', 'Demo Receiver 01',
      '+10000000701', 'customer.s3demo@example.com', 'READY_TO_SHIP', now(), now(), now());
  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d7200000-0000-0000-0000-000000000001', 'd7100000-0000-0000-0000-000000000001',
      'd7000000-0000-0000-0000-000000000001', 'ELIGIBLE_FOR_EXPORT', now());
  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d7200000-0000-0000-0000-000000000002', 'd7100000-0000-0000-0000-000000000001',
      'd7000000-0000-0000-0000-000000000002', 'ELIGIBLE_FOR_EXPORT', now());
  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status, notes, created_at)
  VALUES ('d7300000-0000-0000-0000-000000000001', 'S3DEMO-20261104-MVR-01-A',
      'S3 Demo Road Van 01-A', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic demo Vehicle 01-A', now());
  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status, notes, created_at)
  VALUES ('d7300000-0000-0000-0000-000000000002', 'S3DEMO-20261104-MVR-01-B',
      'S3 Demo Road Van 01-B', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic demo Vehicle 01-B', now());
  INSERT INTO route_plans(id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
  VALUES ('d7400000-0000-0000-0000-000000000001', 'd7100000-0000-0000-0000-000000000001',
      'APPROVED', frc, now(), now(), now());
  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d7500000-0000-0000-0000-000000000001', 'd7400000-0000-0000-0000-000000000001',
      1, 'AIR', 'Demo JFK Cargo Terminal', 'Demo Brussels Transfer Hub', order_01_air_start,
      order_01_air_end, 'S3 Demo Air', 'S3DEMO-20261104-AIR-MVR-01-FLIGHT-001', 2,
      'Synthetic two-horse air stalls', 'READY', 'Synthetic non-final AIR leg 01', now());
  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d7500000-0000-0000-0000-000000000002', 'd7400000-0000-0000-0000-000000000001',
      2, 'ROAD', 'Demo Brussels Transfer Hub', 'Demo Amsterdam Stable', order_01_road_start,
      order_01_road_end, null, null, null, null, 'PLANNED', 'Synthetic final ROAD leg 01', now());
  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d7600000-0000-0000-0000-000000000001', 'd7500000-0000-0000-0000-000000000002',
      'd7300000-0000-0000-0000-000000000001', now());
  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d7600000-0000-0000-0000-000000000002', 'd7500000-0000-0000-0000-000000000002',
      'd7300000-0000-0000-0000-000000000002', now());
  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id, transport_order_horse_id, assigned_at)
  VALUES ('d7700000-0000-0000-0000-000000000001', 'd7500000-0000-0000-0000-000000000002',
      'd7600000-0000-0000-0000-000000000001', 'd7200000-0000-0000-0000-000000000001', now());
  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id, transport_order_horse_id, assigned_at)
  VALUES ('d7700000-0000-0000-0000-000000000002', 'd7500000-0000-0000-0000-000000000002',
      'd7600000-0000-0000-0000-000000000002', 'd7200000-0000-0000-0000-000000000002', now());
  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id, status, assigned_at)
  VALUES ('d7800000-0000-0000-0000-000000000001', 'd7600000-0000-0000-0000-000000000001',
      driver1, escort1, 'NOT_STARTED', now());
  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id, status, assigned_at)
  VALUES ('d7800000-0000-0000-0000-000000000002', 'd7600000-0000-0000-0000-000000000002',
      driver2, escort2, 'NOT_STARTED', now());
  INSERT INTO air_leg_executions(id, route_leg_id, escort_id, status, assigned_at)
  VALUES ('d7900000-0000-0000-0000-000000000001', 'd7500000-0000-0000-0000-000000000001',
      escort1, 'NOT_STARTED', now());
  INSERT INTO checkpoints(id, route_leg_id, sequence_no, name, checkpoint_type, country_code,
      minimum_required_stop_minutes, planned_stop_duration_minutes, notes, created_at)
  VALUES ('d7a00000-0000-0000-0000-000000000001', 'd7500000-0000-0000-0000-000000000002',
      1, 'S3 Demo Rest Stop 01', 'REST_STOP', 'BE', 15, 20,
      'Shared checkpoint; each Vehicle records its own arrival and welfare', now());

  -- Order 02: exactly 18 records.
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d7000000-0000-0000-0000-000000000003', customer, 'S3 Demo Nova',
      'S3DEMO-20261104-AIR-MVR-02-PASS-001', 'S3DEMO-20261104-AIR-MVR-02-MICRO-001',
      'Arabian', 'MARE', date '2019-02-18', 'Synthetic demo horse 02-A', now());
  INSERT INTO horses(id, customer_id, name, passport_number, microchip_id, breed, sex,
      date_of_birth, notes, created_at)
  VALUES ('d7000000-0000-0000-0000-000000000004', customer, 'S3 Demo Orion',
      'S3DEMO-20261104-AIR-MVR-02-PASS-002', 'S3DEMO-20261104-AIR-MVR-02-MICRO-002',
      'Hanoverian', 'GELDING', date '2016-11-09', 'Synthetic demo horse 02-B', now());
  INSERT INTO transport_orders(id, order_code, customer_id, origin_address, origin_country,
      destination_address, destination_country, requested_departure_at, transport_mode,
      special_requirements, recipient_name, recipient_phone, recipient_email, status,
      approved_at, ready_to_ship_at, created_at)
  VALUES ('d7100000-0000-0000-0000-000000000002', 'S3DEMO-20261104-AIR-MVR-02', customer,
      'Demo Dubai Cargo Terminal', 'AE', 'Demo Paris Stable', 'FR', order_02_air_start,
      'COMBINED', 'Synthetic AIR-to-multi-vehicle-ROAD demo fixture 02', 'Demo Receiver 02',
      '+10000000702', 'customer.s3demo@example.com', 'READY_TO_SHIP', now(), now(), now());
  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d7200000-0000-0000-0000-000000000003', 'd7100000-0000-0000-0000-000000000002',
      'd7000000-0000-0000-0000-000000000003', 'ELIGIBLE_FOR_EXPORT', now());
  INSERT INTO transport_order_horses(id, transport_order_id, horse_id, document_status, created_at)
  VALUES ('d7200000-0000-0000-0000-000000000004', 'd7100000-0000-0000-0000-000000000002',
      'd7000000-0000-0000-0000-000000000004', 'ELIGIBLE_FOR_EXPORT', now());
  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status, notes, created_at)
  VALUES ('d7300000-0000-0000-0000-000000000003', 'S3DEMO-20261104-MVR-02-A',
      'S3 Demo Road Van 02-A', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic demo Vehicle 02-A', now());
  INSERT INTO vehicles(id, plate_number, vehicle_name, vehicle_type, horse_capacity, status, notes, created_at)
  VALUES ('d7300000-0000-0000-0000-000000000004', 'S3DEMO-20261104-MVR-02-B',
      'S3 Demo Road Van 02-B', 'HORSE_VAN', 1, 'AVAILABLE', 'Synthetic demo Vehicle 02-B', now());
  INSERT INTO route_plans(id, transport_order_id, status, created_by, created_at, locked_at, approved_at)
  VALUES ('d7400000-0000-0000-0000-000000000002', 'd7100000-0000-0000-0000-000000000002',
      'APPROVED', frc, now(), now(), now());
  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d7500000-0000-0000-0000-000000000003', 'd7400000-0000-0000-0000-000000000002',
      1, 'AIR', 'Demo Dubai Cargo Terminal', 'Demo Frankfurt Transfer Hub', order_02_air_start,
      order_02_air_end, 'S3 Demo Air', 'S3DEMO-20261104-AIR-MVR-02-FLIGHT-001', 2,
      'Synthetic two-horse air stalls', 'READY', 'Synthetic non-final AIR leg 02', now());
  INSERT INTO route_legs(id, route_plan_id, sequence_no, leg_type, origin, destination,
      planned_departure_at, planned_arrival_at, air_provider_name, air_reference,
      air_capacity_horses, equipment_details, status, notes, created_at)
  VALUES ('d7500000-0000-0000-0000-000000000004', 'd7400000-0000-0000-0000-000000000002',
      2, 'ROAD', 'Demo Frankfurt Transfer Hub', 'Demo Paris Stable', order_02_road_start,
      order_02_road_end, null, null, null, null, 'PLANNED', 'Synthetic final ROAD leg 02', now());
  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d7600000-0000-0000-0000-000000000003', 'd7500000-0000-0000-0000-000000000004',
      'd7300000-0000-0000-0000-000000000003', now());
  INSERT INTO road_leg_vehicles(id, route_leg_id, vehicle_id, assigned_at)
  VALUES ('d7600000-0000-0000-0000-000000000004', 'd7500000-0000-0000-0000-000000000004',
      'd7300000-0000-0000-0000-000000000004', now());
  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id, transport_order_horse_id, assigned_at)
  VALUES ('d7700000-0000-0000-0000-000000000003', 'd7500000-0000-0000-0000-000000000004',
      'd7600000-0000-0000-0000-000000000003', 'd7200000-0000-0000-0000-000000000003', now());
  INSERT INTO road_leg_vehicle_horses(id, route_leg_id, road_leg_vehicle_id, transport_order_horse_id, assigned_at)
  VALUES ('d7700000-0000-0000-0000-000000000004', 'd7500000-0000-0000-0000-000000000004',
      'd7600000-0000-0000-0000-000000000004', 'd7200000-0000-0000-0000-000000000004', now());
  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id, status, assigned_at)
  VALUES ('d7800000-0000-0000-0000-000000000003', 'd7600000-0000-0000-0000-000000000003',
      driver1, escort1, 'NOT_STARTED', now());
  INSERT INTO road_vehicle_executions(id, road_leg_vehicle_id, driver_id, escort_id, status, assigned_at)
  VALUES ('d7800000-0000-0000-0000-000000000004', 'd7600000-0000-0000-0000-000000000004',
      driver2, escort2, 'NOT_STARTED', now());
  INSERT INTO air_leg_executions(id, route_leg_id, escort_id, status, assigned_at)
  VALUES ('d7900000-0000-0000-0000-000000000002', 'd7500000-0000-0000-0000-000000000003',
      escort1, 'NOT_STARTED', now());
  INSERT INTO checkpoints(id, route_leg_id, sequence_no, name, checkpoint_type, country_code,
      minimum_required_stop_minutes, planned_stop_duration_minutes, notes, created_at)
  VALUES ('d7a00000-0000-0000-0000-000000000002', 'd7500000-0000-0000-0000-000000000004',
      1, 'S3 Demo Rest Stop 02', 'REST_STOP', 'DE', 15, 20,
      'Shared checkpoint; each Vehicle records its own arrival and welfare', now());

  IF (SELECT count(*) FROM horses WHERE id IN ('d7000000-0000-0000-0000-000000000001',
      'd7000000-0000-0000-0000-000000000002')) <> 2
      OR (SELECT count(*) FROM route_legs WHERE route_plan_id = 'd7400000-0000-0000-0000-000000000001') <> 2
      OR (SELECT count(*) FROM road_leg_vehicle_horses WHERE route_leg_id = 'd7500000-0000-0000-0000-000000000002') <> 2
      OR (SELECT count(*) FROM road_vehicle_executions WHERE road_leg_vehicle_id IN (
          'd7600000-0000-0000-0000-000000000001', 'd7600000-0000-0000-0000-000000000002')) <> 2
      OR (SELECT count(*) FROM air_leg_executions WHERE id = 'd7900000-0000-0000-0000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'S3DEMO-20261104-AIR-MVR-01 graph validation failed';
  END IF;
  IF (SELECT count(*) FROM horses WHERE id IN ('d7000000-0000-0000-0000-000000000003',
      'd7000000-0000-0000-0000-000000000004')) <> 2
      OR (SELECT count(*) FROM route_legs WHERE route_plan_id = 'd7400000-0000-0000-0000-000000000002') <> 2
      OR (SELECT count(*) FROM road_leg_vehicle_horses WHERE route_leg_id = 'd7500000-0000-0000-0000-000000000004') <> 2
      OR (SELECT count(*) FROM road_vehicle_executions WHERE road_leg_vehicle_id IN (
          'd7600000-0000-0000-0000-000000000003', 'd7600000-0000-0000-0000-000000000004')) <> 2
      OR (SELECT count(*) FROM air_leg_executions WHERE id = 'd7900000-0000-0000-0000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'S3DEMO-20261104-AIR-MVR-02 graph validation failed';
  END IF;
END
$fixture$;

COMMIT;
