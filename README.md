# n8n-nodes-websocket-apocalisse

Plugin n8n con due nodi per WebSocket: **WebSocket Server** (trigger) e **WebSocket Client** (azione).  
Consente di avviare un server WebSocket, gestire connessioni/disconnessioni/messaggi e connettersi a server esterni per inviare e ricevere messaggi.

## Requisiti

- Node.js 22+
- n8n

## Installazione

### Da npm (uso in n8n)

```bash
npm install n8n-nodes-websocket-apocalisse
```

Poi in n8n: **Settings → Community nodes → Install** e cerca `n8n-nodes-websocket-apocalisse`, oppure installa globalmente e avvia n8n con i community node abilitati.

### Sviluppo (clone del repository)

```bash
git clone https://github.com/massimiliano-andreatta/wss-apocalisse.git
cd wss-apocalisse
npm install
npm run build
```

Per sviluppo con watch e n8n in locale:

```bash
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
