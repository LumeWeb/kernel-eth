import {
  Bytes32,
  ClientConfig,
  ExecutionInfo,
  LightClientUpdate,
  OptimisticUpdate,
  VerifyWithReason,
} from "./types.js";
import {
  concatUint8Array,
  getDefaultClientConfig,
  isUint8ArrayEq,
} from "./utils.js";
import { IProver } from "./interfaces.js";
import {
  BEACON_SYNC_SUPER_MAJORITY,
  DEFAULT_BATCH_SIZE,
  POLLING_DELAY,
} from "./constants.js";
import {
  computeSyncPeriodAtSlot,
  getCurrentSlot,
} from "@lodestar/light-client/utils";
import {
  assertValidLightClientUpdate,
  assertValidSignedHeader,
} from "@lodestar/light-client/validation";
import { SyncCommitteeFast } from "@lodestar/light-client";
import bls from "@chainsafe/bls/switchable";
import { PublicKey } from "@chainsafe/bls/types.js";
import { fromHexString, toHexString } from "@chainsafe/ssz";
import * as altair from "@lodestar/types/altair";
import * as phase0 from "@lodestar/types/phase0";
import * as bellatrix from "@lodestar/types/bellatrix";
import { init } from "@chainsafe/bls/switchable";
import { VerifyingProvider } from "./rpc/provider.js";
import { digest } from "@chainsafe/as-sha256";

export default class Client {
  latestCommittee?: Uint8Array[];
  latestPeriod: number = -1;
  latestBlockHash?: string;
  private config: ClientConfig = getDefaultClientConfig();
  private genesisCommittee: Uint8Array[] = this.config.genesis.committee.map(
    (pk) => fromHexString(pk)
  );
  private genesisPeriod = computeSyncPeriodAtSlot(this.config.genesis.slot);
  private genesisTime = this.config.genesis.time;
  private prover: IProver;
  private rpcCallback: Function;

  constructor(prover: IProver, rpcCallback: Function) {
    this.prover = prover;
    this.rpcCallback = rpcCallback;
  }

  private _provider?: VerifyingProvider;

  get provider(): VerifyingProvider {
    return this._provider as VerifyingProvider;
  }

  public get isSynced() {
    return this.latestPeriod === this.getCurrentPeriod();
  }

  public async sync(): Promise<VerifyingProvider> {
    await init("herumi");

    await this._sync();

    if (!this._provider) {
      const { blockhash, blockNumber } = await this.getNextValidExecutionInfo();
      const provider = new VerifyingProvider(
        this.rpcCallback,
        blockNumber,
        blockhash
      );
      this.subscribe((ei) => {
        console.log(
          `Recieved a new blockheader: ${ei.blockNumber} ${ei.blockhash}`
        );
        provider.update(ei.blockhash, ei.blockNumber);
      });

      this._provider = provider;
    }

    return this._provider;
  }

  public getCurrentPeriod(): number {
    return computeSyncPeriodAtSlot(
      getCurrentSlot(this.config.chainConfig, this.genesisTime)
    );
  }

  public async subscribe(callback: (ei: ExecutionInfo) => void) {
    setInterval(async () => {
      try {
        await this._sync();
        const ei = await this.getLatestExecution();
        if (ei && ei.blockhash !== this.latestBlockHash) {
          this.latestBlockHash = ei.blockhash;
          return await callback(ei);
        }
      } catch (e) {
        console.error(e);
      }
    }, POLLING_DELAY);
  }

  async optimisticUpdateVerify(
    committee: Uint8Array[],
    update: OptimisticUpdate
  ): Promise<VerifyWithReason> {
    const { attestedHeader: header, syncAggregate } = update;
    const headerBlockRoot = phase0.ssz.BeaconBlockHeader.hashTreeRoot(
      header.beacon
    );
    const committeeFast = this.deserializeSyncCommittee(committee);
    try {
      await assertValidSignedHeader(
        this.config.chainConfig,
        committeeFast,
        syncAggregate,
        headerBlockRoot,
        header.beacon.slot
      );
    } catch (e) {
      return { correct: false, reason: "invalid signatures" };
    }

    const participation =
      syncAggregate.syncCommitteeBits.getTrueBitIndexes().length;
    if (participation < BEACON_SYNC_SUPER_MAJORITY) {
      return { correct: false, reason: "insufficient signatures" };
    }
    return { correct: true };
  }

