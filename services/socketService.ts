import { socket } from '@/socket';

type Props = {
  command: string;
  responseCommand?: string;
  data?: any;
  isListenResponse?: boolean;
};

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
          const request = { command, data: data || {}, from: 'KIOSK' };
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
              if (msg.command === (responseCommand ?? command)) {
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
