// Captured from ddd7bcb:frontend/lib/escort-execution/mock-service.ts and
// mock-preview-progression.ts. This intentionally contains neither FE-16
// Vehicle/PoD fields nor the seventh final ROAD execution.
export function preFe16RoadSnapshot() {
  return {
    version: 2,
    progression: {
      routeLegs: [
        { id: "leg-2074-1", orderId: "order-2074", sequenceNo: 1, mode: "ROAD", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "leg-2108-3", orderId: "order-2108", sequenceNo: 3, mode: "ROAD", isFinalLeg: true, status: "IN_PROGRESS" },
        { id: "air-leg-3001-2", orderId: "order-3001", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "PLANNED" },
        { id: "air-leg-3002-1", orderId: "order-3002", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "READY" },
        { id: "air-leg-3003-2", orderId: "order-3003", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "air-leg-3004-2", orderId: "order-3004", sequenceNo: 2, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "air-leg-3005-3", orderId: "order-3005", sequenceNo: 3, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "air-leg-3005-4", orderId: "order-3005", sequenceNo: 4, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
        { id: "air-leg-3006-final", orderId: "order-3006", sequenceNo: 3, mode: "AIR", isFinalLeg: true, status: "IN_PROGRESS" },
        { id: "air-leg-foreign", orderId: "order-foreign", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "READY" },
        { id: "air-leg-3007-1", orderId: "order-3007", sequenceNo: 1, mode: "AIR", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "road-leg-3007-2", orderId: "order-3007", sequenceNo: 2, mode: "ROAD", isFinalLeg: false, status: "PLANNED" },
        { id: "air-leg-3007-3", orderId: "order-3007", sequenceNo: 3, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
        { id: "road-leg-3008-1", orderId: "order-3008", sequenceNo: 1, mode: "ROAD", isFinalLeg: false, status: "IN_PROGRESS" },
        { id: "air-leg-3008-2", orderId: "order-3008", sequenceNo: 2, mode: "AIR", isFinalLeg: true, status: "PLANNED" },
      ],
    },
    road: {
      routeLegs: [
        {
          id: "leg-2074-1", sequenceNo: 1, status: "IN_PROGRESS", isFinalLeg: false,
          origin: "Lexington, United States", destination: "Chicago O'Hare Cargo Terminal",
          plannedDepartureAt: "2026-10-28T09:00:00-04:00",
          checkpoints: [
            { id: "checkpoint-lex-1", sequenceNo: 1, name: "Bluegrass rest area", checkpointType: "REST_STOP" },
            { id: "checkpoint-lex-2", sequenceNo: 2, name: "Chicago cargo gate", checkpointType: "OTHER" },
          ],
        },
        {
          id: "leg-2108-3", sequenceNo: 3, status: "IN_PROGRESS", isFinalLeg: true,
          origin: "Brussels Airport Cargo", destination: "Chantilly, France",
          plannedDepartureAt: "2026-10-30T08:00:00+01:00", checkpoints: [],
        },
        {
          id: "road-leg-3007-2", sequenceNo: 2, status: "PLANNED", isFinalLeg: false,
          origin: "London Heathrow Animal Reception Centre", destination: "Newmarket Equine Centre",
          plannedDepartureAt: "2026-11-03T12:00:00Z", checkpoints: [],
        },
        {
          id: "road-leg-3008-1", sequenceNo: 1, status: "IN_PROGRESS", isFinalLeg: false,
          origin: "Lexington, United States", destination: "Chicago O'Hare Cargo Terminal",
          plannedDepartureAt: "2026-11-05T08:00:00-05:00", checkpoints: [],
        },
      ],
      executions: [
        {
          id: "road-execution-2074-a", orderId: "order-2074", orderCode: "ORD-2074", routeLegId: "leg-2074-1",
          assignedEscortId: "escort-mia", assignedEscortName: "Mia Laurent", driverName: "Noah Williams",
          vehiclePlateNumber: "TRK-101", vehicleName: "EquiMove 1",
          horses: [
            { id: "horse-apollo", name: "Apollo", microchipId: "985141000120101" },
            { id: "horse-bella", name: "Bella", microchipId: "985141000120102" },
          ],
          status: "IN_PROGRESS", checkpointArrivals: { "checkpoint-lex-1": "2026-10-28T14:18:00-04:00" },
          checkpointWelfare: {}, destinationArrivedAt: null, finalWelfareEvidence: null,
          lastUpdatedAt: "2026-10-28T14:18:00-04:00",
        },
        {
          id: "road-execution-2108-final", orderId: "order-2108", orderCode: "ORD-2108", routeLegId: "leg-2108-3",
          assignedEscortId: "escort-mia", assignedEscortName: "Mia Laurent", driverName: "Ethan Brown",
          vehiclePlateNumber: "BE-210", vehicleName: "Brussels Equine Van",
          horses: [{ id: "horse-comet", name: "Silver Comet", microchipId: "985141000120210" }],
          status: "DESTINATION", checkpointArrivals: {}, checkpointWelfare: {},
          destinationArrivedAt: "2026-10-30T11:42:00+01:00", finalWelfareEvidence: null,
          lastUpdatedAt: "2026-10-30T11:42:00+01:00",
        },
        {
          id: "road-execution-2074-b", orderId: "order-2074", orderCode: "ORD-2074", routeLegId: "leg-2074-1",
          assignedEscortId: "escort-liam", assignedEscortName: "Liam Foster", driverName: "Oliver Martin",
          vehiclePlateNumber: "TRK-102", vehicleName: "Stallion Express",
          horses: [
            { id: "horse-commander", name: "Commander", microchipId: "985141000120103" },
            { id: "horse-dakota", name: "Dakota", microchipId: "985141000120104" },
          ],
          status: "IN_PROGRESS",
          checkpointArrivals: { "checkpoint-lex-1": "2026-10-28T14:47:00-04:00", "checkpoint-lex-2": "2026-10-28T17:06:00-05:00" },
          checkpointWelfare: {}, destinationArrivedAt: null, finalWelfareEvidence: null,
          lastUpdatedAt: "2026-10-28T17:06:00-05:00",
        },
        {
          id: "road-execution-after-air", orderId: "order-3007", orderCode: "ORD-3007", routeLegId: "road-leg-3007-2",
          assignedEscortId: "escort-mia", assignedEscortName: "Mia Laurent", driverName: "Avery Thomas",
          vehiclePlateNumber: "UK-307", vehicleName: "Newmarket Connector",
          horses: [{ id: "horse-3007", name: "Northern Light", microchipId: "985141000123007" }],
          status: "NOT_STARTED", checkpointArrivals: {}, checkpointWelfare: {}, destinationArrivedAt: null,
          finalWelfareEvidence: null, lastUpdatedAt: "2026-11-03T09:25:00Z",
        },
        {
          id: "road-execution-to-air", orderId: "order-3008", orderCode: "ORD-3008", routeLegId: "road-leg-3008-1",
          assignedEscortId: "escort-mia", assignedEscortName: "Mia Laurent", driverName: "Jordan Miller",
          vehiclePlateNumber: "US-308", vehicleName: "Midwest Equine Transfer",
          horses: [{ id: "horse-3008", name: "Blue Horizon", microchipId: "985141000123008" }],
          status: "DESTINATION", checkpointArrivals: {}, checkpointWelfare: {},
          destinationArrivedAt: "2026-11-05T14:50:00-06:00", finalWelfareEvidence: null,
          lastUpdatedAt: "2026-11-05T14:50:00-06:00",
        },
        {
          id: "road-execution-to-air-b", orderId: "order-3008", orderCode: "ORD-3008", routeLegId: "road-leg-3008-1",
          assignedEscortId: "escort-liam", assignedEscortName: "Liam Foster", driverName: "Taylor Anderson",
          vehiclePlateNumber: "US-309", vehicleName: "Midwest Equine Transfer 2",
          horses: [{ id: "horse-3009", name: "Prairie Star", microchipId: "985141000123009" }],
          status: "DESTINATION", checkpointArrivals: {}, checkpointWelfare: {},
          destinationArrivedAt: "2026-11-05T14:57:00-06:00", finalWelfareEvidence: null,
          lastUpdatedAt: "2026-11-05T14:57:00-06:00",
        },
      ],
    },
  };
}
