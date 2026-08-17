import { socket } from '@/socket';

type Props = {
  command: string;
  responseCommand?: string;
  data?: any;
  isListenResponse?: boolean;
  request_id?: string;
};

export function createRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function sendCommand(props: Props): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      socket.emit('fromFrontEnd', {
        command: 'HELLO',
        from: 'KIOSK',
      });

      const helloPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('KioskServiceNoResponse'));
        }, 5000);

        socket.on('toFrontEnd', (msg) => {
          if (msg.command === 'HELLO') {
            clearTimeout(timeout); // Clear the timeout if a response is received
            resolve();
          }
        });
      });

      helloPromise
        .then(() => {
          // Continue with the rest of the request
          const { command, data, isListenResponse, responseCommand } = props;
          const request_id = props.request_id ?? createRequestId();
          const request = {
            command,
            data: data || {},
            from: 'KIOSK',
            request_id,
          };
          socket.emit('fromFrontEnd', request);

          if (isListenResponse) {
            const responseTimeout = setTimeout(() => {
              reject(
                new Error(
                  'KioskService: Алдаа гарлаа. Та түр хүлээгээд дахин оролдоно уу'
                )
              );
            }, 60000); // 60 seconds timeout

            socket.on('toFrontEnd', (msg) => {
              // Correlate on request_id when the device service echoes one back;
              // fall back to command-only matching so a service that does not
              // know about request_id yet still works.
              const idMatches =
                msg.request_id === undefined || msg.request_id === request_id;

              if (msg.command === (responseCommand ?? command) && idMatches) {
                clearTimeout(responseTimeout); // Clear the timeout if a response is received
                const responseCode = Number(msg.intResult);
                if (responseCode === 0) {
                  resolve(msg.data);
                }
                if (responseCode != 0) {
                  reject(new Error(`KioskServiceException ${msg.intResult} `));
                }
              }
            });
          } else {
            resolve({ message: 'Request sent, not listening for response' });
          }
        })
        .catch((error) => {
          reject(error);
        });
    } catch (error) {
      reject('KioskServiceException: ' + error);
    }
  });
}
