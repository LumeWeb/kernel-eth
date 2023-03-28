import * as altair from "@lodestar/types/altair";
import { IProver } from "./interfaces.js";
import { LightClientUpdate } from "./types.js";

export default class Prover implements IProver {
  cachedSyncUpdate: Map<number, LightClientUpdate> = new Map();

  constructor(callback: Function) {
    this._callback = callback;
  }

  private _callback: Function;

  get callback(): Function {
    return this._callback;
  }

  async _getSyncUpdates(
    startPeriod: number,
    maxCount: number
  ): Promise<LightClientUpdate[]> {
    const res = await this._callback(
      `/eth/v1/beacon/light_client/updates?start_period=${startPeriod}&count=${maxCount}`
    );
    return res.map((u: any) => altair.ssz.LightClientUpdate.fromJson(u.data));
  }

  async getSyncUpdate(
    period: number,
    currentPeriod: number,
    cacheCount: number
  ): Promise<LightClientUpdate> {
    const _cacheCount = Math.min(currentPeriod - period + 1, cacheCount);
    if (!this.cachedSyncUpdate.has(period)) {
      const vals = await this._getSyncUpdates(period, _cacheCount);
      for (let i = 0; i < _cacheCount; i++) {
        this.cachedSyncUpdate.set(period + i, vals[i]);
      }
    }
    return this.cachedSyncUpdate.get(period)!;
  }
}
