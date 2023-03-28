import { routes } from "@lodestar/api";
import { BeaconConfig } from "@lodestar/config";
import * as altair from "@lodestar/types/altair";

export type PubKeyString = string;
export type Slot = number;
export type Bytes32 = string;

export type OptimisticUpdate = altair.LightClientOptimisticUpdate;
export type LightClientUpdate = altair.LightClientUpdate;

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
