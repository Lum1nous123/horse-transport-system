\set ON_ERROR_STOP on
BEGIN;

DO $seed$
DECLARE
  customer uuid; frc uuid; driver1 uuid; driver2 uuid; escort1 uuid; escort2 uuid;
BEGIN
  SELECT id INTO STRICT customer FROM users WHERE email='customer.s3demo@example.com';
  SELECT id INTO STRICT frc FROM users WHERE email='frc.s3demo@example.com';
  SELECT id INTO STRICT driver1 FROM users WHERE email='driver1.s3demo@example.com';
  SELECT id INTO STRICT driver2 FROM users WHERE email='driver2.s3demo@example.com';
  SELECT id INTO STRICT escort1 FROM users WHERE email='escort1.s3demo@example.com';
  SELECT id INTO STRICT escort2 FROM users WHERE email='escort2.s3demo@example.com';

  IF EXISTS (SELECT 1 FROM transport_orders WHERE order_code LIKE 'S3DEMO-%')
      OR EXISTS (SELECT 1 FROM horses WHERE microchip_id LIKE 'S3DEMO-%')
      OR EXISTS (SELECT 1 FROM vehicles WHERE plate_number LIKE 'S3DEMO-%') THEN
    IF (SELECT count(*) FROM transport_orders
        WHERE (id, order_code) IN (
          ('d3100000-0000-0000-0000-000000000001', 'S3DEMO-ROAD-MULTI'),
          ('d3100000-0000-0000-0000-000000000002', 'S3DEMO-AIR-NONFINAL'),
          ('d3100000-0000-0000-0000-000000000003', 'S3DEMO-AIR-FINAL'))
          AND customer_id=customer AND status IN ('READY_TO_SHIP','IN_PROGRESS','DELIVERED')) <> 3
      OR (SELECT count(*) FROM horses
          WHERE id IN ('d3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000002',
                       'd3000000-0000-0000-0000-000000000003', 'd3000000-0000-0000-0000-000000000004')
            AND customer_id=customer AND microchip_id LIKE 'S3DEMO-MICRO-%') <> 4
      OR (SELECT count(*) FROM transport_order_horses
          WHERE id IN ('d3200000-0000-0000-0000-000000000001', 'd3200000-0000-0000-0000-000000000002',
                       'd3200000-0000-0000-0000-000000000003', 'd3200000-0000-0000-0000-000000000004')) <> 4
      OR (SELECT count(*) FROM vehicles
          WHERE id IN ('d3300000-0000-0000-0000-000000000001', 'd3300000-0000-0000-0000-000000000002',
                       'd3300000-0000-0000-0000-000000000003') AND plate_number LIKE 'S3DEMO-%') <> 3
      OR (SELECT count(*) FROM route_plans
          WHERE id IN ('d3400000-0000-0000-0000-000000000001', 'd3400000-0000-0000-0000-000000000002',
                       'd3400000-0000-0000-0000-000000000003') AND status='APPROVED' AND created_by=frc) <> 3
      OR (SELECT count(*) FROM route_legs
          WHERE id IN ('d3500000-0000-0000-0000-000000000001', 'd3500000-0000-0000-0000-000000000002',
                       'd3500000-0000-0000-0000-000000000003', 'd3500000-0000-0000-0000-000000000004')) <> 4
      OR NOT EXISTS (SELECT 1 FROM route_legs WHERE id='d3500000-0000-0000-0000-000000000001'
          AND route_plan_id='d3400000-0000-0000-0000-000000000001' AND sequence_no=1 AND leg_type='ROAD'
          AND status IN ('READY','IN_PROGRESS','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM route_legs WHERE id='d3500000-0000-0000-0000-000000000002'
          AND route_plan_id='d3400000-0000-0000-0000-000000000002' AND sequence_no=1 AND leg_type='AIR'
          AND status IN ('READY','IN_PROGRESS','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM route_legs WHERE id='d3500000-0000-0000-0000-000000000003'
          AND route_plan_id='d3400000-0000-0000-0000-000000000002' AND sequence_no=2 AND leg_type='ROAD'
          AND status IN ('PLANNED','READY','IN_PROGRESS','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM route_legs WHERE id='d3500000-0000-0000-0000-000000000004'
          AND route_plan_id='d3400000-0000-0000-0000-000000000003' AND sequence_no=1 AND leg_type='AIR'
          AND status IN ('READY','IN_PROGRESS','COMPLETED'))
      OR (SELECT count(*) FROM road_leg_vehicles
          WHERE id IN ('d3600000-0000-0000-0000-000000000001', 'd3600000-0000-0000-0000-000000000002',
                       'd3600000-0000-0000-0000-000000000003')) <> 3
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicles WHERE id='d3600000-0000-0000-0000-000000000001'
          AND route_leg_id='d3500000-0000-0000-0000-000000000001' AND vehicle_id='d3300000-0000-0000-0000-000000000001')
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicles WHERE id='d3600000-0000-0000-0000-000000000002'
          AND route_leg_id='d3500000-0000-0000-0000-000000000001' AND vehicle_id='d3300000-0000-0000-0000-000000000002')
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicles WHERE id='d3600000-0000-0000-0000-000000000003'
          AND route_leg_id='d3500000-0000-0000-0000-000000000003' AND vehicle_id='d3300000-0000-0000-0000-000000000003')
      OR (SELECT count(*) FROM road_leg_vehicle_horses
          WHERE id IN ('d3700000-0000-0000-0000-000000000001', 'd3700000-0000-0000-0000-000000000002',
                       'd3700000-0000-0000-0000-000000000003')) <> 3
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicle_horses WHERE id='d3700000-0000-0000-0000-000000000001'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000001' AND transport_order_horse_id='d3200000-0000-0000-0000-000000000001')
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicle_horses WHERE id='d3700000-0000-0000-0000-000000000002'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000002' AND transport_order_horse_id='d3200000-0000-0000-0000-000000000002')
      OR NOT EXISTS (SELECT 1 FROM road_leg_vehicle_horses WHERE id='d3700000-0000-0000-0000-000000000003'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000003' AND transport_order_horse_id='d3200000-0000-0000-0000-000000000003')
      OR NOT EXISTS (SELECT 1 FROM road_vehicle_executions WHERE id='d3800000-0000-0000-0000-000000000001'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000001' AND driver_id=driver1 AND escort_id=escort1
          AND status IN ('NOT_STARTED','IN_PROGRESS','DESTINATION','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM road_vehicle_executions WHERE id='d3800000-0000-0000-0000-000000000002'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000002' AND driver_id=driver2 AND escort_id=escort2
          AND status IN ('NOT_STARTED','IN_PROGRESS','DESTINATION','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM road_vehicle_executions WHERE id='d3800000-0000-0000-0000-000000000003'
          AND road_leg_vehicle_id='d3600000-0000-0000-0000-000000000003' AND driver_id=driver1 AND escort_id=escort1
          AND status IN ('NOT_STARTED','IN_PROGRESS','DESTINATION','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM air_leg_executions WHERE id='d3900000-0000-0000-0000-000000000001'
          AND route_leg_id='d3500000-0000-0000-0000-000000000002' AND escort_id=escort1
          AND status IN ('NOT_STARTED','IN_PROGRESS','DESTINATION','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM air_leg_executions WHERE id='d3900000-0000-0000-0000-000000000002'
          AND route_leg_id='d3500000-0000-0000-0000-000000000004' AND escort_id=escort2
          AND status IN ('NOT_STARTED','IN_PROGRESS','DESTINATION','COMPLETED'))
      OR NOT EXISTS (SELECT 1 FROM checkpoints WHERE id='d3a00000-0000-0000-0000-000000000001'
          AND route_leg_id='d3500000-0000-0000-0000-000000000001' AND sequence_no=1) THEN
      RAISE EXCEPTION 'Sprint 3 demo namespace is partial or inconsistent; review it and run only the scoped cleanup after explicit approval';
    END IF;
    RAISE NOTICE 'Complete Sprint 3 fixtures already exist; no changes made';
    RETURN;
  END IF;

  INSERT INTO horses(id,customer_id,name,passport_number,microchip_id,breed,sex,date_of_birth,notes,created_at)
  VALUES
   ('d3000000-0000-0000-0000-000000000001',customer,'S3 Road Star','S3-PASS-ROAD-1','S3DEMO-MICRO-ROAD-1','Thoroughbred','MARE','2018-04-12','Synthetic Sprint 3 demo horse',now()),
   ('d3000000-0000-0000-0000-000000000002',customer,'S3 Road Moon','S3-PASS-ROAD-2','S3DEMO-MICRO-ROAD-2','Warmblood','GELDING','2017-08-03','Synthetic Sprint 3 demo horse',now()),
   ('d3000000-0000-0000-0000-000000000003',customer,'S3 Air Cloud','S3-PASS-AIR-1','S3DEMO-MICRO-AIR-1','Arabian','MARE','2019-02-18','Synthetic Sprint 3 demo horse',now()),
   ('d3000000-0000-0000-0000-000000000004',customer,'S3 Air Final','S3-PASS-AIR-2','S3DEMO-MICRO-AIR-2','Hanoverian','GELDING','2016-11-21','Synthetic Sprint 3 demo horse',now());

  INSERT INTO transport_orders(id,order_code,customer_id,origin_address,origin_country,destination_address,destination_country,requested_departure_at,transport_mode,special_requirements,recipient_name,recipient_phone,recipient_email,status,approved_at,ready_to_ship_at,created_at)
  VALUES
   ('d3100000-0000-0000-0000-000000000001','S3DEMO-ROAD-MULTI',customer,'Lexington Demo Farm','US','JFK Demo Stable','US',now()+interval '1 day','ROAD','Synthetic demo only','Road Demo Receiver','+10000000001','customer.s3demo@example.com','READY_TO_SHIP',now(),now(),now()),
   ('d3100000-0000-0000-0000-000000000002','S3DEMO-AIR-NONFINAL',customer,'JFK Demo Cargo','US','Brussels Demo Cargo','BE',now()+interval '2 days','COMBINED','Synthetic demo only','Air Demo Receiver','+10000000002','customer.s3demo@example.com','READY_TO_SHIP',now(),now(),now()),
   ('d3100000-0000-0000-0000-000000000003','S3DEMO-AIR-FINAL',customer,'Brussels Demo Cargo','BE','Amsterdam Demo Stable','NL',now()+interval '3 days','AIR','Synthetic demo only','Final Air Receiver','+10000000003','customer.s3demo@example.com','READY_TO_SHIP',now(),now(),now());

  INSERT INTO transport_order_horses(id,transport_order_id,horse_id,document_status,created_at) VALUES
   ('d3200000-0000-0000-0000-000000000001','d3100000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000001','ELIGIBLE_FOR_EXPORT',now()),
   ('d3200000-0000-0000-0000-000000000002','d3100000-0000-0000-0000-000000000001','d3000000-0000-0000-0000-000000000002','ELIGIBLE_FOR_EXPORT',now()),
   ('d3200000-0000-0000-0000-000000000003','d3100000-0000-0000-0000-000000000002','d3000000-0000-0000-0000-000000000003','ELIGIBLE_FOR_EXPORT',now()),
   ('d3200000-0000-0000-0000-000000000004','d3100000-0000-0000-0000-000000000003','d3000000-0000-0000-0000-000000000004','ELIGIBLE_FOR_EXPORT',now());

  INSERT INTO vehicles(id,plate_number,vehicle_name,vehicle_type,horse_capacity,status,notes,created_at) VALUES
   ('d3300000-0000-0000-0000-000000000001','S3DEMO-ROAD-01','S3 Demo Horse Van 1','HORSE_VAN',2,'ASSIGNED','Synthetic Sprint 3 fixture',now()),
   ('d3300000-0000-0000-0000-000000000002','S3DEMO-ROAD-02','S3 Demo Horse Van 2','HORSE_VAN',2,'ASSIGNED','Synthetic Sprint 3 fixture',now()),
   ('d3300000-0000-0000-0000-000000000003','S3DEMO-NEXT-01','S3 Demo Follow-on Van','HORSE_VAN',2,'ASSIGNED','Synthetic Sprint 3 fixture',now());

  INSERT INTO route_plans(id,transport_order_id,status,created_by,created_at,locked_at,approved_at) VALUES
   ('d3400000-0000-0000-0000-000000000001','d3100000-0000-0000-0000-000000000001','APPROVED',frc,now(),now(),now()),
   ('d3400000-0000-0000-0000-000000000002','d3100000-0000-0000-0000-000000000002','APPROVED',frc,now(),now(),now()),
   ('d3400000-0000-0000-0000-000000000003','d3100000-0000-0000-0000-000000000003','APPROVED',frc,now(),now(),now());

  INSERT INTO route_legs(id,route_plan_id,sequence_no,leg_type,origin,destination,planned_departure_at,planned_arrival_at,air_provider_name,air_reference,air_capacity_horses,equipment_details,status,notes,created_at) VALUES
   ('d3500000-0000-0000-0000-000000000001','d3400000-0000-0000-0000-000000000001',1,'ROAD','Lexington Demo Farm','JFK Demo Stable',now()+interval '1 day',now()+interval '1 day 8 hours',null,null,null,null,'READY','Multi-vehicle ROAD final leg',now()),
   ('d3500000-0000-0000-0000-000000000002','d3400000-0000-0000-0000-000000000002',1,'AIR','JFK Demo Cargo','Brussels Demo Cargo',now()+interval '2 days',now()+interval '2 days 8 hours','S3 Demo Air','S3-AIR-NONFINAL',2,'Synthetic air stall','READY','Non-final AIR leg',now()),
   ('d3500000-0000-0000-0000-000000000003','d3400000-0000-0000-0000-000000000002',2,'ROAD','Brussels Demo Cargo','Brussels Demo Stable',now()+interval '3 days',now()+interval '3 days 2 hours',null,null,null,null,'PLANNED','Unlock target after AIR completion',now()),
   ('d3500000-0000-0000-0000-000000000004','d3400000-0000-0000-0000-000000000003',1,'AIR','Brussels Demo Cargo','Amsterdam Demo Stable',now()+interval '3 days',now()+interval '3 days 4 hours','S3 Demo Air','S3-AIR-FINAL',2,'Synthetic air stall','READY','Final AIR PoD leg',now());

  INSERT INTO road_leg_vehicles(id,route_leg_id,vehicle_id,assigned_at) VALUES
   ('d3600000-0000-0000-0000-000000000001','d3500000-0000-0000-0000-000000000001','d3300000-0000-0000-0000-000000000001',now()),
   ('d3600000-0000-0000-0000-000000000002','d3500000-0000-0000-0000-000000000001','d3300000-0000-0000-0000-000000000002',now()),
   ('d3600000-0000-0000-0000-000000000003','d3500000-0000-0000-0000-000000000003','d3300000-0000-0000-0000-000000000003',now());

  INSERT INTO road_leg_vehicle_horses(id,route_leg_id,road_leg_vehicle_id,transport_order_horse_id,assigned_at) VALUES
   ('d3700000-0000-0000-0000-000000000001','d3500000-0000-0000-0000-000000000001','d3600000-0000-0000-0000-000000000001','d3200000-0000-0000-0000-000000000001',now()),
   ('d3700000-0000-0000-0000-000000000002','d3500000-0000-0000-0000-000000000001','d3600000-0000-0000-0000-000000000002','d3200000-0000-0000-0000-000000000002',now()),
   ('d3700000-0000-0000-0000-000000000003','d3500000-0000-0000-0000-000000000003','d3600000-0000-0000-0000-000000000003','d3200000-0000-0000-0000-000000000003',now());

  INSERT INTO road_vehicle_executions(id,road_leg_vehicle_id,driver_id,escort_id,status,assigned_at) VALUES
   ('d3800000-0000-0000-0000-000000000001','d3600000-0000-0000-0000-000000000001',driver1,escort1,'NOT_STARTED',now()),
   ('d3800000-0000-0000-0000-000000000002','d3600000-0000-0000-0000-000000000002',driver2,escort2,'NOT_STARTED',now()),
   ('d3800000-0000-0000-0000-000000000003','d3600000-0000-0000-0000-000000000003',driver1,escort1,'NOT_STARTED',now());

  INSERT INTO air_leg_executions(id,route_leg_id,escort_id,status,assigned_at) VALUES
   ('d3900000-0000-0000-0000-000000000001','d3500000-0000-0000-0000-000000000002',escort1,'NOT_STARTED',now()),
   ('d3900000-0000-0000-0000-000000000002','d3500000-0000-0000-0000-000000000004',escort2,'NOT_STARTED',now());

  INSERT INTO checkpoints(id,route_leg_id,sequence_no,name,checkpoint_type,country_code,minimum_required_stop_minutes,planned_stop_duration_minutes,notes,created_at) VALUES
   ('d3a00000-0000-0000-0000-000000000001','d3500000-0000-0000-0000-000000000001',1,'S3 Demo Rest Farm','REST_STOP','US',15,20,'Synthetic welfare checkpoint',now());
END
$seed$;

COMMIT;
