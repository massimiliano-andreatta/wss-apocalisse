import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import WebSocket from 'ws';

export class WebSocketClient implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WebSocket Client',
    name: 'webSocketClient',
    icon: 'file:webSocketClient.svg',
    group: ['transform'],
    version: 1,
    description: 'Si connette a un server WebSocket e invia/riceve messaggi',
    defaults: { name: 'WebSocket Client' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    properties: [
      {
        displayName: 'URL WebSocket',
        name: 'url',
        type: 'string',
        default: 'ws://localhost:3456/',
        placeholder: 'ws://localhost:3456/',
        description: 'URL del server WebSocket (ws:// o wss://)',
        required: true,
      },
      {
        displayName: 'Operazione',
        name: 'operation',
        type: 'options',
								noDataExpression: true,
        options: [
          { name: 'Invia Messaggio', value: 'send' },
          { name: 'Invia E Attendi Risposta', value: 'sendAndReceive' },
        ],
        default: 'send',
        description: 'Azione da eseguire',
      },
      {
        displayName: 'Messaggio',
        name: 'message',
        type: 'string',
        default: '',
        placeholder: '{"type":"ping"}',
        description: 'Contenuto da inviare (testo o JSON)',
        displayOptions: { show: { operation: ['send', 'sendAndReceive'] } },
      },
      {
        displayName: 'Usa Dato in Input',
        name: 'useInput',
        type: 'boolean',
        default: false,
        description: 'Whether to send the input item JSON as the message',
        displayOptions: { show: { operation: ['send', 'sendAndReceive'] } },
      },
      {
        displayName: 'Timeout Risposta (Ms)',
        name: 'timeout',
        type: 'number',
        default: 5000,
        description: 'Attesa massima per la prima risposta (solo per “Invia e attendi risposta”)',
        displayOptions: { show: { operation: ['sendAndReceive'] } },
      },
    ],
		usableAsTool: true,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const url = this.getNodeParameter('url', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;
    const useInput = this.getNodeParameter('useInput', 0) as boolean;
    const timeout = (this.getNodeParameter('timeout', 0) as number) || 5000;

    const results: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      let payload: string;
      if (useInput) {
        payload = JSON.stringify(items[i].json);
      } else {
        const msg = this.getNodeParameter('message', i, '') as string;
        payload = msg;
      }

      const ws = new WebSocket(url);

      const connect = (): Promise<void> =>
        new Promise((resolve, reject) => {
          ws.on('open', () => resolve());
          ws.on('error', reject);
        });

      try {
        await connect();
      } catch (err) {
        throw new NodeOperationError(
          this.getNode(),
          err instanceof Error ? err : new Error(String(err)),
          { itemIndex: i },
        );
      }

      if (operation === 'send') {
        ws.send(payload);
        results.push({
          json: {
            sent: true,
            payload: payload.length > 200 ? payload.slice(0, 200) + '…' : payload,
          },
          pairedItem: { item: i },
        });
        ws.close();
        continue;
      }

      // sendAndReceive
      ws.send(payload);

      const firstMessage = await new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => {
          ws.removeAllListeners();
          ws.close();
          reject(new Error(`Timeout dopo ${timeout} ms`));
        }, timeout);

        ws.once('message', (raw: Buffer | string) => {
          clearTimeout(t);
          resolve(raw.toString());
        });
        ws.once('error', (err: Error) => {
          clearTimeout(t);
          reject(err);
        });
        ws.once('close', () => {
          clearTimeout(t);
          reject(new Error('Connessione chiusa prima di ricevere messaggio'));
        });
      });

      ws.close();

      let json: unknown;
      try {
        json = JSON.parse(firstMessage) as unknown;
      } catch {
        json = { raw: firstMessage, body: firstMessage };
      }

      results.push({
        json: (typeof json === 'object' && json !== null ? json : { value: json }) as IDataObject,
        pairedItem: { item: i },
      });
    }

    return [results];
  }
}
