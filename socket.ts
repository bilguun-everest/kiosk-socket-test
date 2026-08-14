import { io } from 'socket.io-client';

// Copied verbatim from tpaykiosk/socket.ts.
// No URL argument -> socket.io-client connects back to the origin that served
// the page, which is the same Next.js custom server that hosts the relay.
export const socket = io({
  query: {
    client: 'kioskFrontService',
  },
});
