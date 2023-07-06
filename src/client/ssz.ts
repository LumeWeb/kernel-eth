import {
  ByteVectorType,
  ContainerType,
  ListCompositeType,
  VectorCompositeType,
} from "@chainsafe/ssz";
import * as capella from "@lodestar/types/capella";
import { BEACON_SYNC_COMMITTEE_SIZE } from "./constants.js";

const MAX_BATCHSIZE = 10000;

export const LightClientUpdateSSZ = capella.ssz
  .LightClientUpdate as unknown as ContainerType<{
  attestedHeader: ContainerType<{
    beacon: ContainerType<{
      slot: import("@chainsafe/ssz").UintNumberType;
      proposerIndex: import("@chainsafe/ssz").UintNumberType;
      parentRoot: import("@chainsafe/ssz").ByteVectorType;
      stateRoot: import("@chainsafe/ssz").ByteVectorType;
      bodyRoot: import("@chainsafe/ssz").ByteVectorType;
    }>;
    execution: ContainerType<{
      withdrawalsRoot: import("@chainsafe/ssz").ByteVectorType;
      transactionsRoot: import("@chainsafe/ssz").ByteVectorType;
      blockHash: import("@chainsafe/ssz").ByteVectorType;
      parentHash: import("@chainsafe/ssz").ByteVectorType;
      feeRecipient: import("@chainsafe/ssz").ByteVectorType;
      stateRoot: import("@chainsafe/ssz").ByteVectorType;
      receiptsRoot: import("@chainsafe/ssz").ByteVectorType;
      logsBloom: import("@chainsafe/ssz").ByteVectorType;
      prevRandao: import("@chainsafe/ssz").ByteVectorType;
      blockNumber: import("@chainsafe/ssz").UintNumberType;
      gasLimit: import("@chainsafe/ssz").UintNumberType;
      gasUsed: import("@chainsafe/ssz").UintNumberType;
      timestamp: import("@chainsafe/ssz").UintNumberType;
      extraData: import("@chainsafe/ssz").ByteListType;
      baseFeePerGas: import("@chainsafe/ssz").UintBigintType;
    }>;
    executionBranch: VectorCompositeType<
      import("@chainsafe/ssz").ByteVectorType
    >;
  }>;
  nextSyncCommittee: ContainerType<{
    pubkeys: VectorCompositeType<import("@chainsafe/ssz").ByteVectorType>;
    aggregatePubkey: import("@chainsafe/ssz").ByteVectorType;
  }>;
  nextSyncCommitteeBranch: VectorCompositeType<
    import("@chainsafe/ssz").ByteVectorType
  >;
  finalizedHeader: ContainerType<{
    beacon: ContainerType<{
      slot: import("@chainsafe/ssz").UintNumberType;
      proposerIndex: import("@chainsafe/ssz").UintNumberType;
      parentRoot: import("@chainsafe/ssz").ByteVectorType;
      stateRoot: import("@chainsafe/ssz").ByteVectorType;
      bodyRoot: import("@chainsafe/ssz").ByteVectorType;
    }>;
    execution: ContainerType<{
      withdrawalsRoot: import("@chainsafe/ssz").ByteVectorType;
      transactionsRoot: import("@chainsafe/ssz").ByteVectorType;
      blockHash: import("@chainsafe/ssz").ByteVectorType;
      parentHash: import("@chainsafe/ssz").ByteVectorType;
      feeRecipient: import("@chainsafe/ssz").ByteVectorType;
      stateRoot: import("@chainsafe/ssz").ByteVectorType;
      receiptsRoot: import("@chainsafe/ssz").ByteVectorType;
      logsBloom: import("@chainsafe/ssz").ByteVectorType;
      prevRandao: import("@chainsafe/ssz").ByteVectorType;
      blockNumber: import("@chainsafe/ssz").UintNumberType;
      gasLimit: import("@chainsafe/ssz").UintNumberType;
      gasUsed: import("@chainsafe/ssz").UintNumberType;
      timestamp: import("@chainsafe/ssz").UintNumberType;
      extraData: import("@chainsafe/ssz").ByteListType;
      baseFeePerGas: import("@chainsafe/ssz").UintBigintType;
    }>;
    executionBranch: VectorCompositeType<
      import("@chainsafe/ssz").ByteVectorType
    >;
  }>;
  finalityBranch: VectorCompositeType<import("@chainsafe/ssz").ByteVectorType>;
  syncAggregate: ContainerType<{
    syncCommitteeBits: import("@chainsafe/ssz").BitVectorType;
    syncCommitteeSignature: import("@chainsafe/ssz").ByteVectorType;
  }>;
  signatureSlot: import("@chainsafe/ssz").UintNumberType;
}>;
export const LightClientUpdatesSSZ = new ListCompositeType(
  LightClientUpdateSSZ as any,
  MAX_BATCHSIZE,
);

export const CommitteeSSZ = new VectorCompositeType(
  new ByteVectorType(48),
  BEACON_SYNC_COMMITTEE_SIZE,
);

const HashSSZ = new ByteVectorType(32);
export const HashesSSZ = new ListCompositeType(HashSSZ, MAX_BATCHSIZE);
