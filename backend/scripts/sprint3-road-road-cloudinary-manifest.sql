\set ON_ERROR_STOP on

\ir sprint3-road-road-target-preflight.sql

BEGIN TRANSACTION READ ONLY;

WITH exact_executions AS (
  SELECT execution.id
  FROM transport_orders transport_order
  JOIN route_plans plan ON plan.transport_order_id = transport_order.id
  JOIN route_legs leg ON leg.route_plan_id = plan.id
  JOIN road_leg_vehicles road_vehicle ON road_vehicle.route_leg_id = leg.id
  JOIN road_vehicle_executions execution ON execution.road_leg_vehicle_id = road_vehicle.id
  WHERE transport_order.id = 'd4100000-0000-0000-0000-000000000001'
    AND transport_order.order_code = 'S3QA-R2R-001'
    AND plan.id = 'd4400000-0000-0000-0000-000000000001'
    AND leg.id IN ('d4500000-0000-0000-0000-000000000001',
                   'd4500000-0000-0000-0000-000000000002')
    AND road_vehicle.id IN ('d4600000-0000-0000-0000-000000000001',
                            'd4600000-0000-0000-0000-000000000002')
    AND execution.id IN ('d4800000-0000-0000-0000-000000000001',
                         'd4800000-0000-0000-0000-000000000002')
)
SELECT 'WELFARE' AS asset_kind, evidence.id AS record_id, evidence.photo_url AS exact_url
FROM welfare_evidence evidence
WHERE evidence.road_vehicle_execution_id IN (SELECT id FROM exact_executions)
UNION ALL
SELECT 'PROOF_OF_DELIVERY', proof.id, proof.proof_photo_url
FROM proofs_of_delivery proof
WHERE proof.road_vehicle_execution_id IN (SELECT id FROM exact_executions)
ORDER BY asset_kind, record_id;

ROLLBACK;
