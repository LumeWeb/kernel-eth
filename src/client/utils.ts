import { fromHexString, toHexString } from "@chainsafe/ssz";
import bls from "@chainsafe/bls/switchable";
import { createBeaconConfig } from "@lodestar/config";
import { mainnetConfig } from "./constants.js";
import { networksChainConfig } from "@lodestar/config/networks";

export function concatUint8Array(data: Uint8Array[]) {
  const l = data.reduce((l, d) => l + d.length, 0);
  let result = new Uint8Array(l);
  let offset = 0;
  data.forEach((d) => {
    result.set(d, offset);
    offset += d.length;
  });
  return result;
}

export function isUint8ArrayEq(a: Uint8Array, b: Uint8Array): boolean {
  return toHexString(a) === toHexString(b);
}

export function isCommitteeSame(a: Uint8Array[], b: Uint8Array[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => isUint8ArrayEq(c, b[i]));
}

export function generateRandomSyncCommittee(): Uint8Array[] {
  let res: Uint8Array[] = [];
  // TODO: change 512 to constant
  for (let i = 0; i < 512; i++) {
    res.push(bls.SecretKey.fromKeygen().toPublicKey().toBytes());
  }
  return res;
}

export function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export const smallHexStr = (data: Uint8Array) => toHexString(data).slice(0, 8);

export function numberToUint8Array(num: number): Uint8Array {
  const rawHex = num.toString(16);
  const hex = "0x" + (rawHex.length % 2 === 0 ? rawHex : "0" + rawHex);
  return fromHexString(hex);
}

// credit: https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
export function shuffle(array: any[]) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

export async function wait(ms: number) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}

export function getDefaultClientConfig() {
  const chainConfig = createBeaconConfig(
    networksChainConfig.mainnet,
    fromHexString(mainnetConfig.genesis_validator_root),
  );
  return {
    genesis: {
      committee: mainnetConfig.committee_pk,
      slot: parseInt(mainnetConfig.slot),
      time: parseInt(mainnetConfig.genesis_time),
    },
    chainConfig,
    n: 1,
  };
}
