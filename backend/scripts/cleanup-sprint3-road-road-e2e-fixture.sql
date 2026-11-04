\set ON_ERROR_STOP on

\ir sprint3-road-road-target-preflight.sql

\if :{?cleanup_confirmation}
\else
  \echo 'cleanup_confirmation is required'
  \quit 3
\endif
SELECT :'cleanup_confirmation' = 'CLEANUP-S3QA-R2R-001@horse-transport-system/PRODUCTION'
  AS cleanup_confirmed \gset
\if :cleanup_confirmed
\else
  \echo 'cleanup_confirmation does not authorize S3QA-R2R-001 cleanup on horse-transport-system/PRODUCTION'
  \quit 3
\endif

BEGIN;

CREATE TEMP TABLE s3qa_r2r_order ON COMMIT DROP AS
SELECT id, customer_id FROM transport_orders
WHERE id = 'd4100000-0000-0000-0000-000000000001'
  AND order_code = 'S3QA-R2R-001'
  AND special_requirements = 'Synthetic ROAD-to-ROAD E2E fixture only';

CREATE TEMP TABLE s3qa_r2r_plan ON COMMIT DROP AS
SELECT id FROM route_plans
WHERE id = 'd4400000-0000-0000-0000-000000000001'
  AND transport_order_id IN (SELECT id FROM s3qa_r2r_order);

CREATE TEMP TABLE s3qa_r2r_legs ON COMMIT DROP AS
SELECT id, sequence_no FROM route_legs
WHERE route_plan_id IN (SELECT id FROM s3qa_r2r_plan)
  AND id IN ('d4500000-0000-0000-0000-000000000001',
             'd4500000-0000-0000-0000-000000000002');

CREATE TEMP TABLE s3qa_r2r_road_vehicles ON COMMIT DROP AS
SELECT id, route_leg_id, vehicle_id FROM road_leg_vehicles
WHERE id IN ('d4600000-0000-0000-0000-000000000001',
             'd4600000-0000-0000-0000-000000000002')
  AND route_leg_id IN (SELECT id FROM s3qa_r2r_legs);

CREATE TEMP TABLE s3qa_r2r_executions ON COMMIT DROP AS
SELECT id, road_leg_vehicle_id FROM road_vehicle_executions
WHERE id IN ('d4800000-0000-0000-0000-000000000001',
             'd4800000-0000-0000-0000-000000000002')
  AND road_leg_vehicle_id IN (SELECT id FROM s3qa_r2r_road_vehicles);

CREATE TEMP TABLE s3qa_r2r_order_horse ON COMMIT DROP AS
SELECT id, horse_id FROM transport_order_horses
WHERE id = 'd4200000-0000-0000-0000-000000000001'
  AND transport_order_id IN (SELECT id FROM s3qa_r2r_order)
  AND horse_id = 'd4000000-0000-0000-0000-000000000001';

