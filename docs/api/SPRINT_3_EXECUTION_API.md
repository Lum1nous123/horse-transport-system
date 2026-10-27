# Sprint 3 Execution API contract

All endpoints require `Authorization: Bearer <jwt>`. UUIDs and timestamps below are examples. Persisted evidence URLs are returned unchanged. `photoName` and `proofPhotoName` are semantic presentation labels, not original upload names.

Public Cloudinary URLs are approved for Sprint 3 demonstration data only. They must contain synthetic, non-sensitive images and must not be treated as protected production evidence.

## ROAD assigned queue

`GET /api/v1/road-executions/assigned` — roles `DRIVER`, `ESCORT`; filtered by the JWT user.

```json
{
  "executions": [{
    "executionId": "10000000-0000-0000-0000-000000000001",
    "roadLegVehicleId": "20000000-0000-0000-0000-000000000001",
    "routeLegId": "30000000-0000-0000-0000-000000000001",
    "orderId": "40000000-0000-0000-0000-000000000001",
    "orderCode": "ORD-S3-001",
    "orderStatus": "IN_PROGRESS",
    "routeLegSequenceNo": 1,
    "routeLegStatus": "IN_PROGRESS",
    "isFinalLeg": true,
    "origin": "Lexington, KY",
    "destination": "JFK Airport",
    "plannedDepartureAt": "2026-10-27T08:00:00",
    "vehiclePlateNumber": "51H-123.45",
    "vehicleName": "Horse Van 1",
    "horseCount": 2,
    "status": "COMPLETED",
    "reachedCheckpointCount": 2,
    "pendingCheckpointWelfareCount": 0,
    "destinationArrivedAt": "2026-10-27T15:00:00",
    "finalWelfareRecorded": true,
    "proofOfDeliveryRecorded": false,
    "proofOfDeliveryAvailable": true,
    "handoverProgress": {
      "completedHandovers": 0,
      "requiredHandovers": 1,
      "routeLegStatus": "IN_PROGRESS",
      "orderStatus": "IN_PROGRESS"
    }
  }]
}
```

The active queue includes `NOT_STARTED`, `IN_PROGRESS`, `DESTINATION`, and final ROAD `COMPLETED` executions awaiting PoD. Completed executions with no remaining action are excluded.

## ROAD execution detail

`GET /api/v1/road-executions/{executionId}` — assigned `DRIVER` or `ESCORT`; foreign assignment is 404.

