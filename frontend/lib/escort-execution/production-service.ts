import { escortExecutionMutationApi, requestEscortJson } from "./api-service";
import {
  parseAssignedAirDetail,
  parseAssignedAirQueue,
  parseAssignedRoadDetail,
  parseAssignedRoadQueue,
} from "./read-contracts";
import type { EscortExecutionService } from "./types";

const roadLocators = new Map<string, string>();
const airLocators = new Map<string, string>();

async function readRoadDetail(executionId: string) {
  const detail = await requestEscortJson(
    `/api/v1/road-executions/${encodeURIComponent(executionId)}`,
    { method: "GET" },
    parseAssignedRoadDetail,
  );
  roadLocators.set(detail.executionId, detail.roadLegVehicleId);
  return detail;
}

async function readAirDetail(executionId: string) {
  const detail = await requestEscortJson(
    `/api/v1/air-executions/${encodeURIComponent(executionId)}`,
    { method: "GET" },
    parseAssignedAirDetail,
  );
  airLocators.set(detail.executionId, detail.routeLegId);
  return detail;
}

async function roadLocator(executionId: string) {
  return roadLocators.get(executionId) ?? (await readRoadDetail(executionId)).roadLegVehicleId;
}

async function airLocator(executionId: string) {
  return airLocators.get(executionId) ?? (await readAirDetail(executionId)).routeLegId;
}

export const productionEscortExecutionService: EscortExecutionService = {
  async listAssignedRoadWork() {
    const queue = await requestEscortJson(
      "/api/v1/road-executions/assigned",
      { method: "GET" },
      parseAssignedRoadQueue,
    );
    queue.executions.forEach((execution) => roadLocators.set(execution.executionId, execution.roadLegVehicleId));
    return queue;
  },
  getAssignedRoadExecution: readRoadDetail,
  async recordRoadWelfare(executionId, input) {
    await escortExecutionMutationApi.recordRoadWelfare(await roadLocator(executionId), input);
  },
  recordRoadProofOfDelivery(roadLegVehicleId, input) {
    return escortExecutionMutationApi.recordRoadProofOfDelivery(roadLegVehicleId, input);
  },
  async listAssignedAirWork() {
    const queue = await requestEscortJson(
      "/api/v1/air-executions/assigned",
      { method: "GET" },
      parseAssignedAirQueue,
    );
    queue.executions.forEach((execution) => airLocators.set(execution.executionId, execution.routeLegId));
    return queue;
  },
  getAssignedAirExecution: readAirDetail,
  async startAirExecution(executionId) {
    await escortExecutionMutationApi.startAirExecution(await airLocator(executionId));
  },
  async recordAirDestinationArrival(executionId) {
    await escortExecutionMutationApi.recordAirDestinationArrival(await airLocator(executionId));
  },
  async recordAirWelfare(executionId, input) {
    await escortExecutionMutationApi.recordAirWelfare(await airLocator(executionId), input);
  },
  async completeAirExecution(executionId) {
    await escortExecutionMutationApi.completeAirExecution(await airLocator(executionId));
  },
  recordAirProofOfDelivery(routeLegId, input) {
    return escortExecutionMutationApi.recordAirProofOfDelivery(routeLegId, input);
  },
};
