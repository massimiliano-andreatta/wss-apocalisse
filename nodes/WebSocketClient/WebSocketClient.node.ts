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
    outputs: [
      { type: NodeConnectionTypes.Main, displayName: 'Connection' },
      { type: NodeConnectionTypes.Main, displayName: 'Message' },
      { type: NodeConnectionTypes.Main, displayName: 'Disconnection' },
    ],
    properties: [
      {
        displayName: 'Protocollo',
        name: 'protocol',
        type: 'options',
        options: [
          { name: 'Ws', value: 'ws' },
          { name: 'Wss', value: 'wss' },
        ],
        default: 'ws',
        description: 'Protocollo WebSocket (ws = non crittografato, wss = TLS)',
      },
      {
        displayName: 'Dominio',
        name: 'domain',
        type: 'string',
        default: 'localhost',
        placeholder: 'localhost',
        description: 'Host o dominio del server (es. localhost, example.com).',
        required: true,
      },
      {
        displayName: 'Porta',
        name: 'port',
        type: 'number',
        default: 3456,
        description: 'Porta TCP del server WebSocket',
      },
      {
        displayName: 'Path',
        name: 'path',
        type: 'string',
        default: '/',
        placeholder: '/',
        description: 'Path opzionale (es. /ws, /socket).',
      },
      {
        displayName: 'Operazione',
        name: 'operation',
        type: 'options',
								noDataExpression: true,
        options: [
          { name: 'Solo Connessione', value: 'connectOnly' },
          { name: 'Connetti E Ascolta', value: 'connectAndListen' },
          { name: 'Invia Messaggio', value: 'send' },
          { name: 'Invia E Attendi Risposta', value: 'sendAndReceive' },
        ],
        default: 'send',
        description: 'Azione da eseguire',
      },
      {
        displayName: 'Timeout Attesa Evento (Ms)',
        name: 'connectAndListenTimeout',
        type: 'number',
        default: 30000,
        description: 'Quanto attendere il primo evento (messaggio o disconnessione) prima di chiudere (solo per "Connetti e ascolta")',
        displayOptions: { show: { operation: ['connectAndListen'] } },
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
      {
        displayName: 'Invia Messaggio Dopo Connessione',
        name: 'connectOnlySendMessage',
        type: 'boolean',
        default: false,
        description: 'Whether to send a message after connecting (solo per "Solo Connessione")',
        displayOptions: { show: { operation: ['connectOnly'] } },
      },
      {
        displayName: 'Messaggio Da Inviare',
        name: 'connectOnlyMessage',
        type: 'string',
        default: '',
        placeholder: '{"type":"ping"}',
        description: 'Messaggio da inviare dopo aver stabilito la connessione',
        displayOptions: { show: { operation: ['connectOnly'], connectOnlySendMessage: [true] } },
      },
      {
        displayName: 'Usa Dato in Input Come Messaggio',
        name: 'connectOnlyUseInput',
        type: 'boolean',
        default: false,
        description: 'Whether to send the input item JSON as the message',
        displayOptions: { show: { operation: ['connectOnly'], connectOnlySendMessage: [true] } },
      },
      {
        displayName: 'Attendi Risposta',
        name: 'connectOnlyWaitResponse',
        type: 'boolean',
        default: false,
        description: 'Whether to wait for a response after sending the message',
        displayOptions: { show: { operation: ['connectOnly'], connectOnlySendMessage: [true] } },
      },
      {
        displayName: 'Timeout Risposta (Ms)',
        name: 'connectOnlyTimeout',
        type: 'number',
        default: 5000,
        description: 'Attesa massima per la risposta del server',
        displayOptions: { show: { operation: ['connectOnly'], connectOnlySendMessage: [true], connectOnlyWaitResponse: [true] } },
      },
      {
        displayName: 'Reconnect',
        name: 'reconnect',
        type: 'boolean',
        default: false,
        description: 'Whether to retry connecting (and the operation) if the connection fails or is lost',
      },
      {
        displayName: 'Numero Massimo Tentativi',
        name: 'maxReconnectAttempts',
        type: 'number',
        default: 3,
        description: 'Quanti tentativi di connessione effettuare (primo + retry) quando Reconnect è attivo',
        displayOptions: { show: { reconnect: [true] } },
      },
      {
        displayName: 'Ogni Quanto Riprovare (Ms)',
        name: 'reconnectDelay',
        type: 'number',
        default: 1000,
        description: 'Tempo di attesa in millisecondi tra un tentativo e il successivo (es. 1000 = 1 secondo).',
        displayOptions: { show: { reconnect: [true] } },
      },
    ],
		usableAsTool: true,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const protocol = (this.getNodeParameter('protocol', 0) as string) || 'ws';
    const domain = (this.getNodeParameter('domain', 0) as string) || 'localhost';
    const port = (this.getNodeParameter('port', 0) as number) ?? 3456;
    const path = (this.getNodeParameter('path', 0) as string) || '/';
    const pathNorm = path.startsWith('/') ? path : `/${path}`;
    const url = `${protocol}://${domain}:${port}${pathNorm}`;
    const operation = this.getNodeParameter('operation', 0) as string;
    const useInput = this.getNodeParameter('useInput', 0) as boolean;
    const timeout = (this.getNodeParameter('timeout', 0) as number) || 5000;
    const reconnect = (this.getNodeParameter('reconnect', 0) as boolean) ?? false;
    const maxAttempts = Math.max(1, (this.getNodeParameter('maxReconnectAttempts', 0) as number) || 3);
    const reconnectDelayMs = Math.max(0, (this.getNodeParameter('reconnectDelay', 0) as number) || 1000);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const connectionOut: INodeExecutionData[] = [];
    const messageOut: INodeExecutionData[] = [];
    const disconnectionOut: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      let payload = '';
      if (operation !== 'connectOnly' && operation !== 'connectAndListen') {
        if (useInput) {
          payload = JSON.stringify(items[i].json);
        } else {
          const msg = this.getNodeParameter('message', i, '') as string;
          payload = msg;
        }
      }

      const attempts = reconnect ? maxAttempts : 1;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        const ws = new WebSocket(url);

        const connect = (): Promise<void> =>
          new Promise((resolve, reject) => {
            ws.on('open', () => resolve());
            ws.on('error', reject);
          });

        try {
          await connect();
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < attempts) {
            await sleep(reconnectDelayMs);
            continue;
          }
          throw new NodeOperationError(this.getNode(), lastError, { itemIndex: i });
        }

        try {
          if (operation === 'connectAndListen') {
            const listenTimeout = (this.getNodeParameter('connectAndListenTimeout', 0) as number) || 30000;
            connectionOut.push({
              json: { event: 'connection', connected: true, url },
              pairedItem: { item: i },
            });
            const firstEvent = await new Promise<{ kind: 'message'; data: string } | { kind: 'close' }>((resolve, reject) => {
              const t = setTimeout(() => {
                ws.removeAllListeners();
                ws.close();
                resolve({ kind: 'close' });
              }, listenTimeout);
              ws.once('message', (raw: Buffer | string) => {
                clearTimeout(t);
                resolve({ kind: 'message', data: raw.toString() });
              });
              ws.once('close', () => {
                clearTimeout(t);
                resolve({ kind: 'close' });
              });
              ws.once('error', (err: Error) => {
                clearTimeout(t);
                reject(err);
              });
            });
            ws.removeAllListeners();
            ws.close();
            if (firstEvent.kind === 'message') {
              let jsonMsg: unknown;
              try {
                jsonMsg = JSON.parse(firstEvent.data) as unknown;
              } catch {
                jsonMsg = { raw: firstEvent.data, body: firstEvent.data };
              }
              messageOut.push({
                json: {
                  event: 'message',
                  ...(typeof jsonMsg === 'object' && jsonMsg !== null ? jsonMsg : { value: jsonMsg }),
                } as IDataObject,
                pairedItem: { item: i },
              });
            } else {
              disconnectionOut.push({
                json: { event: 'disconnection', url, reason: 'closed_or_timeout' },
                pairedItem: { item: i },
              });
            }
            break;
          }

          if (operation === 'connectOnly') {
            const sendAfterConnect = (this.getNodeParameter('connectOnlySendMessage', 0) as boolean) ?? false;
            if (!sendAfterConnect) {
              connectionOut.push({
                json: { connected: true, url },
                pairedItem: { item: i },
              });
              ws.close();
              break;
            }
            const useInputConnect = (this.getNodeParameter('connectOnlyUseInput', 0) as boolean) ?? false;
            const msgConnect = useInputConnect
              ? JSON.stringify(items[i].json)
              : ((this.getNodeParameter('connectOnlyMessage', 0) as string) || '');
            ws.send(msgConnect);
            const waitResponse = (this.getNodeParameter('connectOnlyWaitResponse', 0) as boolean) ?? false;
            if (!waitResponse) {
              connectionOut.push({
                json: { connected: true, url, sent: true },
                pairedItem: { item: i },
              });
              ws.close();
              break;
            }
            const timeoutConnect = (this.getNodeParameter('connectOnlyTimeout', 0) as number) || 5000;
            const firstMessage = await new Promise<string>((resolve, reject) => {
              const t = setTimeout(() => {
                ws.removeAllListeners();
                ws.close();
                reject(new Error(`Timeout dopo ${timeoutConnect} ms`));
              }, timeoutConnect);
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
            let jsonResp: unknown;
            try {
              jsonResp = JSON.parse(firstMessage) as unknown;
            } catch {
              jsonResp = { raw: firstMessage, body: firstMessage };
            }
            connectionOut.push({
              json: {
                connected: true,
                url,
                sent: true,
                response: (typeof jsonResp === 'object' && jsonResp !== null ? jsonResp : { value: jsonResp }) as IDataObject,
              },
              pairedItem: { item: i },
            });
            break;
          }

          if (operation === 'send') {
            ws.send(payload);
            connectionOut.push({
              json: {
                sent: true,
                payload: payload.length > 200 ? payload.slice(0, 200) + '…' : payload,
              },
              pairedItem: { item: i },
            });
            ws.close();
            break;
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

          connectionOut.push({
            json: (typeof json === 'object' && json !== null ? json : { value: json }) as IDataObject,
            pairedItem: { item: i },
          });
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          try {
            ws.removeAllListeners();
            ws.close();
          } catch {
            /* ignore */
          }
          if (attempt < attempts) {
            await sleep(reconnectDelayMs);
            continue;
          }
          throw new NodeOperationError(this.getNode(), lastError, { itemIndex: i });
        }
      }
    }

    return [connectionOut, messageOut, disconnectionOut];
  }
}
