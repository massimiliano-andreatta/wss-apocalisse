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

## Pubblicazione su npm

Per pubblicare il pacchetto su [npm](https://www.npmjs.com/):

1. **Login** (solo la prima volta):
   ```bash
   npm login
   ```

2. **Pubblicare** (build + bump versione + tag git + publish):
   ```bash
   npm run release
   ```
   Oppure lo script helper (verifica login, build e avvia il release):
   ```bash
   ./scripts/publish-to-npm.sh
   ```

   `npm run release` usa [release-it](https://github.com/release-it/release-it): chiede la nuova versione (patch/minor/major), aggiorna `package.json`, crea il tag git, opzionalmente la release su GitHub, e esegue `npm publish`.  
   Il comando diretto `npm publish` è disabilitato da `prepublishOnly` (n8n-node prerelease): usare sempre `npm run release` per pubblicare.

### Script disponibili

| Script         | Descrizione                                                                 |
|----------------|-----------------------------------------------------------------------------|
| `npm run release` | Flusso completo: bump versione, changelog, tag git, publish su npm        |
| `npm run publish:npm` | Alias di `npm run release`                                               |
| `./scripts/publish-to-npm.sh` | Verifica login npm, build e avvia `npm run release`                    |

## Licenza

MIT
