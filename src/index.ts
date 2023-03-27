import { ActiveQuery, addHandler, handleMessage } from "libkmodule";
import { createClient, RpcNetwork } from "@lumeweb/kernel-rpc-client";
import init, { Client } from "../wasm/helios_ts.js";
// @ts-ignore
import wasm from "../wasm/helios_ts_bg.wasm?base64";
import { Buffer } from "buffer";
import { RPCResponse } from "@lumeweb/interface-relay";
import { ConsensusRequest, ExecutionRequest } from "./types.js";

const CHECKPOINT =
  "0x694433ba78dd08280df68d3713c0f79d668dbee9e0922ec2346fcceb1dc3daa9";

onmessage = handleMessage;

let moduleReadyResolve: Function;
let moduleReady: Promise<void> = new Promise((resolve) => {
  moduleReadyResolve = resolve;
});

let client: Client;
let rpc: RpcNetwork;

addHandler("presentSeed", handlePresentSeed);
addHandler("ready", handleReady);

[
  "eth_accounts",
  "eth_requestAccounts",
  "eth_getBalance",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getCode",
  "eth_call",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_sendRawTransaction",
  "eth_getTransactionReceipt",
  "eth_getLogs",
  "net_version",
].forEach((rpcMethod) => {
  addHandler(rpcMethod, async (aq: ActiveQuery) => {
    aq.callerInput = {
      params: aq.callerInput || {},
      method: rpcMethod,
    };
    aq.respond(await handleRpcMethod(aq));
  });
});

async function handlePresentSeed() {
  await setup();
  moduleReadyResolve();
}

async function handleRpcMethod(aq: ActiveQuery) {
  await moduleReady;
  switch (aq.callerInput?.method) {
    case "eth_accounts":
    case "eth_requestAccounts": {
      return [];
    }
    case "eth_getBalance": {
      return client.get_balance(
        aq.callerInput?.params[0],
        aq.callerInput?.params[1]
      );
    }
    case "eth_chainId": {
      return client.chain_id();
    }
    case "eth_blockNumber": {
      return client.get_block_number();
    }
    case "eth_getTransactionByHash": {
      let tx = await client.get_transaction_by_hash(aq.callerInput?.params[0]);
      return mapToObj(tx);
    }
    case "eth_getTransactionCount": {
      return client.get_transaction_count(
        aq.callerInput?.params[0],
        aq.callerInput?.params[1]
      );
    }
    case "eth_getBlockTransactionCountByHash": {
      return client.get_block_transaction_count_by_hash(
        aq.callerInput?.params[0]
      );
    }
    case "eth_getBlockTransactionCountByNumber": {
      return client.get_block_transaction_count_by_number(
        aq.callerInput?.params[0]
      );
    }
    case "eth_getCode": {
      return client.get_code(
        aq.callerInput?.params[0],
        aq.callerInput?.params[1]
      );
    }
    case "eth_call": {
      return client.call(aq.callerInput?.params[0], aq.callerInput?.params[1]);
    }
    case "eth_estimateGas": {
      return client.estimate_gas(aq.callerInput?.params[0]);
    }
    case "eth_gasPrice": {
      return client.gas_price();
    }
    case "eth_maxPriorityFeePerGas": {
      return client.max_priority_fee_per_gas();
    }
    case "eth_sendRawTransaction": {
      return client.send_raw_transaction(aq.callerInput?.params[0]);
    }
    case "eth_getTransactionReceipt": {
      return client.get_transaction_receipt(aq.callerInput?.params[0]);
    }
    case "eth_getLogs": {
      return client.get_logs(aq.callerInput?.params[0]);
    }
    case "net_version": {
      return client.chain_id();
    }
  }
}

async function setup() {
  rpc = createClient();

  // @ts-ignore
  await (
    await rpc.ready
  )();

  await init(URL.createObjectURL(new Blob([Buffer.from(wasm, "base64")])));

  (self as any).consensus_rpc_handler = async (
    data: Map<string, string | any>
  ) => {
    const method = data.get("method");
    const path = data.get("path");

    let query;
    let ret: RPCResponse;

    while (true) {
      query = await rpc.simpleQuery({
        query: {
          module: "eth",
          method: "consensus_request",
          data: {
            method,
            path,
          } as ConsensusRequest,
        },
        options: {
          relayTimeout: 10,
          queryTimeout: 10,
        },
      });

      ret = await query.result;
      if (ret?.data) {
        break;
      }
    }

    if (path.startsWith("/eth/v1/beacon/light_client/updates")) {
      return JSON.stringify(ret.data);
    }

    return JSON.stringify({ data: ret.data });
  };
  (self as any).execution_rpc_handler = async (
    data: Map<string, string | any>
  ) => {
    const method = data.get("method");
    let params = data.get("params");

    params = JSON.parse(params);

    let query;
    let ret: RPCResponse;

    while (true) {
      query = await rpc.simpleQuery({
        query: {
          module: "eth",
          method: "execution_request",
          data: {
            method,
            params,
          } as ExecutionRequest,
        },
      });
      ret = await query.result;

      if (ret?.data) {
        break;
      }
    }

    return JSON.stringify(ret.data);
  };

  client = new Client(CHECKPOINT);
  await client.sync();
}

async function handleReady(aq:ActiveQuery){
    await moduleReady;

    aq.respond();
}

function mapToObj(map: Map<any, any> | undefined): Object | undefined {
  if (!map) return undefined;

  return Array.from(map).reduce((obj: any, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});
}
