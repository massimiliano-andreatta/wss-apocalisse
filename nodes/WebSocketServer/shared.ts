import type { WebSocket, WebSocketServer as WSServerType  } from 'ws';

export const serverStore = new Map<string, WSServerType>();
export const clientsStore = new Map<string, Map<string, WebSocket>>();

/** Mappa (workflowId:nodeName) → nodeId per risolvere il nome del nodo Server nel nodo Send. */
export const serverNodeNameToId = new Map<string, string>();

export function getNodeKey(nodeId: string, workflowId: string): string {
  return `${workflowId}:${nodeId}`;
}

export function getServerNodeId(workflowId: string, nodeName: string): string | undefined {
  return serverNodeNameToId.get(`${workflowId}:${(nodeName ?? '').trim()}`);
}

export function getClients(key: string): Map<string, WebSocket> | undefined {
  return clientsStore.get(key);
}

export function ensureClientsMap(key: string): Map<string, WebSocket> {
  let map = clientsStore.get(key);
  if (!map) {
    map = new Map();
    clientsStore.set(key, map);
  }
  return map;
}
