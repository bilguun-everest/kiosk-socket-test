# kiosk-socket-test

Minimal rig for testing `sendCommand()` from `tpaykiosk` against the .NET device
service. Socket settings copied verbatim from `tpaykiosk`; the UI is deliberately
plain — one button.

## Run

```bash
npm install
npm run dev                 # http://localhost:3000
PORT=3100 npm run dev       # if 3000 is taken
```

Open the page, set a command, hit **send**. The `<pre>` block logs everything on
the wire in both directions.

To prove the rig works without the real .NET service:

```bash
npm run fake-device         # RIG_URL=http://localhost:3100 npm run fake-device
```

## What was copied from tpaykiosk

| File | Copied |
| --- | --- |
| `socket.ts` | verbatim — `io()` with query `client: 'kioskFrontService'` |
| `services/socketService.ts` | verbatim — `sendCommand()`, untouched |
| `server.ts` | relay logic + `connectionStateRecovery: {}`; see deltas below |

`server.ts` deltas (test-rig affordances, contract unchanged):

- `HOST` / `PORT` env vars instead of hardcoded `localhost:3000`
- timestamped logs, connect/disconnect logging
- a `peers` broadcast so the page can show whether the device service is attached
- optional permissive CORS behind `SOCKET_CORS=1` (off by default, matching prod)
- the `fromDeviceService` ack callback is guarded with `typeof callback === 'function'`
- dropped the `open`/Chrome-kiosk launch block (it was already commented out)

## The protocol your .NET service must speak

Socket.IO **v4** (Engine.IO 4) client — e.g. the `SocketIOClient` NuGet package.
Connect to `ws://<host>:3000` with a handshake query identifying the client,
then:

- **listen** on `toDeviceService` — messages from the frontend
- **emit** `fromDeviceService` — messages to the frontend, **with an ack callback**

The relay broadcasts with `io.emit`, so every message goes to every connected
socket; clients filter by `command` themselves.

Request from the frontend:

```json
{ "command": "KIOSK_ID_GET", "data": {}, "from": "KIOSK" }
```

Response the device service must send back:

```json
{ "command": "KIOSK_ID_GET", "intResult": 0, "data": 1234 }
```

`intResult === 0` means success and `data` is resolved to the caller. Any other
value rejects as `KioskServiceException <intResult>`.

### Handshake

`sendCommand()` sends `{ command: 'HELLO', from: 'KIOSK' }` before **every**
command and waits up to **5s** for a `toFrontEnd` message with
`command === 'HELLO'`. No reply → `KioskServiceNoResponse`, and the real command
is never sent. After that it waits up to **60s** for the response command.

So the first thing to get working on the .NET side is replying to `HELLO`.

### Commands seen in tpaykiosk

`HELLO`, `KIOSK_ID_GET`, `ACCEPTOR_START`, `ACCEPTOR_STOP`, `ACCEPTOR_EMPTY`,
`ACCEPTOR_REMAINING`, `DISPENSER_REMAINING`, `DISPENSER_EMPTY`,
`DISPENSER_DISPENSE_MONEY`, `DISPENSER_DELIVER_MONEY`, `DISPENSER_UPDATE_MONEY`,
`CARD_READER_READ`, `PRINTER_RECEIPT`, `PAYMENT_FAIL`, `KIOSK_LOG`,
`KIOSK_SCREEN_CHANGE_LOG`.

## Known quirks in the copied `sendCommand()`

Left in place on purpose — this rig exists to test the real thing, and these
reproduce faithfully:

1. **Listener leak.** Every call does `socket.on('toFrontEnd', …)` twice and
   never removes the handlers. Handlers accumulate for the life of the page, and
   old ones still fire on later messages.
2. **Cross-talk between concurrent calls.** Responses are matched only by
   `command`, with no correlation id. Two in-flight calls for the same command
   resolve on whichever reply lands first.
3. **`HELLO` on every call.** Doubles the round trips, and one dropped `HELLO`
   fails the whole command.
4. **Broadcast fan-out.** `io.emit` sends every message to every client,
   including the sender.

## Verified

`npm run dev` + `npm run fake-device`, driving `sendCommand` over the real relay:

```
PASS KIOSK_ID_GET (309ms)        -> 1234
PASS DISPENSER_REMAINING (311ms) -> { dispenser: [...], reject_detail: [...] }
PASS ACCEPTOR_STOP (308ms)       -> 20000
PASS KIOSK_LOG (no listen)       -> { message: 'Request sent, not listening for response' }
```

`npm run build` passes, type checking included.
