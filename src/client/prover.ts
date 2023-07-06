import * as altair from "@lodestar/types/altair";
import { IProver } from "./interfaces.js";
import { LightClientUpdate } from "./types.js";
import { CommitteeSSZ, HashesSSZ, LightClientUpdateSSZ } from "./ssz.js";

export default class Prover implements IProver {
  cachedHashes: Map<number, Uint8Array> = new Map();

  constructor(callback: Function) {
    this._callback = callback;
  }

  private _callback: Function;

  get callback(): Function {
    return this._callback;
  }

  async getCommittee(period: number | "latest"): Promise<Uint8Array[]> {
    const res = await this.callback("consensus_committee_period", { period });
    return CommitteeSSZ.deserialize(Uint8Array.from(Object.values(res)));
  }

  async getSyncUpdate(period: number): Promise<LightClientUpdate> {
    const res = await this.callback("consensus_committee_period", { period });
    return LightClientUpdateSSZ.deserialize(
      Uint8Array.from(Object.values(res)),
    );
  }

  async _getHashes(startPeriod: number, count: number): Promise<Uint8Array[]> {
    const res = await this.callback("consensus_committee_hashes", {
      start: startPeriod,
      count,
    });
    return HashesSSZ.deserialize(Uint8Array.from(Object.values(res)));
  }

  async getCommitteeHash(
    period: number,
    currentPeriod: number,
    cacheCount: number,
  ): Promise<Uint8Array> {
    const _count = Math.min(currentPeriod - period + 1, cacheCount);
    if (!this.cachedHashes.has(period)) {
      const vals = await this._getHashes(period, _count);
      for (let i = 0; i < _count; i++) {
        this.cachedHashes.set(period + i, vals[i]);
      }
    }
    return this.cachedHashes.get(period)!;
  }
}
