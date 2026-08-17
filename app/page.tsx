'use client';

import { useEffect, useState } from 'react';

import { socket } from '@/socket';
import { createRequestId, sendCommand } from '@/services/socketService';

export default function Page() {
  const [command, setCommand] = useState('KIOSK_ID_GET');
  const [dataText, setDataText] = useState('{}');
  const [listen, setListen] = useState(true);
  const [lines, setLines] = useState<string[]>([]);

  const log = (s: string, body?: unknown) =>
    setLines((prev) =>
      [
        `${new Date().toLocaleTimeString('en-GB', { hour12: false })}  ${s}` +
          (body === undefined ? '' : `  ${JSON.stringify(body)}`),
        ...prev,
      ].slice(0, 500)
    );

  useEffect(() => {
    const onConnect = () => log('CONNECTED', socket.id);
    const onDisconnect = (r: string) => log('DISCONNECTED', r);
    const onError = (e: Error) => log('CONNECT_ERROR', e.message);
    const onToDevice = (m: unknown) => log('--> toDeviceService', m);
    const onToFront = (m: unknown) => log('<-- toFrontEnd', m);
    const onPeers = (p: unknown) => log('    peers', p);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);
    socket.on('toDeviceService', onToDevice);
    socket.on('toFrontEnd', onToFront);
    socket.on('peers', onPeers);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.off('toDeviceService', onToDevice);
      socket.off('toFrontEnd', onToFront);
      socket.off('peers', onPeers);
    };
  }, []);

  async function fire() {
    let data: any = {};
    try {
      data = dataText.trim() ? JSON.parse(dataText) : {};
    } catch (e: any) {
      log('BAD JSON', e.message);
      return;
    }
    const request_id = createRequestId();
    const t0 = Date.now();
    log(`sendCommand ${command} listen=${listen} id=${request_id}`, data);
    try {
      const res = await sendCommand({
        request_id,
        command,
        data,
        isListenResponse: listen,
      });
      log(`RESOLVED ${Date.now() - t0}ms id=${request_id}`, res);
    } catch (e: any) {
      log(
        `REJECTED ${Date.now() - t0}ms id=${request_id}`,
        e?.message ?? String(e)
      );
    }
  }

  return (
    <div>
      <h3>kiosk socket test</h3>
      <div>
        command:{' '}
        <input value={command} onChange={(e) => setCommand(e.target.value)} />
      </div>
      <div>
        data:{' '}
        <input value={dataText} onChange={(e) => setDataText(e.target.value)} />
      </div>
      <div>
        <label>
          <input
            type="checkbox"
            checked={listen}
            onChange={(e) => setListen(e.target.checked)}
          />
          isListenResponse
        </label>
      </div>
      <p>
        <button onClick={fire}>send</button>
      </p>
      <pre>{lines.join('\n')}</pre>
    </div>
  );
}
