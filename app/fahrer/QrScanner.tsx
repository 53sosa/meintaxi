"use client";

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
}

export default function QrScanner({ onScan, onError }: Props) {
  const scannerRef   = useRef<Html5Qrcode | null>(null);
  const isRunningRef = useRef(false);
  const containerId  = 'qr-scanner-container';

  useEffect(() => {
    // Kurze Verzögerung damit der Container im DOM ist
    const timer = setTimeout(() => {
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!isRunningRef.current) return;
          isRunningRef.current = false;
          scanner.stop().catch(() => {}).finally(() => {
            onScan(decodedText);
          });
        },
        () => {} // Scan-Fehler ignorieren (normal beim Suchen)
      )
      .then(() => {
        isRunningRef.current = true;
      })
      .catch((err) => {
        isRunningRef.current = false;
        onError?.('Kamera konnte nicht gestartet werden: ' + err);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      // Nur stoppen wenn wirklich läuft
      if (isRunningRef.current && scannerRef.current) {
        isRunningRef.current = false;
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="space-y-3">
      <div
        id={containerId}
        className="w-full rounded-xl overflow-hidden border-2 border-blue-300"
        style={{ minHeight: '300px' }}
      />
      <p className="text-xs text-center text-gray-400">
        QR-Code des Patienten in den Rahmen halten
      </p>
    </div>
  );
}