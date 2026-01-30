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
    description: 'Ascolta connessioni, disconnessioni e messaggi da client WebSocket',
    defaults: { name: 'WebSocket Server' },
    inputs: [] as unknown as INodeTypeDescription['inputs'],
    outputs: [
      { type: NodeConnectionTypes.Main, displayName: 'Connection' },
      { type: NodeConnectionTypes.Main, displayName: 'Disconnection' },
      { type: NodeConnectionTypes.Main, displayName: 'Message' },
    ],
    triggerPanel: {
      header: 'Server WebSocket',
      executionsHelp: {
        inactive:
          'Attiva il workflow per far ascoltare il server. Uscite: Connessione, Disconnessione, Messaggio.',
        active:
          'Il server è in ascolto. Collega le tre uscite (Connessione / Disconnessione / Messaggio) ai nodi successivi.',
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
      {
        displayName: 'Host',
        name: 'host',
        type: 'string',
        default: '0.0.0.0',
        placeholder: '0.0.0.0',
        description: 'Indirizzo su cui ascoltare. 0.0.0.0 = tutte le interfacce, 127.0.0.1 = solo localhost.',
      },
      {
        displayName: 'Max Payload (Bytes)',
        name: 'maxPayload',
        type: 'number',
        default: 10485760,
        description: 'Dimensione massima di un singolo messaggio in bytes (default 10 MB). Messaggi più grandi vengono rifiutati.',
      },
      {
        displayName: 'Allowed Origins',
        name: 'allowedOrigins',
        type: 'string',
        default: '',
        placeholder: 'https://example.com, https://app.example.com',
        description:
          'Origini consentite (separate da virgola). Se vuoto, tutte le origini sono accettate. Utile per connessioni da browser.',
      },
      {
        displayName: 'Per-Message Deflate',
        name: 'perMessageDeflate',
        type: 'boolean',
        default: false,
        description: 'Whether to enable compression (permessage-deflate). Aumenta uso memoria/CPU.',
      },
      {
        displayName: 'Welcome Message',
        name: 'welcomeMessage',
        type: 'string',
        default: '',
        placeholder: '{"type":"welcome","message":"Connected"}',
        description: 'Messaggio inviato al client appena si connette. Lasciare vuoto per non inviare nulla.',
      },
    ],
		usableAsTool: true,
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const port = this.getNodeParameter('port', 0) as number;
    const path = (this.getNodeParameter('path', 0) as string) || '/';
    const host = (this.getNodeParameter('host', 0) as string) || undefined;
    const maxPayload = (this.getNodeParameter('maxPayload', 0) as number) || 10485760;
    const allowedOriginsRaw = (this.getNodeParameter('allowedOrigins', 0) as string) || '';
    const perMessageDeflate = (this.getNodeParameter('perMessageDeflate', 0) as boolean) ?? false;
    const welcomeMessage = (this.getNodeParameter('welcomeMessage', 0) as string) || '';

    const allowedOrigins = allowedOriginsRaw
      ? allowedOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
      : null;

    const node = this.getNode();
    const workflowId = (this.getWorkflow()?.id ?? '') as string;
    const key = getNodeKey(node.id, workflowId);
    const emit = this.emit.bind(this);

    const startConsumer = async () => {
      let server = serverStore.get(key);
      if (server) return;

      const serverOptions: {
        port: number;
        path?: string;
        host?: string;
        maxPayload: number;
        perMessageDeflate: boolean;
        verifyClient?: (info: { origin?: string }, callback: (verified: boolean) => void) => void;
      } = {
        port,
        path: path || undefined,
        host: host || undefined,
        maxPayload,
        perMessageDeflate,
      };

      if (allowedOrigins && allowedOrigins.length > 0) {
        serverOptions.verifyClient = (info: { origin?: string }, callback: (verified: boolean) => void) => {
          const origin = info.origin ?? '';
          const allowed = allowedOrigins.some((o) => origin === o || origin === o + '/');
          callback(allowed);
        };
      }

      server = new WSServer(serverOptions as ConstructorParameters<typeof WSServer>[0]);

      server.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const remoteAddress = req.socket.remoteAddress ?? '';

        (ws as WebSocket & { _remoteAddress?: string })._remoteAddress = remoteAddress;

        // Uscita 1: Connessione client
        emit([
          [
            {
              json: {
                event: 'connection',
                remoteAddress,
                url: req.url,
                headers: req.headers as Record<string, string>,
              },
            },
          ],
          [],
          [],
        ]);

        // Messaggio di welcome (se configurato)
        if (welcomeMessage.trim()) {
          try {
            ws.send(welcomeMessage.trim());
          } catch {
            /* ignore send errors */
          }
        }

        // Uscita 3: Messaggio ricevuto
        ws.on('message', (raw: Buffer | string) => {
          let data: Record<string, unknown>;
          try {
            const s = raw.toString();
            data = JSON.parse(s) as Record<string, unknown>;
          } catch {
            data = { raw: raw.toString(), body: raw.toString() };
          }
          emit([
            [],
            [],
            [
              {
                json: {
                  event: 'message',
                  ...data,
                  _meta: { from: remoteAddress },
                },
              },
            ],
          ]);
        });

        // Uscita 2: Disconnessione client
        ws.on('close', () => {
          const addr = (ws as WebSocket & { _remoteAddress?: string })._remoteAddress ?? remoteAddress;
          emit([
            [],
            [
              {
                json: {
                  event: 'disconnection',
                  remoteAddress: addr,
                },
              },
            ],
            [],
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
