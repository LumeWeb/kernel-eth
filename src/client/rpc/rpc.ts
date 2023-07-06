export type RPCRequest = {
  method: string;
  params: any[];
};

export type RPCRequestRaw = RPCRequest & {
  jsonrpc: string;
  id: string;
};

export type RPCResponse = {
  success: boolean;
  result: any;
};

export class RPC {
  private callback: Function;

  constructor(callback: Function) {
    this.callback = callback;
  }

  async request(request: RPCRequest) {
    return await this._retryRequest(request);
  }

  async requestBatch(requests: RPCRequest[]) {
    const res: RPCResponse[] = [];
    for (const request of requests) {
      const r = await this._retryRequest(request);
      res.push(r);
    }
    return res;
  }

  private async _retryRequest(
    _request: RPCRequest,
    retry = 5,
  ): Promise<RPCResponse> {
    const request = {
      ..._request,
      jsonrpc: "2.0",
      id: this.generateId(),
    };

    for (let i = retry; i > 0; i--) {
      const res = await this._request(request);
      if (res.success) {
        return res;
      } else if (i == 1) {
        console.error(
          `RPC batch request failed after maximum retries: ${JSON.stringify(
            request,
            null,
            2,
          )} ${JSON.stringify(res, null, 2)}`,
        );
      }
    }
    throw new Error("RPC request failed");
  }

  private generateId(): string {
    return Math.floor(Math.random() * 2 ** 64).toFixed();
  }

  protected async _request(request: RPCRequestRaw): Promise<RPCResponse> {
    try {
      const response = await this.callback(request);
      return {
        success: !response.error,
        result: response.error || response.result,
      };
    } catch (e) {
      return {
        success: false,
        result: { message: `request failed: ${e}` },
      };
    }
  }
}
