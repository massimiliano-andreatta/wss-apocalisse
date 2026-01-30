# n8n-nodes-websocket-apocalisse

Plugin n8n con tre nodi WebSocket con prefisso **APO**:

- **APO WebSocket Server** (trigger): avvia un server WebSocket, gestisce connessioni, messaggi e disconnessioni; emette un `clientId` per ogni client (usabile dal nodo di invio).
- **APO WebSocket Server Send** (azione): invia un messaggio in **broadcast** (a tutti i client) oppure a un **client specifico** tramite `clientId`.
- **APO WebSocket Client** (azione): si connette a un server WebSocket esterno, invia e riceve messaggi.

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

### APO WebSocket Server (trigger)

Avvia un server WebSocket su una porta e path configurabili. **Tre uscite:**

| Uscita         | Quando viene emessa |
|----------------|----------------------|
| **Connection** | Nuovo client connesso (include `clientId` per invio mirato) |
| **Message**    | Messaggio ricevuto da un client (include `_meta.clientId`) |
| **Disconnection** | Client disconnesso (include `clientId`) |

**Parametri principali:**

- **Porta**: porta TCP (default `3456`).
- **Path**: path opzionale (default `/`).
- **Host**: indirizzo su cui ascoltare (default `0.0.0.0` = tutte le interfacce).
- **Max Payload (bytes)**: dimensione massima di un messaggio (default 10 MB).
- **Allowed Origins**: origini consentite (separate da virgola); vuoto = tutte accettate.
- **Per-Message Deflate**: abilita compressione messaggi.
- **Welcome Message**: messaggio inviato al client appena si connette.

Quando il workflow è attivo, il server inizia ad ascoltare; connessioni, messaggi e disconnessioni vengono emessi sulle rispettive uscite. Ogni client riceve un **clientId** (UUID) nell’evento Connection, usabile con **APO WebSocket Server Send** per inviare messaggi a quel client.

### APO WebSocket Server Send (azione)

Invia un messaggio ai client connessi all’**APO WebSocket Server** dello stesso workflow.

- **Nome nodo APO WebSocket Server**: nome del trigger "APO WebSocket Server" nel workflow (il server deve essere attivo).
- **Operazione**:
  - **Broadcast**: invia lo stesso messaggio a tutti i client connessi.
  - **Invia A Client**: invia solo al client indicato tramite **Client ID** (es. `{{ $json.clientId }}` dall’uscita Connection del server).
- **Messaggio**: testo o JSON da inviare.
- **Usa Dato in Input**: se attivo, il messaggio è il JSON dell’item in input.
- **Client ID**: (solo per "Invia A Client") ID del client; supporta espressioni, es. `{{ $json.clientId }}`.

### APO WebSocket Client (azione)

Si connette a un server WebSocket (protocollo `ws` o `wss`). **Tre uscite:**

| Uscita         | Quando viene emessa |
|----------------|----------------------|
| **Connection** | Connessione stabilita |
| **Message**    | Messaggio ricevuto dal server |
| **Disconnection** | Connessione chiusa |

**Parametri principali:**

- **Protocollo**: `ws` o `wss`.
- **Dominio**, **Porta**, **Path**: per costruire l’URL del server.
- **Operazione**:
  - **Solo Connessione**: connette; opzionalmente può inviare un messaggio dopo la connessione e attendere una risposta (con timeout).
  - **Connetti e ascolta**: connette ed emette su Connection, poi attende il primo messaggio o la disconnessione (con timeout) e emette su Message o Disconnection.
  - **Invia Messaggio**: invia un messaggio e chiude.
  - **Invia E Attendi Risposta**: invia un messaggio, attende la prima risposta (con timeout) e la restituisce.
- **Messaggio** / **Usa Dato in Input**: contenuto da inviare (testo/JSON) o uso dell’item in input.
- **Timeout Risposta (ms)** / **Timeout attesa evento (ms)**: timeout per risposta o per “Connetti e ascolta”.
- **Reconnect**: abilita tentativi di riconnessione (numero massimo tentativi, intervallo in ms).

## Utilizzo in n8n

1. Crea un workflow con **APO WebSocket Server** come trigger; imposta porta, path e, se serve, host e allowed origins.
2. Attiva il workflow: il server ascolta.
3. Collega le uscite **Connection**, **Message** e **Disconnection** ai nodi successivi per gestire eventi diversi.
4. Per **inviare messaggi** dal workflow: aggiungi **APO WebSocket Server Send**, imposta il nome del nodo APO WebSocket Server (es. "APO WebSocket Server"), scegli **Broadcast** oppure **Invia A Client** (con Client ID, es. `{{ $json.clientId }}` se l’input viene dall’uscita Connection).
5. Per connetterti da un altro workflow o da uno script: usa **APO WebSocket Client** con URL `ws://<host>:<porta>/<path>`; i messaggi ricevuti dal server escono dall’uscita **Message** del trigger.

## Link

- Repository: [https://github.com/massimiliano-andreatta/wss-apocalisse](https://github.com/massimiliano-andreatta/wss-apocalisse)
- npm: [n8n-nodes-websocket-apocalisse](https://www.npmjs.com/package/n8n-nodes-websocket-apocalisse)

## Licenza

MIT
