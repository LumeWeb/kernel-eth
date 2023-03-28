import {
  Bytes32,
  ClientConfig,
  ExecutionInfo,
  LightClientUpdate,
  OptimisticUpdate,
  VerifyWithReason,
} from "./types.js";
import { getDefaultClientConfig } from "./utils.js";
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
import { AsyncOrSync } from "ts-essentials";
import * as altair from "@lodestar/types/altair";
import * as phase0 from "@lodestar/types/phase0";
import * as bellatrix from "@lodestar/types/bellatrix";
import { init } from "@chainsafe/bls/switchable";
import { VerifyingProvider } from "./rpc/provider.js";

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

  async syncProver(
    startPeriod: number,
    currentPeriod: number,
    startCommittee: Uint8Array[]
  ): Promise<{ syncCommittee: Uint8Array[]; period: number }> {
    for (let period = startPeriod; period < currentPeriod; period += 1) {
      try {
        const update = await this.prover.getSyncUpdate(
          period,
          currentPeriod,
          DEFAULT_BATCH_SIZE
        );
        const validOrCommittee = await this.syncUpdateVerifyGetCommittee(
          startCommittee,
          period,
          update
        );

        if (!(validOrCommittee as boolean)) {
          console.log(`Found invalid update at period(${period})`);
          return {
            syncCommittee: startCommittee,
            period,
          };
        }
        startCommittee = validOrCommittee as Uint8Array[];
      } catch (e) {
        console.error(`failed to fetch sync update for period(${period})`);
        return {
          syncCommittee: startCommittee,
          period,
        };
      }
    }
    return {
      syncCommittee: startCommittee,
      period: currentPeriod,
    };
  }

  // returns the prover info containing the current sync

  public getCurrentPeriod(): number {
    return computeSyncPeriodAtSlot(
      getCurrentSlot(this.config.chainConfig, this.genesisTime)
    );
  }

  public async subscribe(callback: (ei: ExecutionInfo) => AsyncOrSync<void>) {
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

  optimisticUpdateFromJSON(update: any): OptimisticUpdate {
    return altair.ssz.LightClientOptimisticUpdate.fromJson(update);
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

  protected async _sync() {
    const currentPeriod = this.getCurrentPeriod();
    if (currentPeriod > this.latestPeriod) {
      this.latestCommittee = await this.syncFromGenesis();
      this.latestPeriod = currentPeriod;
    }
  }

  // committee and prover index of the first honest prover
  protected async syncFromGenesis(): Promise<Uint8Array[]> {
    // get the tree size by currentPeriod - genesisPeriod
    const currentPeriod = this.getCurrentPeriod();
    let startPeriod = this.genesisPeriod;
    let startCommittee = this.genesisCommittee;
    console.log(
      `Sync started from period(${startPeriod}) to period(${currentPeriod})`
    );

    const { syncCommittee, period } = await this.syncProver(
      startPeriod,
      currentPeriod,
      startCommittee
    );
    if (period === currentPeriod) {
      return syncCommittee;
    }
    throw new Error("no honest prover found");
  }

  protected async syncUpdateVerifyGetCommittee(
    prevCommittee: Uint8Array[],
    period: number,
    update: LightClientUpdate
  ): Promise<false | Uint8Array[]> {
    const updatePeriod = computeSyncPeriodAtSlot(
      update.attestedHeader.beacon.slot
    );
    if (period !== updatePeriod) {
      console.error(
        `Expected update with period ${period}, but recieved ${updatePeriod}`
      );
      return false;
    }

    const prevCommitteeFast = this.deserializeSyncCommittee(prevCommittee);
    try {
      // check if the update has valid signatures
      await assertValidLightClientUpdate(
        this.config.chainConfig,
        prevCommitteeFast,
        update
      );
      return update.nextSyncCommittee.pubkeys;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  protected async getLatestExecution(): Promise<ExecutionInfo | null> {
    const updateJSON = await this.prover.callback(
      "/eth/v1/beacon/light_client/optimistic_update"
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

  protected async getExecutionFromBlockRoot(
    slot: bigint,
    expectedBlockRoot: Bytes32
  ): Promise<ExecutionInfo> {
    const res = await this.prover.callback(`/eth/v2/beacon/blocks/${slot}`);
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
}
