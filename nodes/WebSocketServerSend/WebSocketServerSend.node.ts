import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { getClients, getNodeKey, getServerNodeId } from '../WebSocketServer/shared';

export class WebSocketServerSend implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'APO WebSocket Server Send',
    name: 'webSocketServerSend',
    icon: 'file:webSocketServerSend.svg',
    group: ['transform'],
    version: 1,
    description: 'Invia un messaggio in broadcast o a un client specifico del WebSocket Server.',
    defaults: { name: 'APO WebSocket Server Send' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [{ type: NodeConnectionTypes.Main, displayName: 'Main' }],
    properties: [
      {
        displayName: 'Nome Nodo WebSocket Server',
        name: 'serverNodeName',
        type: 'string',
        default: '',
        placeholder: 'APO WebSocket Server',
        description: 'Nome del nodo "APO WebSocket Server" (trigger) nello stesso workflow a cui inviare il messaggio.',
        required: true,
      },
      {
        displayName: 'Operazione',
        name: 'operation',
        type: 'options',
								noDataExpression: true,
        options: [
          { name: 'Broadcast', value: 'broadcast' },
          { name: 'Invia A Client', value: 'sendToClient' },
        ],
        default: 'broadcast',
        description: 'Broadcast = invia a tutti i client connessi. Invia A Client = invia solo al client indicato.',
      },
      {
        displayName: 'Messaggio',
        name: 'message',
        type: 'string',
        default: '',
        placeholder: '{"type":"notification","text":"Hello"}',
        description: 'Contenuto da inviare (testo o JSON). Per usare il dato in input, attiva "Usa Dato in Input".',
      },
      {
        displayName: 'Usa Dato in Input',
        name: 'useInput',
        type: 'boolean',
        default: false,
        description: 'Whether to use the input item JSON as the message (replaces the Message field)',
      },
      {
        displayName: 'Client ID',
        name: 'clientId',
        type: 'string',
        default: '',
        placeholder: '{{ $json.clientId }}',
        description: 'ID del client (emesso dall\'uscita Connection del nodo APO WebSocket Server). Puoi usare un\'espressione, es. {{ $JSON.clientId }}.',
        displayOptions: { show: { operation: ['sendToClient'] } },
      },
    ],
		usableAsTool: true,
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const serverNodeName = (this.getNodeParameter('serverNodeName', 0) as string).trim();
    const operation = this.getNodeParameter('operation', 0) as string;
    const useInput = (this.getNodeParameter('useInput', 0, false) as boolean) ?? false;
    const defaultMessage = (this.getNodeParameter('message', 0, '') as string) || '';

    const workflow = this.getWorkflow();
    const workflowId = workflow?.id ?? '';
    if (!workflowId) {
      throw new NodeOperationError(this.getNode(), 'Workflow non disponibile.');
    }
    const serverNodeId = getServerNodeId(workflowId, serverNodeName);
    if (!serverNodeId) {
      throw new NodeOperationError(
        this.getNode(),
        `Nodo APO WebSocket Server con nome "${serverNodeName}" non trovato. Assicurati che il workflow sia attivo e che il nome coincida con quello del trigger.`,
      );
    }

    const key = getNodeKey(serverNodeId, workflowId);
    const clients = getClients(key);
    if (!clients || clients.size === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'Nessun client connesso all\'APO WebSocket Server. Avvia il workflow e attendi almeno una connessione.',
      );
    }

    const results: INodeExecutionData[] = [];

    if (operation === 'broadcast') {
      const message = useInput && items.length > 0
        ? (typeof items[0].json === 'object' ? JSON.stringify(items[0].json) : String(items[0].json))
        : defaultMessage;
      let sent = 0;
      let errors = 0;
      for (const [, ws] of clients) {
        if (ws.readyState === 1) {
          try {
            ws.send(message);
            sent += 1;
          } catch {
            errors += 1;
          }
        }
      }
      results.push({
        json: {
          operation: 'broadcast',
          message,
          sent,
          errors,
          totalClients: clients.size,
        },
        pairedItem: { item: 0 },
      });
    } else {
      for (let i = 0; i < items.length; i++) {
        const clientId = (this.getNodeParameter('clientId', i, '') as string).trim();
        if (!clientId) {
          throw new NodeOperationError(
            this.getNode(),
            'Client ID obbligatorio per "Invia A Client". Usa ad es. {{ $json.clientId }}.',
            { itemIndex: i },
          );
        }
        const message = useInput
          ? (typeof items[i].json === 'object' ? JSON.stringify(items[i].json) : String(items[i].json))
          : (this.getNodeParameter('message', i, defaultMessage) as string) || defaultMessage;
        const ws = clients.get(clientId);
        if (!ws) {
          throw new NodeOperationError(
            this.getNode(),
            `Client con ID "${clientId}" non trovato (disconnesso o ID errato).`,
            { itemIndex: i },
          );
        }
        if (ws.readyState !== 1) {
          throw new NodeOperationError(
            this.getNode(),
            `Client "${clientId}" non è connesso (readyState ${ws.readyState}).`,
            { itemIndex: i },
          );
        }
        ws.send(message);
        results.push({
          json: { operation: 'sendToClient', clientId, message, sent: true },
          pairedItem: { item: i },
        });
      }
    }

    return [results];
  }
}