DO $validate_cleanup$
BEGIN
  IF (SELECT count(*) FROM s3qa_r2r_order) <> 1
      OR NOT EXISTS (SELECT 1 FROM s3qa_r2r_order fixture
        JOIN users customer ON customer.id = fixture.customer_id
        WHERE customer.email = 'customer.s3demo@example.com'
          AND customer.role = 'CUSTOMER') THEN
    RAISE EXCEPTION 'Exact synthetic Order ownership could not be verified';
  END IF;
  IF (SELECT count(*) FROM s3qa_r2r_plan) <> 1
      OR (SELECT count(*) FROM route_plans
          WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order)) <> 1 THEN
    RAISE EXCEPTION 'Exact synthetic Route Plan ownership could not be verified';
  END IF;
  IF (SELECT count(*) FROM s3qa_r2r_legs) <> 2
      OR NOT EXISTS (SELECT 1 FROM s3qa_r2r_legs
          WHERE id = 'd4500000-0000-0000-0000-000000000001' AND sequence_no = 1)
      OR NOT EXISTS (SELECT 1 FROM s3qa_r2r_legs
          WHERE id = 'd4500000-0000-0000-0000-000000000002' AND sequence_no = 2)
      OR (SELECT count(*) FROM route_legs
          WHERE route_plan_id IN (SELECT id FROM s3qa_r2r_plan)) <> 2 THEN
    RAISE EXCEPTION 'Exact two-leg synthetic route could not be verified';
  END IF;
  IF (SELECT count(*) FROM s3qa_r2r_road_vehicles) <> 2
      OR (SELECT count(*) FROM road_leg_vehicles
          WHERE route_leg_id IN (SELECT id FROM s3qa_r2r_legs)) <> 2 THEN
    RAISE EXCEPTION 'Exact synthetic Vehicle allocations could not be verified';
  END IF;
  IF (SELECT count(*) FROM s3qa_r2r_executions) <> 2
      OR (SELECT count(*) FROM road_vehicle_executions
          WHERE road_leg_vehicle_id IN (SELECT id FROM s3qa_r2r_road_vehicles)) <> 2
      OR EXISTS (SELECT 1 FROM air_leg_executions
          WHERE route_leg_id IN (SELECT id FROM s3qa_r2r_legs)) THEN
    RAISE EXCEPTION 'Exact ROAD execution graph could not be verified';
  END IF;
  IF NOT EXISTS (
      SELECT 1 FROM road_vehicle_executions execution
      JOIN users driver ON driver.id = execution.driver_id
      JOIN users escort ON escort.id = execution.escort_id
      WHERE execution.id = 'd4800000-0000-0000-0000-000000000001'
        AND driver.email = 'driver1.s3demo@example.com'
        AND escort.email = 'escort1.s3demo@example.com')
    OR NOT EXISTS (
      SELECT 1 FROM road_vehicle_executions execution
      JOIN users driver ON driver.id = execution.driver_id
      JOIN users escort ON escort.id = execution.escort_id
      WHERE execution.id = 'd4800000-0000-0000-0000-000000000002'
        AND driver.email = 'driver2.s3demo@example.com'
        AND escort.email = 'escort2.s3demo@example.com') THEN
    RAISE EXCEPTION 'Synthetic execution staff ownership could not be verified';
  END IF;
  IF (SELECT count(*) FROM s3qa_r2r_order_horse) <> 1
      OR (SELECT count(*) FROM transport_order_horses
          WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order)) <> 1 THEN
    RAISE EXCEPTION 'Exact synthetic Horse ownership could not be verified';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM horses
      WHERE id = 'd4000000-0000-0000-0000-000000000001'
        AND microchip_id = 'S3QA-R2R-MICRO-001')
      OR NOT EXISTS (SELECT 1 FROM vehicles
      WHERE id = 'd4300000-0000-0000-0000-000000000001' AND plate_number = 'S3QA-R2R-01')
      OR NOT EXISTS (SELECT 1 FROM vehicles
      WHERE id = 'd4300000-0000-0000-0000-000000000002' AND plate_number = 'S3QA-R2R-02') THEN
    RAISE EXCEPTION 'Synthetic Horse or Vehicle identity could not be verified';
  END IF;
  IF EXISTS (SELECT 1 FROM transport_order_horses
      WHERE horse_id = 'd4000000-0000-0000-0000-000000000001'
        AND id <> 'd4200000-0000-0000-0000-000000000001')
      OR EXISTS (SELECT 1 FROM road_leg_vehicles
      WHERE vehicle_id IN ('d4300000-0000-0000-0000-000000000001',
                           'd4300000-0000-0000-0000-000000000002')
        AND id NOT IN ('d4600000-0000-0000-0000-000000000001',
                       'd4600000-0000-0000-0000-000000000002')) THEN
    RAISE EXCEPTION 'Synthetic Horse or Vehicle is referenced outside the exact fixture graph';
  END IF;
  IF (SELECT count(*) FROM checkpoints
      WHERE route_leg_id IN (SELECT id FROM s3qa_r2r_legs)) <> 1
      OR NOT EXISTS (SELECT 1 FROM checkpoints
      WHERE id = 'd4a00000-0000-0000-0000-000000000001'
        AND route_leg_id = 'd4500000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Exact synthetic checkpoint graph could not be verified';
  END IF;
  IF EXISTS (SELECT 1 FROM vehicle_checkpoint_arrivals
      WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions)
        AND (road_vehicle_execution_id <> 'd4800000-0000-0000-0000-000000000001'
          OR checkpoint_id <> 'd4a00000-0000-0000-0000-000000000001')) THEN
    RAISE EXCEPTION 'Unexpected checkpoint arrival exists in the synthetic graph';
  END IF;
  IF EXISTS (SELECT 1 FROM welfare_evidence
      WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions)
        AND NOT (
          (road_vehicle_execution_id = 'd4800000-0000-0000-0000-000000000001'
            AND event_type = 'CHECKPOINT'
            AND checkpoint_id = 'd4a00000-0000-0000-0000-000000000001')
          OR (road_vehicle_execution_id IN ('d4800000-0000-0000-0000-000000000001',
                                            'd4800000-0000-0000-0000-000000000002')
            AND event_type = 'FINAL_DESTINATION' AND checkpoint_id IS NULL)
        )) THEN
    RAISE EXCEPTION 'Unexpected welfare evidence exists in the synthetic graph';
  END IF;
  IF EXISTS (SELECT 1 FROM proofs_of_delivery
      WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions)
        AND road_vehicle_execution_id <> 'd4800000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Unexpected Proof of Delivery exists in the synthetic graph';
  END IF;
  IF EXISTS (SELECT 1 FROM order_staff_assignments
        WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order))
      OR EXISTS (SELECT 1 FROM quotations
        WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order))
      OR EXISTS (SELECT 1 FROM payments
        WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order))
      OR EXISTS (SELECT 1 FROM horse_documents
        WHERE transport_order_horse_id IN (SELECT id FROM s3qa_r2r_order_horse))
      OR EXISTS (SELECT 1 FROM route_plan_reviews
        WHERE route_plan_id IN (SELECT id FROM s3qa_r2r_plan)) THEN
    RAISE EXCEPTION 'Unexpected upstream business records reference the synthetic fixture';
  END IF;