```json
{
  "executionId": "10000000-0000-0000-0000-000000000001",
  "roadLegVehicleId": "20000000-0000-0000-0000-000000000001",
  "routeLegId": "30000000-0000-0000-0000-000000000001",
  "orderId": "40000000-0000-0000-0000-000000000001",
  "orderCode": "ORD-S3-001",
  "orderStatus": "IN_PROGRESS",
  "routeLegSequenceNo": 1,
  "routeLegStatus": "IN_PROGRESS",
  "isFinalLeg": true,
  "origin": "Lexington, KY",
  "destination": "JFK Airport",
  "plannedDepartureAt": "2026-10-27T08:00:00",
  "vehiclePlateNumber": "51H-123.45",
  "vehicleName": "Horse Van 1",
  "horseCount": 1,
  "status": "DESTINATION",
  "reachedCheckpointCount": 1,
  "pendingCheckpointWelfareCount": 0,
  "assignedAt": "2026-10-26T10:00:00",
  "startedAt": "2026-10-27T08:05:00",
  "destinationArrivedAt": "2026-10-27T15:00:00",
  "completedAt": null,
  "assignedDriver": {"id": "50000000-0000-0000-0000-000000000001", "fullName": "Dana Driver"},
  "assignedEscort": {"id": "50000000-0000-0000-0000-000000000002", "fullName": "Eli Escort"},
  "horses": [{
    "id": "60000000-0000-0000-0000-000000000001",
    "transportOrderHorseId": "70000000-0000-0000-0000-000000000001",
    "name": "Silver Star",
    "microchipId": "MICRO-S3-001"
  }],
  "checkpoints": [{
    "id": "80000000-0000-0000-0000-000000000001",
    "sequenceNo": 1,
    "name": "Rest Farm",
    "checkpointType": "REST_STOP",
    "arrivedAt": "2026-10-27T11:00:00",
    "welfareEvidence": {
      "id": "90000000-0000-0000-0000-000000000001",
      "roadVehicleExecutionId": "10000000-0000-0000-0000-000000000001",
      "airLegExecutionId": null,
      "checkpointId": "80000000-0000-0000-0000-000000000001",
      "eventType": "CHECKPOINT",
      "photoUrl": "https://res.cloudinary.com/demo/image/upload/v1/checkpoint.jpg",
      "photoName": "checkpoint-welfare.jpg",
      "note": "Calm and hydrated",
      "recordedByEscortId": "50000000-0000-0000-0000-000000000002",
      "recordedAt": "2026-10-27T11:05:00"
    }
  }],
  "finalWelfareEvidence": null,
  "proofOfDelivery": null,
  "proofOfDeliveryRecorded": false,
  "proofOfDeliveryAvailable": false,
  "handoverProgress": {"completedHandovers": 0, "requiredHandovers": 1, "routeLegStatus": "IN_PROGRESS", "orderStatus": "IN_PROGRESS"},
  "availableActions": {
    "start": false,
    "nextCheckpointId": null,
    "arriveAtDestination": false,
    "checkpointWelfareIds": [],
    "finalWelfare": true,
    "proofOfDelivery": false
  },
  "lastUpdatedAt": "2026-10-27T15:00:00"
}
```

## AIR assigned queue

`GET /api/v1/air-executions/assigned` — assigned `ESCORT` only.

```json
{
  "executions": [{
    "executionId": "a0000000-0000-0000-0000-000000000001",
    "routeLegId": "a0000000-0000-0000-0000-000000000002",
    "orderId": "40000000-0000-0000-0000-000000000001",
    "orderCode": "ORD-S3-001",
    "orderStatus": "IN_PROGRESS",
    "routeLegSequenceNo": 2,
    "routeLegStatus": "IN_PROGRESS",
    "isFinalLeg": false,
    "origin": "JFK Airport",
    "destination": "Brussels Airport",
    "plannedDepartureAt": "2026-10-28T08:00:00",
    "plannedArrivalAt": "2026-10-28T16:00:00",
    "status": "DESTINATION",
    "welfareRecorded": true,
    "proofOfDeliveryRecorded": false,
    "proofOfDeliveryAvailable": false,
    "handoverProgress": {"completedHandovers": 0, "requiredHandovers": 0, "routeLegStatus": "IN_PROGRESS", "orderStatus": "IN_PROGRESS"},
    "availableActions": {"start": false, "arriveAtDestination": false, "recordWelfare": false, "complete": true}
  }]
}
```

## AIR execution detail

`GET /api/v1/air-executions/{executionId}` — assigned `ESCORT`; foreign assignment is 404.

