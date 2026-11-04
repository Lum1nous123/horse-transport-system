\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE s3_demo_order_ids ON COMMIT DROP AS
SELECT id FROM transport_orders
WHERE order_code IN ('S3DEMO-ROAD-MULTI', 'S3DEMO-AIR-NONFINAL', 'S3DEMO-AIR-FINAL');

CREATE TEMP TABLE s3_demo_route_plan_ids ON COMMIT DROP AS
SELECT id FROM route_plans WHERE transport_order_id IN (SELECT id FROM s3_demo_order_ids);
CREATE TEMP TABLE s3_demo_route_leg_ids ON COMMIT DROP AS
SELECT id FROM route_legs WHERE route_plan_id IN (SELECT id FROM s3_demo_route_plan_ids);
CREATE TEMP TABLE s3_demo_road_vehicle_ids ON COMMIT DROP AS
SELECT id, vehicle_id FROM road_leg_vehicles WHERE route_leg_id IN (SELECT id FROM s3_demo_route_leg_ids);
CREATE TEMP TABLE s3_demo_road_execution_ids ON COMMIT DROP AS
SELECT id FROM road_vehicle_executions WHERE road_leg_vehicle_id IN (SELECT id FROM s3_demo_road_vehicle_ids);
CREATE TEMP TABLE s3_demo_air_execution_ids ON COMMIT DROP AS
SELECT id FROM air_leg_executions WHERE route_leg_id IN (SELECT id FROM s3_demo_route_leg_ids);
CREATE TEMP TABLE s3_demo_order_horse_ids ON COMMIT DROP AS
SELECT id, horse_id FROM transport_order_horses WHERE transport_order_id IN (SELECT id FROM s3_demo_order_ids);

DELETE FROM notifications WHERE transport_order_id IN (SELECT id FROM s3_demo_order_ids);
DELETE FROM proofs_of_delivery
WHERE road_vehicle_execution_id IN (SELECT id FROM s3_demo_road_execution_ids)
   OR air_leg_execution_id IN (SELECT id FROM s3_demo_air_execution_ids);
DELETE FROM welfare_evidence
WHERE road_vehicle_execution_id IN (SELECT id FROM s3_demo_road_execution_ids)
   OR air_leg_execution_id IN (SELECT id FROM s3_demo_air_execution_ids);
DELETE FROM vehicle_checkpoint_arrivals WHERE road_vehicle_execution_id IN (SELECT id FROM s3_demo_road_execution_ids);
DELETE FROM checkpoints WHERE route_leg_id IN (SELECT id FROM s3_demo_route_leg_ids);
DELETE FROM road_vehicle_executions WHERE id IN (SELECT id FROM s3_demo_road_execution_ids);
DELETE FROM air_leg_executions WHERE id IN (SELECT id FROM s3_demo_air_execution_ids);
DELETE FROM road_leg_vehicle_horses WHERE road_leg_vehicle_id IN (SELECT id FROM s3_demo_road_vehicle_ids);
DELETE FROM road_leg_vehicles WHERE id IN (SELECT id FROM s3_demo_road_vehicle_ids);
DELETE FROM route_plan_reviews WHERE route_plan_id IN (SELECT id FROM s3_demo_route_plan_ids);
DELETE FROM route_legs WHERE id IN (SELECT id FROM s3_demo_route_leg_ids);
DELETE FROM route_plans WHERE id IN (SELECT id FROM s3_demo_route_plan_ids);
DELETE FROM order_staff_assignments WHERE transport_order_id IN (SELECT id FROM s3_demo_order_ids);
DELETE FROM transport_order_horses WHERE id IN (SELECT id FROM s3_demo_order_horse_ids);
DELETE FROM transport_orders WHERE id IN (SELECT id FROM s3_demo_order_ids);
DELETE FROM horses WHERE id IN (SELECT horse_id FROM s3_demo_order_horse_ids);
DELETE FROM vehicles WHERE id IN (SELECT vehicle_id FROM s3_demo_road_vehicle_ids);

COMMIT;
