export interface ConsensusRequest extends RequestInit {
  path: string;
}

export interface ExecutionRequest {
  method: string;
  params: string;
}
