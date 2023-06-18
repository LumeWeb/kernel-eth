import * as capella from "@lodestar/types/capella";
import { BeaconConfig } from "@lodestar/config";

export type PubKeyString = string;
export type Slot = number;
export type Bytes32 = string;

export type OptimisticUpdate = capella.LightClientOptimisticUpdate;
export type LightClientUpdate = capella.LightClientUpdate;

export type GenesisData = {
  committee: PubKeyString[];
  slot: Slot;
  time: number;
};

export type ClientConfig = {
  genesis: GenesisData;
  chainConfig: BeaconConfig;
  // treeDegree in case of Superlight and batchSize in case of Light and Optimistic
  n?: number;
};

export type ExecutionInfo = {
  blockhash: string;
  blockNumber: bigint;
};

export type VerifyWithReason =
  | { correct: true }
  | { correct: false; reason: string };