```json
{
  "executionId": "a0000000-0000-0000-0000-000000000001",
  "routeLegId": "a0000000-0000-0000-0000-000000000002",
  "orderId": "40000000-0000-0000-0000-000000000001",
  "orderCode": "ORD-S3-001",
  "orderStatus": "IN_PROGRESS",
  "routeLegSequenceNo": 2,
  "routeLegStatus": "IN_PROGRESS",
  "isFinalLeg": false,
  "origin": "JFK Airport",
  "destination": "Brussels Airport",
  "plannedDepartureAt": "2026-10-28T08:00:00",
  "plannedArrivalAt": "2026-10-28T16:00:00",
  "status": "DESTINATION",
  "assignedAt": "2026-10-26T10:00:00",
  "startedAt": "2026-10-28T08:01:00",
  "destinationArrivedAt": "2026-10-28T16:02:00",
  "completedAt": null,
  "assignedEscort": {"id": "50000000-0000-0000-0000-000000000002", "fullName": "Eli Escort"},
  "horses": [{"id": "60000000-0000-0000-0000-000000000001", "transportOrderHorseId": "70000000-0000-0000-0000-000000000001", "name": "Silver Star", "microchipId": "MICRO-S3-001"}],
  "welfareEvidence": {
    "id": "90000000-0000-0000-0000-000000000002",
    "roadVehicleExecutionId": null,
    "airLegExecutionId": "a0000000-0000-0000-0000-000000000001",
    "checkpointId": null,
    "eventType": "FINAL_DESTINATION",
    "photoUrl": "https://res.cloudinary.com/demo/image/upload/v2/final.jpg",
    "photoName": "final-welfare.jpg",
    "note": "Fit after flight",
    "recordedByEscortId": "50000000-0000-0000-0000-000000000002",
    "recordedAt": "2026-10-28T16:10:00"
  },
  "proofOfDelivery": null,
  "proofOfDeliveryRecorded": false,
  "proofOfDeliveryAvailable": false,
  "handoverProgress": {"completedHandovers": 0, "requiredHandovers": 0, "routeLegStatus": "IN_PROGRESS", "orderStatus": "IN_PROGRESS"},
  "availableActions": {"start": false, "arriveAtDestination": false, "recordWelfare": false, "complete": true},
  "lastUpdatedAt": "2026-10-28T16:10:00"
}
```

## Proof of Delivery readback

`GET /api/v1/road-executions/vehicles/{roadLegVehicleId}/proof-of-delivery`

`GET /api/v1/air-executions/legs/{routeLegId}/proof-of-delivery`

Both are assigned `ESCORT` only. Missing or foreign resources return 404. The AIR form sets `roadVehicleExecutionId` to `null`; the ROAD form sets `airLegExecutionId` to `null`.

```json
{
  "id": "b0000000-0000-0000-0000-000000000001",
  "roadVehicleExecutionId": "10000000-0000-0000-0000-000000000001",
  "airLegExecutionId": null,
  "routeLegId": "30000000-0000-0000-0000-000000000001",
  "transportedOrderHorseIds": ["70000000-0000-0000-0000-000000000001"],
  "recipientName": "Alex Receiver",
  "proofPhotoUrl": "https://res.cloudinary.com/demo/image/upload/v3/pod.jpg",
  "proofPhotoName": "proof-of-delivery.jpg",
  "handoverNote": "Safe handover",
  "confirmedByEscortId": "50000000-0000-0000-0000-000000000002",
  "deliveredAt": "2026-10-28T17:00:00",
  "createdAt": "2026-10-28T17:00:00",
  "completedHandovers": 1,
  "requiredHandovers": 1,
  "routeLegStatus": "COMPLETED",
  "orderStatus": "DELIVERED"
}
```

## Explicit non-final AIR complete

`POST /api/v1/air-executions/legs/{routeLegId}/complete` — assigned active `ESCORT`, non-final AIR only, after destination arrival and persisted welfare.

```json
{
  "id": "a0000000-0000-0000-0000-000000000001",
  "routeLegId": "a0000000-0000-0000-0000-000000000002",
  "escortId": "50000000-0000-0000-0000-000000000002",
  "status": "COMPLETED",
  "startedAt": "2026-10-28T08:01:00",
  "destinationArrivedAt": "2026-10-28T16:02:00",
  "completedAt": "2026-10-28T16:15:00"
}
```

Duplicate completion returns the persisted representation. Premature completion and completion of the final AIR leg return 409.

## Error envelope

```json
{
  "code": "EXECUTION_CONFLICT",
  "message": "Non-final AIR completion requires welfare evidence",
  "timestamp": "2026-10-28T09:15:30Z"
}
```

Execution endpoints use 400 for malformed input, invalid fields, or invalid media; 401 for no valid authentication; 403 for wrong role or inactive staff; 404 for nonexistent/foreign assignment; 409 with `EXECUTION_CONFLICT` for invalid lifecycle state; and 502 for media storage failure.