  public async getNextValidExecutionInfo(
    retry: number = 10
  ): Promise<ExecutionInfo> {
    if (retry === 0)
      throw new Error(
        "no valid execution payload found in the given retry limit"
      );
    const ei = await this.getLatestExecution();
    if (ei) return ei;
    // delay for the next slot
    await new Promise((resolve) => setTimeout(resolve, POLLING_DELAY));
    return this.getNextValidExecutionInfo(retry - 1);
  }

  private async _sync() {
    const currentPeriod = this.getCurrentPeriod();
    if (currentPeriod > this.latestPeriod) {
      this.latestCommittee = await this.syncFromGenesis();
      this.latestPeriod = currentPeriod;
    }
  }

  // committee and prover index of the first honest prover
  private async syncFromGenesis(): Promise<Uint8Array[]> {
    const currentPeriod = this.getCurrentPeriod();
    let startPeriod = this.genesisPeriod;

    let lastCommitteeHash: Uint8Array = this.getCommitteeHash(
      this.genesisCommittee
    );

    for (let period = startPeriod + 1; period <= currentPeriod; period++) {
      try {
        lastCommitteeHash = await this.prover.getCommitteeHash(
          period,
          currentPeriod,
          DEFAULT_BATCH_SIZE
        );
      } catch (e: any) {
        throw new Error(
          `failed to fetch committee hash for prover at period(${period}): ${e.meessage}`
        );
      }
    }
    return this.getCommittee(currentPeriod, lastCommitteeHash);
  }

  async getCommittee(
    period: number,
    expectedCommitteeHash: Uint8Array | null
  ): Promise<Uint8Array[]> {
    if (period === this.genesisPeriod) return this.genesisCommittee;
    if (!expectedCommitteeHash)
      throw new Error("expectedCommitteeHash required");
    const committee = await this.prover.getCommittee(period);
    const committeeHash = this.getCommitteeHash(committee);
    if (!isUint8ArrayEq(committeeHash, expectedCommitteeHash as Uint8Array))
      throw new Error("prover responded with an incorrect committee");
    return committee;
  }

  private async getLatestExecution(): Promise<ExecutionInfo | null> {
    const updateJSON = await this.prover.callback(
      "consensus_optimistic_update"
    );
    const update = this.optimisticUpdateFromJSON(updateJSON);
    const verify = await this.optimisticUpdateVerify(
      this.latestCommittee as Uint8Array[],
      update
    );
    if (!verify.correct) {
      console.error(`Invalid Optimistic Update: ${verify.reason}`);
      return null;
    }
    console.log(
      `Optimistic update verified for slot ${updateJSON.attested_header.beacon.slot}`
    );
    return this.getExecutionFromBlockRoot(
      updateJSON.attested_header.beacon.slot,
      updateJSON.attested_header.beacon.body_root
    );
  }

  private async getExecutionFromBlockRoot(
    slot: bigint,
    expectedBlockRoot: Bytes32
  ): Promise<ExecutionInfo> {
    const res = await this.prover.callback("consensus_block", {
      block: slot,
    });
    const blockJSON = res.message.body;
    const block = bellatrix.ssz.BeaconBlockBody.fromJson(blockJSON);
    const blockRoot = toHexString(
      bellatrix.ssz.BeaconBlockBody.hashTreeRoot(block)
    );
    if (blockRoot !== expectedBlockRoot) {
      throw Error(
        `block provided by the beacon chain api doesn't match the expected block root`
      );
    }

    return {
      blockhash: blockJSON.execution_payload.block_hash,
      blockNumber: blockJSON.execution_payload.block_number,
    };
  }

  private deserializeSyncCommittee(
    syncCommittee: Uint8Array[]
  ): SyncCommitteeFast {
    const pubkeys = this.deserializePubkeys(syncCommittee);
    return {
      pubkeys,
      aggregatePubkey: bls.PublicKey.aggregate(pubkeys),
    };
  }

  private deserializePubkeys(pubkeys: Uint8Array[]): PublicKey[] {
    return pubkeys.map((pk) => bls.PublicKey.fromBytes(pk));
  }
  private getCommitteeHash(committee: Uint8Array[]): Uint8Array {
    return digest(concatUint8Array(committee));
  }
  private optimisticUpdateFromJSON(update: any): OptimisticUpdate {
    return altair.ssz.LightClientOptimisticUpdate.fromJson(update);
  }
}
