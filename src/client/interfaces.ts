import { LightClientUpdate } from "./types.js";

export interface IProver {
  get callback(): Function;

  getCommittee(period: number | "latest"): Promise<Uint8Array[]>;

  getCommitteeHash(
    period: number,
    currentPeriod: number,
    count: number,
  ): Promise<Uint8Array>;

  getSyncUpdate(period: number): Promise<LightClientUpdate>;
}
