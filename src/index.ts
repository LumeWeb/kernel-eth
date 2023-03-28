import { ActiveQuery, addHandler, handleMessage } from "libkmodule";
import { createClient, RpcNetwork } from "@lumeweb/kernel-rpc-client";
import { ConsensusRequest, ExecutionRequest } from "./types.js";
import Client from "./client/client.js";
import { Prover } from "./client/index.js";

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
    try {
      const ret = await handleRpcMethod(aq);
      aq.respond(ret);
    } catch (e: any) {
      aq.reject((e as Error).message);
    }
  });
});

async function handlePresentSeed() {
  await setup();
  moduleReadyResolve();
}

async function handleRpcMethod(aq: ActiveQuery) {
  await moduleReady;
  return client.provider.rpcMethod(
    aq.callerInput?.method,
    // @ts-ignore
    aq.callerInput?.params as any[]
  );
}

async function consensusHandler(endpoint: string) {
  let query;

  while (true) {
    query = await rpc.simpleQuery({
      query: {
        module: "eth",
        method: "consensus_request",
        data: {
          method: "GET",
          path: endpoint,
        } as ConsensusRequest,
      },
      options: {
        relayTimeout: 10,
        queryTimeout: 10,
      },
    });
    console.log("consensusHandler", endpoint);

    const ret = await query.result;
    if (ret.data) {
      return ret.data;
    }
  }
}

async function executionHandler(data: Map<string, string | any>) {
  let query = await rpc.simpleQuery({
    query: {
      module: "eth",
      method: "execution_request",
      data,
    },
  });

  console.log("executionHandler", data);

  let ret = await query.result;

  return ret.data;
}

async function setup() {
  console.time("setup");
  rpc = createClient();
  // @ts-ignore
  await (
    await rpc.ready
  )();

  const prover = new Prover(consensusHandler);
  client = new Client(prover, executionHandler);
  await client.sync();
}

async function handleReady(aq: ActiveQuery) {
  await moduleReady;

  aq.respond();
}
