"use client";

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useRouter } from 'next/navigation';

export default function FahrerFrontend() {
  const router = useRouter();

  // --- STATES ---
  const [isScanning, setIsScanning] = useState(false);
  const [scannedRide, setScannedRide] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Fahrer-Daten States
  const [fahrerName, setFahrerName] = useState("Lade...");
  const [wagenNr, setWagenNr] = useState("...");

  // Canvas States (vom Kollegen + Erweiterung)
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false); // NEU: Verhindert leere Bilder!
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- DATEN LADEN BEIM START ---
  useEffect(() => {
    // Holt sich die echten Daten vom Login!
    setFahrerName(localStorage.getItem('fahrerName') || "Unbekannter Fahrer");
    setWagenNr(localStorage.getItem('wagenNr') || "Unbekannt");
  }, []);

  // --- LOGOUT LOGIK ---
  const handleLogout = async () => {
    document.cookie = "session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    localStorage.removeItem('fahrerName'); // Sicherheitshalber aufräumen
    localStorage.removeItem('wagenNr');
    router.push('/login');
  };

  // --- SCANNER LOGIK ---
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isScanning) {
      const timer = setTimeout(() => {
        scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
        scanner.render(
          (decodedText) => {
            if (scanner) scanner.clear().catch(() => {});
            setIsScanning(false);
            fetchRideData(decodedText);
          },
          (err) => {}
        );
      }, 50);
      return () => {
        clearTimeout(timer);
        if (scanner) scanner.clear().catch(() => {});
      };
    }
  }, [isScanning]);

  const fetchRideData = async (kts_id: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/kts/${kts_id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      const ride = data.ride;
      ride.zuzahlung_betrag = (ride.zuzahlungspflichtig === 1 || ride.zuzahlungspflichtig === true) ? 5.00 : 0;
      setScannedRide(ride);
    } catch (err: any) {
      setError(err.message || 'QR-Code ungültig.');
    } finally {
      setLoading(false);
    }
  };

  // --- SIGNATUR CANVAS LOGIK (vom Kollegen repariert) ---
  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    } else {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
    setIsDrawing(true);
    setHasDrawn(true); // NEU: Das System weiß jetzt, dass echte Tinte geflossen ist!
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureImage(null);
    setHasDrawn(false); // NEU: Beim Löschen wird das Bild wieder als "leer" markiert
  };

  const saveSignature = () => {
    if (!hasDrawn) {
      alert("Bitte unterschreiben Sie zuerst im Feld, bevor Sie bestätigen!");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureImage(canvas.toDataURL('image/png'));
  };

  const handleFahrtAbschliessen = () => {
    if (!signatureImage) {
      alert('Bitte den Patienten zuerst unterschreiben lassen!');
      return;
    }
    setIsSuccess(true);
  };

  const handleNaechsteFahrt = () => {
    setScannedRide(null);
    setSignatureImage(null);
    setHasDrawn(false);
    setIsSuccess(false);
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100 relative">
        
        <button onClick={handleLogout} className="absolute top-6 right-6 text-xs font-bold text-red-500 hover:underline z-10">
          Logout
        </button>

        {!isSuccess && (
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-blue-600">MEINTAXI Schicht</h1>
            {/* HIER STEHEN JETZT DIE ECHTEN DATEN */}
            <p className="text-sm text-gray-500 mt-1">Wagen: {wagenNr} | Fahrer: {fahrerName}</p>
          </div>
        )}

        {error && !isSuccess && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold text-center animate-fade-in">⚠️ {error}</div>}

        {isSuccess && (
          <div className="text-center space-y-5 py-2 animate-fade-in">
            <div className="w-16 h-16 bg-green-50 text-green-500 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto text-3xl">✓</div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-green-600">Fahrt verbucht!</h2>
              <p className="text-gray-500 text-xs px-4">Transportschein und Signatur wurden digital erfasst.</p>
            </div>

            {scannedRide && scannedRide.zuzahlung_betrag > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                  <span>⚠️ Achtung: Zuzahlung kassieren!</span>
                </div>
                <p className="text-xs text-amber-700">Der Patient ist nicht zuzahlungsbefreit. Bitte fordere den gesetzlichen Eigenanteil ein:</p>
                <div className="text-2xl font-black text-amber-600 text-center py-2">
                  {scannedRide.zuzahlung_betrag.toFixed(2).replace('.', ',')} €
                </div>
              </div>
            )}

            {scannedRide && (
              <div className="bg-gray-50 p-4 rounded-xl text-left border border-gray-200 text-xs text-gray-600 space-y-1">
                <p><b>Patient:</b> {scannedRide.patient_vorname} {scannedRide.patient_nachname}</p>
                <p><b>Krankenkasse:</b> {scannedRide.kasse_name}</p>
                <p><b>Strecke:</b> {scannedRide.fahrt_von} → {scannedRide.fahrt_nach}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={() => alert("PDF wird generiert.")} className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-xl text-xs font-bold border border-gray-200 transition-all">📄 PDF-Quittung</button>
              <button onClick={() => alert("EDIFACT bereitgestellt.")} className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-xl text-xs font-bold border border-gray-200 transition-all">⚙️ EDIFACT</button>
            </div>
            <hr className="my-4 border-gray-100" />
            <button onClick={handleNaechsteFahrt} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold shadow-lg transition-all">Nächsten Fahrgast scannen</button>
          </div>
        )}

        {!isScanning && !scannedRide && !isSuccess && (
          <div className="text-center space-y-6 mt-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto text-3xl">📷</div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Neuer Fahrgast?</h2>
              <p className="text-gray-500 text-sm mt-1">Scanne den QR-Code vom Smartphone des Patienten.</p>
            </div>
            <button onClick={() => setIsScanning(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold shadow-lg transition-all">
              QR-Code scannen
            </button>
          </div>
        )}

        <div className={`text-center space-y-4 ${isScanning && !isSuccess ? 'block animate-fade-in' : 'hidden'}`}>
          <div id="reader" className="overflow-hidden rounded-xl border border-gray-200 shadow-sm w-full bg-white"></div>
          <button onClick={() => setIsScanning(false)} className="mt-2 text-sm text-gray-500 font-bold hover:text-red-500 transition-colors w-full p-2">Abbrechen</button>
        </div>

        {loading && !isSuccess && <p className="text-center text-blue-600 text-sm font-bold mt-10 animate-pulse">E-KTS wird verifiziert...</p>}
        
        {scannedRide && !isSuccess && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-blue-50 text-blue-700 p-3 rounded-xl text-sm font-bold text-center border border-blue-100">
              E-KTS erfolgreich geladen!
            </div>
            
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2 text-sm">
              <p><span className="text-gray-500 w-24 inline-block">Patient:</span> <b>{scannedRide.patient_vorname} {scannedRide.patient_nachname}</b></p>
              <p><span className="text-gray-500 w-24 inline-block">Kasse:</span> <b>{scannedRide.kasse_name}</b></p>
              <p><span className="text-gray-500 w-24 inline-block">Von:</span> <b>{scannedRide.fahrt_von}</b></p>
              <p><span className="text-gray-500 w-24 inline-block">Nach:</span> <b>{scannedRide.fahrt_nach}</b></p>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-2">
              <label className="block text-sm font-bold text-gray-700">Unterschrift Patient (Bestätigung):</label>
              <div className="relative bg-white border border-gray-300 rounded-xl overflow-hidden shadow-sm">
                <canvas
                  ref={canvasRef}
                  width={350}
                  height={150}
                  className="w-full h-[150px] cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={clearCanvas} className="w-1/3 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-xl text-xs font-bold transition-all">Löschen</button>
                <button type="button" onClick={saveSignature} className={`w-2/3 p-2 rounded-xl text-xs font-bold shadow-sm transition-all ${signatureImage ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'}`}>
                  {signatureImage ? '✓ Gespeichert' : 'Unterschrift bestätigen'}
                </button>
              </div>
            </div>

            <button onClick={handleFahrtAbschliessen} className={`w-full p-3 rounded-xl font-bold shadow-lg mt-2 transition-all ${signatureImage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`} disabled={!signatureImage}>
              Fahrt abschließen
            </button>
          </div>
        )}

      </div>
    </div>
  );
}