END
$validate_cleanup$;

SELECT EXISTS (
  SELECT 1 FROM welfare_evidence
  WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions)
  UNION ALL
  SELECT 1 FROM proofs_of_delivery
  WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions)
) AS has_cloudinary_assets \gset

\if :has_cloudinary_assets
  \if :{?cloudinary_cleanup_confirmation}
  \else
    \echo 'Cloudinary evidence exists; exact asset cleanup confirmation is required before database deletion'
    \quit 3
  \endif
  SELECT :'cloudinary_cleanup_confirmation' = 'S3QA-R2R-001-ASSETS-DELETED'
    AS cloudinary_cleanup_confirmed \gset
  \if :cloudinary_cleanup_confirmed
  \else
    \echo 'Cloudinary cleanup confirmation does not match S3QA-R2R-001'
    \quit 3
  \endif
\endif

DELETE FROM notifications
WHERE transport_order_id IN (SELECT id FROM s3qa_r2r_order);
DELETE FROM proofs_of_delivery
WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions);
DELETE FROM welfare_evidence
WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions);
DELETE FROM vehicle_checkpoint_arrivals
WHERE road_vehicle_execution_id IN (SELECT id FROM s3qa_r2r_executions);
DELETE FROM status_audit_logs
WHERE (entity_type = 'TRANSPORT_ORDER' AND entity_id IN (SELECT id FROM s3qa_r2r_order))
   OR (entity_type = 'ROUTE_LEG' AND entity_id IN (SELECT id FROM s3qa_r2r_legs));
DELETE FROM checkpoints
WHERE id = 'd4a00000-0000-0000-0000-000000000001'
  AND route_leg_id IN (SELECT id FROM s3qa_r2r_legs);
DELETE FROM road_vehicle_executions
WHERE id IN (SELECT id FROM s3qa_r2r_executions);
DELETE FROM road_leg_vehicle_horses
WHERE id IN ('d4700000-0000-0000-0000-000000000001',
             'd4700000-0000-0000-0000-000000000002')
  AND road_leg_vehicle_id IN (SELECT id FROM s3qa_r2r_road_vehicles);
DELETE FROM road_leg_vehicles
WHERE id IN (SELECT id FROM s3qa_r2r_road_vehicles);
DELETE FROM route_legs
WHERE id IN (SELECT id FROM s3qa_r2r_legs);
DELETE FROM route_plans
WHERE id IN (SELECT id FROM s3qa_r2r_plan);
DELETE FROM transport_order_horses
WHERE id IN (SELECT id FROM s3qa_r2r_order_horse);
DELETE FROM transport_orders
WHERE id IN (SELECT id FROM s3qa_r2r_order);
DELETE FROM horses
WHERE id = 'd4000000-0000-0000-0000-000000000001';
DELETE FROM vehicles
WHERE id IN ('d4300000-0000-0000-0000-000000000001',
             'd4300000-0000-0000-0000-000000000002');

DO $verify_cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM transport_orders
      WHERE id = 'd4100000-0000-0000-0000-000000000001' OR order_code = 'S3QA-R2R-001')
      OR EXISTS (SELECT 1 FROM horses
      WHERE id = 'd4000000-0000-0000-0000-000000000001' OR microchip_id = 'S3QA-R2R-MICRO-001')
      OR EXISTS (SELECT 1 FROM vehicles
      WHERE id IN ('d4300000-0000-0000-0000-000000000001',
                   'd4300000-0000-0000-0000-000000000002')
         OR plate_number IN ('S3QA-R2R-01', 'S3QA-R2R-02')) THEN
    RAISE EXCEPTION 'Exact synthetic identifiers remain after cleanup; transaction will roll back';
  END IF;
END
$verify_cleanup$;

COMMIT;
