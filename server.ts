import { createServer } from 'node:http';
import next from 'next';
import { Server, Socket } from 'socket.io';

const dev: boolean = process.env.NODE_ENV !== 'production';
const hostname: string = process.env.HOST || 'localhost';
const port: number = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

function ts(): string {
  return new Date().toISOString();
}

// Describe a connected client from its handshake query, so the test console can
// show whether the .NET device service is actually attached.
function describe(socket: Socket) {
  const q = socket.handshake.query;
  return {
    id: socket.id,
    client: typeof q.client === 'string' ? q.client : 'unknown',
    address: socket.handshake.address,
    transport: socket.conn.transport.name,
  };
}

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  // --- relay config copied from tpaykiosk/server.ts ---
  const io = new Server(httpServer, {
    connectionStateRecovery: {},
    // Not in the original (same-origin there). Opt in with SOCKET_CORS=1 when
    // driving this rig from a page served on another host/port.
    ...(process.env.SOCKET_CORS === '1'
      ? { cors: { origin: '*', methods: ['GET', 'POST'] } }
      : {}),
  });

  const broadcastPeers = () => {
    io.emit(
      'peers',
      [...io.sockets.sockets.values()].map((s) => describe(s))
    );
  };

  io.on('connection', async (socket) => {
    console.info(`[${ts()}] connect`, describe(socket));
    broadcastPeers();

    // frontend -> device service
    socket.on('fromFrontEnd', (msg: any) => {
      io.emit('toDeviceService', msg);
      console.info(`[${ts()}] fromFrontEnd:`, JSON.stringify(msg));
    });

    // device service -> frontend (acknowledged)
    socket.on(
      'fromDeviceService',
      (msg: any, callback: (response: { status: string }) => void) => {
        io.emit('toFrontEnd', msg);
        console.info(`[${ts()}] fromDeviceService:`, JSON.stringify(msg));
        // The original always acks. Guard the call so a .NET client that emits
        // without an ack slot doesn't crash the relay.
        if (typeof callback === 'function') {
          callback({ status: 'ok' });
        } else {
          console.warn(
            `[${ts()}] fromDeviceService sent WITHOUT an ack callback ` +
              `(command=${msg?.command}). The relay still forwarded it, but ` +
              `production tpaykiosk would throw here.`
          );
        }
      }
    );

    socket.on('disconnect', (reason) => {
      console.info(`[${ts()}] disconnect`, { id: socket.id, reason });
      broadcastPeers();
    });
  });

  httpServer
    .once('error', (err: Error) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.info(`> socket test rig ready on http://${hostname}:${port}`);
      console.info(`> device service should connect to ws://${hostname}:${port}`);
    });

  function signalHandler(_signal: NodeJS.Signals) {
    process.exit();
  }

  process.on('SIGINT', signalHandler);
  process.on('SIGTERM', signalHandler);
  process.on('SIGQUIT', signalHandler);
});
