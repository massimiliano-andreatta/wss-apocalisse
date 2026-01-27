# n8n-nodes-websocket-apocalisse

Plugin n8n con due nodi per WebSocket:

- **WebSocket Server** (trigger): avvia un server WebSocket sulla porta scelta; ogni messaggio ricevuto da un client attiva il workflow.
- **WebSocket Client** (azione): si connette a un URL WebSocket, invia un messaggio e, opzionalmente, aspetta la prima risposta.

## Requisiti

- Node.js 22+
- n8n

## Installazione

```bash
npm install
npm run build
```

## Sviluppo

```bash
npm install
npm run dev
```

Si apre n8n con i nodi caricati e il watch sui file attivo.

## Nodi

### WebSocket Server (trigger)

- **Porta**: porta TCP (default 3456).
- **Path**: path opzionale (default `/`).
- Attiva il workflow: il server inizia ad ascoltare. Ogni messaggio ricevuto (connessione → messaggio) viene emesso verso il flusso.

### WebSocket Client

- **URL**: `ws://...` o `wss://...`.
- **Operazione**:
  - **Invia messaggio**: invia e chiude.
  - **Invia e attendi risposta**: invia, aspetta il primo messaggio (con timeout) e lo restituisce.
- **Messaggio**: testo/JSON da inviare, oppure usa il JSON dell’item in input se “Usa dato in input” è attivo.
- **Timeout risposta**: usato solo con “Invia e attendi risposta”.

## Utilizzo in n8n

1. Crea un workflow con **WebSocket Server** come trigger, imposta porta (e path se serve).
2. Attiva il workflow: il server ascolta.
3. In un altro workflow (o da uno script) usa **WebSocket Client** con URL `ws://<host>:<porta>/` per inviare messaggi al server; i messaggi ricevuti dal server attivano il primo workflow.

## Licenza

MIT
