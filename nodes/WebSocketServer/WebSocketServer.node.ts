import type { IncomingMessage } from 'http';
import type {
  ITriggerFunctions,
  ITriggerResponse,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import type { WebSocket } from 'ws';
import { WebSocketServer as WSServer } from 'ws';

const serverStore = new Map<string, WSServer>();

function getNodeKey(nodeId: string, workflowId: string): string {
  return `${workflowId}:${nodeId}`;
}

export class WebSocketServer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WebSocket Server',
    name: 'webSocketServer',
    icon: 'file:webSocketServer.svg',
    group: ['trigger'],
    version: 1,
    description: 'Ascolta messaggi in entrata su un server WebSocket',
    defaults: { name: 'WebSocket Server' },
    inputs: [] as unknown as INodeTypeDescription['inputs'],
    outputs: [NodeConnectionTypes.Main],
    triggerPanel: {
      header: 'Server WebSocket',
      executionsHelp: {
        inactive:
          'Attiva il workflow per far ascoltare il server sulla porta configurata. I messaggi ricevuti avviano le esecuzioni.',
        active:
          'Il server è in ascolto. I messaggi ricevuti dai client avviano le esecuzioni.',
      },
      activationHint:
        'Attiva il workflow per avviare il server WebSocket sulla porta indicata.',
    },
    properties: [
      {
        displayName: 'Porta',
        name: 'port',
        type: 'number',
        default: 3456,
        description: 'Porta TCP su cui ascoltare',
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '/',
        placeholder: '/',
        description: 'Path (opzionale, per sotto-path)',
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const port = this.getNodeParameter('port', 0) as number;
    const path = (this.getNodeParameter('path', 0) as string) || '/';

    const node = this.getNode();
    const workflowId = (this.getWorkflow()?.id ?? '') as string;
    const key = getNodeKey(node.id, workflowId);
    const emit = this.emit.bind(this);

    const startConsumer = async () => {
      let server = serverStore.get(key);
      if (server) return;

      server = new WSServer({ port, path: path || undefined });

      server.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        ws.on('message', (raw: Buffer | string) => {
          let data: Record<string, unknown>;
          try {
            const s = raw.toString();
            data = JSON.parse(s) as Record<string, unknown>;
          } catch {
            data = { raw: raw.toString(), body: raw.toString() };
          }
          emit([
            [
              {
                json: {
                  ...data,
                  _meta: { from: req.socket.remoteAddress },
                },
              },
            ],
          ]);
        });
      });

      server.on('error', (err: Error) => {
        // Log solo in sviluppo; in produzione si può lasciare silenzioso
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.error('[WebSocket Server]', err);
        }
      });

      serverStore.set(key, server);
    };

    const closeFunction = async () => {
      const server = serverStore.get(key);
      if (server) {
        try {
          server.close();
        } catch {
          /* ignore */
        }
        serverStore.delete(key);
      }
    };

    const manualTriggerFunction = async () => {
      await startConsumer();
    };

    return {
      closeFunction,
      manualTriggerFunction,
    };
  }
}
