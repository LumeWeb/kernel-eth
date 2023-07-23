import {
  ActiveQuery,
  addHandler,
  handleMessage,
  log,
  logErr,
} from "@lumeweb/libkernel/module";
import {
  createClient as createRpcClient,
  RpcNetwork,
} from "@lumeweb/kernel-rpc-client";
import { createClient as createNetworkRegistryClient } from "@lumeweb/kernel-network-registry-client";
import {
  Client as EthClient,
  ConsensusCommitteeUpdateRequest,
  createDefaultClient as createEthClient,
} from "@lumeweb/libethsync/client";
import * as capella from "@lodestar/types/capella";
import defer from "p-defer";

onmessage = handleMessage;

const TYPES = ["blockchain"];
const networkRegistry = createNetworkRegistryClient();

const moduleReadyDefer = defer();
const clientInitDefer = defer();

let client: EthClient;
let rpc: RpcNetwork;

addHandler("presentKey", handlePresentKey);
addHandler("register", handleRegister);
addHandler("status", handleStatus, { receiveUpdates: true });
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
  moduleReadyDefer.resolve();
}

async function handleRpcMethod(aq: ActiveQuery) {
  await moduleReadyDefer.promise;
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
  rpc = createRpcClient();
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
    log,
    logErr,
    500,
  );

  clientInitDefer.resolve();

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
  await moduleReadyDefer.promise;

  aq.respond();
}

async function handleRegister(aq: ActiveQuery) {
  await networkRegistry.registerNetwork(TYPES);

  aq.respond();
}

async function handleStatus(aq: ActiveQuery) {
  await clientInitDefer.promise;
  let chainProgress = 0;

  const chainProgressListener = (currentUpdate, totalUpdates) => {
    chainProgress = Math.round((currentUpdate / totalUpdates) * 100) / 100;
    sendUpdate();
  };

  const chainSyncedListener = () => {
    sendUpdate();
  };

  client.on("update", chainProgressListener);
  client.on("synced", chainSyncedListener);

  function sendUpdate() {
    aq.sendUpdate({
      sync: Math.floor(chainProgress * 100),
      peers: 1,
      ready: client.isSynced,
    });
  }

  aq.setReceiveUpdate?.(() => {
    client.off("update", chainProgressListener);
    client.off("synced", chainSyncedListener);
    aq.respond();
  });

  sendUpdate();
}
