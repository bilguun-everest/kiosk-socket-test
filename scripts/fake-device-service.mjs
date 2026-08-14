// Stand-in for the .NET device service, so you can prove the relay + sendCommand
// work before pointing the real one at it.
//
//   npm run fake-device
//
// It connects exactly the way the .NET client has to: socket.io v4 client,
// listens on `toDeviceService`, replies on `fromDeviceService` with an ack.

import { io } from 'socket.io-client';

const URL = process.env.RIG_URL || 'http://localhost:3000';

const socket = io(URL, {
  query: { client: 'kioskDeviceService' },
  transports: ['websocket', 'polling'],
});

// command -> payload returned as `data` with intResult 0
const CANNED = {
  KIOSK_ID_GET: 1234,
  ACCEPTOR_STOP: 20000,
  ACCEPTOR_REMAINING: {
    acceptor_detail: [{ denomination: 20000, remaining: 3 }],
  },
  DISPENSER_REMAINING: {
    dispenser: [
      { box: 'BOX_1', denomination: 20000, remaining: 50 },
      { box: 'BOX_2', denomination: 10000, remaining: 0 },
    ],
    reject_detail: [{ denomination: 20000, remaining: 1 }],
  },
};

socket.on('connect', () => {
  console.log(`[device] connected to ${URL} as ${socket.id}`);
});

socket.on('connect_error', (err) => {
  console.error('[device] connect_error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[device] disconnected:', reason);
});

socket.on('toDeviceService', (msg) => {
  if (!msg || typeof msg.command !== 'string') return;
  console.log('[device] <--', JSON.stringify(msg));

  const reply = {
    command: msg.command,
    intResult: 0,
    data: CANNED[msg.command] ?? { ok: true },
  };

  // HELLO must come back or sendCommand rejects with KioskServiceNoResponse.
  const delay = msg.command === 'HELLO' ? 0 : 300;

  setTimeout(() => {
    console.log('[device] -->', JSON.stringify(reply));
    socket.emit('fromDeviceService', reply, (ack) => {
      if (ack?.status !== 'ok') console.warn('[device] unexpected ack:', ack);
    });
  }, delay);
});
