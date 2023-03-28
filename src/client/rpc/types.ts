import type { GetProof } from "web3-eth";
import type { BlockNumber } from "web3-core";
import type { Method } from "web3-core-method";
import type { JsonTx } from "@ethereumjs/tx";
export type { GetProof, BlockNumber, Method };

export type Bytes = string;
export type Bytes32 = string;
export type AddressHex = string;
export type ChainId = number;
export type HexString = string;

// Some of the types below are taken from:
// https://github.com/ethereumjs/ethereumjs-monorepo/blob/master/packages/client/lib/rpc/modules/eth.ts

export type AccessList = { address: AddressHex; storageKeys: Bytes32[] }[];

export interface RPCTx {
  from?: string;
  to?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  accessList?: AccessList;
  value?: string;
  data?: string;
}

export type AccountResponse = GetProof;
export type CodeResponse = string;

export type JSONRPCReceipt = {
  transactionHash: string; // DATA, 32 Bytes - hash of the transaction.
  transactionIndex: string; // QUANTITY - integer of the transactions index position in the block.
  blockHash: string; // DATA, 32 Bytes - hash of the block where this transaction was in.
  blockNumber: string; // QUANTITY - block number where this transaction was in.
  from: string; // DATA, 20 Bytes - address of the sender.
  to: string | null; // DATA, 20 Bytes - address of the receiver. null when it's a contract creation transaction.
  cumulativeGasUsed: string; // QUANTITY  - The total amount of gas used when this transaction was executed in the block.
  effectiveGasPrice: string; // QUANTITY - The final gas price per gas paid by the sender in wei.
  gasUsed: string; // QUANTITY - The amount of gas used by this specific transaction alone.
  contractAddress: string | null; // DATA, 20 Bytes - The contract address created, if the transaction was a contract creation, otherwise null.
  logs: JSONRPCLog[]; // Array - Array of log objects, which this transaction generated.
  logsBloom: string; // DATA, 256 Bytes - Bloom filter for light clients to quickly retrieve related logs.
  // It also returns either:
  root?: string; // DATA, 32 bytes of post-transaction stateroot (pre Byzantium)
  status?: string; // QUANTITY, either 1 (success) or 0 (failure)
};

export type JSONRPCLog = {
  removed: boolean; // TAG - true when the log was removed, due to a chain reorganization. false if it's a valid log.
  logIndex: string | null; // QUANTITY - integer of the log index position in the block. null when it's pending.
  transactionIndex: string | null; // QUANTITY - integer of the transactions index position log was created from. null when it's pending.
  transactionHash: string | null; // DATA, 32 Bytes - hash of the transactions this log was created from. null when it's pending.
  blockHash: string | null; // DATA, 32 Bytes - hash of the block where this log was in. null when it's pending.
  blockNumber: string | null; // QUANTITY - the block number where this log was in. null when it's pending.
  address: string; // DATA, 20 Bytes - address from which this log originated.
  data: string; // DATA - contains one or more 32 Bytes non-indexed arguments of the log.
  topics: string[]; // Array of DATA - Array of 0 to 4 32 Bytes DATA of indexed log arguments.
  // (In solidity: The first topic is the hash of the signature of the event
  // (e.g. Deposit(address,bytes32,uint256)), except you declared the event with the anonymous specifier.)
};
