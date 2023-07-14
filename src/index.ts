import {
  ActiveQuery,
  addHandler,
  handleMessage,
  logErr,
} from "@lumeweb/libkernel/module";
import { createClient, RpcNetwork } from "@lumeweb/kernel-rpc-client";
import {
  Client as EthClient,
  ConsensusCommitteeUpdateRequest,
  createDefaultClient as createEthClient,
} from "@lumeweb/libethsync/client";
import * as capella from "@lodestar/types/capella";

onmessage = handleMessage;

let moduleReadyResolve: Function;
let moduleReady: Promise<void> = new Promise((resolve) => {
  moduleReadyResolve = resolve;
});

let client: EthClient;
let rpc: RpcNetwork;

addHandler("presentKey", handlePresentKey);
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

async function handlePresentKey() {
  await setup();
  moduleReadyResolve();
}

async function handleRpcMethod(aq: ActiveQuery) {
  await moduleReady;
  if (!client.isSynced) {
    await client.sync();
  }
  return client.rpcCall(aq.callerInput?.method, aq.callerInput?.params);
}

async function consensusHandler(method: string, data: any) {
  await rpc.ready;

  while (true) {
    let query = await rpc.simpleQuery({
      query: {
        module: "eth",
        method,
        data,
      },
      options: {
        relayTimeout: 30,
        queryTimeout: 30,
      },
    });

    const ret = await query.result;

    if (ret.data) {
      return ret.data;
    }
  }
}

async function executionHandler(data: Map<string, string | any>) {
  await rpc.ready;
  while (true) {
    let query = await rpc.simpleQuery({
      query: {
        module: "eth",
        method: "execution_request",
        data,
      },
      options: {
        relayTimeout: 30,
        queryTimeout: 30,
      },
    });

    let ret = await query.result;

    if (ret.data) {
      return ret.data;
    }
  }
}

async function setup() {
  rpc = createClient();
  await rpc.ready;

  client = createEthClient(
    async (args: ConsensusCommitteeUpdateRequest) => {
      const updates = await consensusHandler("consensus_updates", args);

      return updates
        .map((u) => new Uint8Array(Object.values(u)))
        .map((u) => capella.ssz.LightClientUpdate.deserialize(u))
        .map((u) => capella.ssz.LightClientUpdate.toJson(u));
    },
    executionHandler,
    async () => {
      const update = await consensusHandler("consensus_optimistic_update", {});

      return capella.ssz.LightClientOptimisticUpdate.deserialize(
        new Uint8Array(Object.values(update)),
      );
    },
  );

  let synced = false;

  while (!synced) {
    try {
      await client.sync();
      synced = true;
    } catch (e) {
      logErr(e.message);
    }
  }
}

async function handleReady(aq: ActiveQuery) {
  await moduleReady;

  aq.respond();
}
