import {
  setLengthLeft,
  toBuffer,
  bigIntToHex,
  bufferToHex,
  intToHex,
} from "@ethereumjs/util";
import { HeaderData, BlockData, Block } from "@ethereumjs/block";
import {
  TxData,
  AccessListEIP2930TxData,
  FeeMarketEIP1559TxData,
  TypedTransaction,
} from "@ethereumjs/tx";

const isTruthy = (val: any) => !!val;

// TODO: fix blockInfo type
export function headerDataFromWeb3Response(blockInfo: any): HeaderData {
  return {
    parentHash: blockInfo.parentHash,
    uncleHash: blockInfo.sha3Uncles,
    coinbase: blockInfo.miner,
    stateRoot: blockInfo.stateRoot,
    transactionsTrie: blockInfo.transactionsRoot,
    receiptTrie: blockInfo.receiptsRoot,
    logsBloom: blockInfo.logsBloom,
    difficulty: BigInt(blockInfo.difficulty),
    number: BigInt(blockInfo.number),
    gasLimit: BigInt(blockInfo.gasLimit),
    gasUsed: BigInt(blockInfo.gasUsed),
    timestamp: BigInt(blockInfo.timestamp),
    extraData: blockInfo.extraData,
    mixHash: (blockInfo as any).mixHash, // some reason the types are not up to date :(
    nonce: blockInfo.nonce,
    baseFeePerGas: blockInfo.baseFeePerGas
      ? BigInt(blockInfo.baseFeePerGas)
      : undefined,
  };
}

export function txDataFromWeb3Response(
  txInfo: any,
): TxData | AccessListEIP2930TxData | FeeMarketEIP1559TxData {
  return {
    ...txInfo,
    data: txInfo.input,
    gasPrice: BigInt(txInfo.gasPrice),
    gasLimit: txInfo.gas,
    to: isTruthy(txInfo.to)
      ? setLengthLeft(toBuffer(txInfo.to), 20)
      : undefined,
    value: BigInt(txInfo.value),
    maxFeePerGas: isTruthy(txInfo.maxFeePerGas)
      ? BigInt(txInfo.maxFeePerGas)
      : undefined,
    maxPriorityFeePerGas: isTruthy(txInfo.maxPriorityFeePerGas)
      ? BigInt(txInfo.maxPriorityFeePerGas)
      : undefined,
  };
}

export function blockDataFromWeb3Response(blockInfo: any): BlockData {
  return {
    header: headerDataFromWeb3Response(blockInfo),
    transactions: blockInfo.transactions.map(txDataFromWeb3Response),
  };
}
