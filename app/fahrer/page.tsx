"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('./QrScanner'), { ssr: false });

type Step =
  | 'scan'          // 1. QR scannen
  | 'formular'      // 2. Fahrtdetails (ohne km)
  | 'fahrt_laeuft'  // 3. Fahrt läuft (Wartezustand)
  | 'abschluss_km'  // 4. km eingeben + Preis
  | 'uebersicht'    // 5. Zusammenfassung
  | 'unterschrift'  // 6. Patient unterschreibt
  | 'fertig';       // 7. Erfolg

export default function FahrerPage() {
  const router = useRouter();

  const [fahrerName, setFahrerName] = useState('');
  // Wagennummer entfernt — Identifikation läuft ausschließlich über fahrer_id (Session)

  const [step, setStep]             = useState<Step>('scan');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const [verordnung, setVerordnung] = useState<any>(null);
  const [tarif, setTarif]           = useState<any>(null);
  // hinweis kommt von GET /api/kts/[id] wenn Status = hinfahrt_abgeschlossen (US-2.3)
  const [hinweis, setHinweis]       = useState<any>(null);

  // fahrt_von/fahrt_nach sind KEIN Formularfeld mehr — kommen vollständig
  // aus der Verordnung, inkl. automatischem Tausch bei Rückfahrt (US-4.2 AC1/AC3)
  const [fahrtdatum, setFahrtdatum] = useState(
    new Date().toISOString().slice(0, 10)
  );
  // Manueller Override für die Von/Nach-Zuordnung — Korrektur zu US-4.2 AC3
  const [manuellerTausch, setManuellerTausch] = useState(false);

  // Abschluss-Felder
  const [kmEinfach, setKmEinfach]     = useState('');
  const [kmIdentisch, setKmIdentisch] = useState(true);
  const [kmKommentar, setKmKommentar] = useState('');
  const [preis, setPreis]             = useState<any>(null);
  // preisGesamt: Gesamtbetrag Hin+Rück — nur für Info-Anzeige beim Fahrer,
  // Zuzahlung und Dashboard/EDIFACT (gleicher Fahrer, fahrtrichtung='beide')
  const [preisGesamt, setPreisGesamt] = useState<any>(null);
  const [infoOffen, setInfoOffen]     = useState(false);

  // Unterschrift
  const canvasRef                   = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Scanner
  const [scanModus, setScanModus]           = useState<'kamera' | 'manuell'>('kamera');
  const [manuelleId, setManuelleId]         = useState('');
  const [scannerFehler, setScannerFehler]   = useState('');

  // ============================================================
  // Fahrtrichtung wird NICHT vom Fahrer gewählt, sondern aus
  // Verordnung + Status abgeleitet (Ergänzung zu US-4.2 AC5).
  // Der Server bestimmt das unabhängig noch einmal (US-4.7/US-4.8) —
  // diese Werte hier sind reine Anzeige, keine Quelle der Wahrheit.
  // ============================================================
  const istRueckfahrtScan = verordnung?.status === 'hinfahrt_abgeschlossen';
  const istGleicherFahrer = hinweis?.gleicher_fahrer === true;

  const fahrtrichtung: 'hinfahrt' | 'rueckfahrt' | 'beide' = istRueckfahrtScan
    ? (istGleicherFahrer ? 'beide' : 'rueckfahrt')
    : (verordnung?.hinfahrt === 1 ? 'hinfahrt' : 'rueckfahrt');

  // Adress-Tausch: Bei Rückfahrt nehmen wir die tatsächlich gefahrenen
  // Adressen der Hinfahrt (aus hinweis) und kehren sie um — nicht die
  // Original-AIS-Adressen. Das ist wichtig wenn der Fahrer bei der Hinfahrt
  // manuell getauscht hat: dann war die Hinfahrt z.B. Beta→Alpha, und die
  // Rückfahrt muss Alpha→Beta sein (Umkehrung der tatsächlichen Fahrt).
  let fahrtVon: string;
  let fahrtNach: string;

  if (istRueckfahrtScan && hinweis?.hinfahrt_von && hinweis?.hinfahrt_nach) {
    // Rückfahrt: Umkehrung der tatsächlich gefahrenen Hinfahrt-Adressen
    const basisVon  = manuellerTausch ? hinweis.hinfahrt_nach : hinweis.hinfahrt_nach;
    const basisNach = manuellerTausch ? hinweis.hinfahrt_von  : hinweis.hinfahrt_von;
    fahrtVon  = basisVon;
    fahrtNach = basisNach;
  } else {
    // Hinfahrt: Original-AIS-Adressen, mit optionalem manuellen Tausch
    const automatischGetauscht = false;
    const effektivGetauscht = manuellerTausch ? !automatischGetauscht : automatischGetauscht;
    fahrtVon  = effektivGetauscht ? verordnung?.fahrt_nach : verordnung?.fahrt_von;
    fahrtNach = effektivGetauscht ? verordnung?.fahrt_von  : verordnung?.fahrt_nach;
  }

  const kmMultiplikator = fahrtrichtung === 'beide' ? 2 : 1;

  // Pflicht-Kommentar bei km-Abweichung — nur relevant wenn gleicher Fahrer
  // Hin+Rück fährt (US-3.1 AC10)
  const hinfahrtKmGerundet = hinweis?.hinfahrt_km != null ? Math.ceil(hinweis.hinfahrt_km) : null;
  const kmEinfachGerundet  = kmEinfach ? Math.ceil(Number(kmEinfach)) : null;
  // TASK-03: Pflicht-Kommentar nur wenn Checkbox "nicht identisch" + km weichen ab
  const kommentarPflicht =
    fahrtrichtung === 'beide' &&
    !kmIdentisch &&
    hinfahrtKmGerundet != null &&
    kmEinfachGerundet != null &&
    kmEinfachGerundet !== hinfahrtKmGerundet;

  const fahrtrichtungLabel =
    fahrtrichtung === 'hinfahrt' ? 'Hinfahrt' :
    fahrtrichtung === 'rueckfahrt' ? 'Rückfahrt' : 'Hin + Rück';

  const fahrtrichtungFarbe =
    fahrtrichtung === 'hinfahrt' ? 'bg-blue-100 text-blue-700 border-blue-200' :
    fahrtrichtung === 'rueckfahrt' ? 'bg-green-100 text-green-700 border-green-200' :
    'bg-purple-100 text-purple-700 border-purple-200';

  useEffect(() => {
    const ladeSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) { router.push('/login'); return; }
        const data = await res.json();
        if (data.role !== 'fahrer') { router.push('/login'); return; }
        setFahrerName(`${data.fahrer.vorname} ${data.fahrer.nachname}`);
      } catch { router.push('/login'); }
    };
    ladeSession();
  }, [router]);

  // Live-Preisberechnung (nur im abschluss_km Schritt)
  useEffect(() => {
    if (!tarif) { setPreis(null); setPreisGesamt(null); return; }

    let kmBasis: number | null = null;
    if (fahrtrichtung === 'beide' && kmIdentisch) {
      if (!hinweis?.hinfahrt_km) { setPreis(null); setPreisGesamt(null); return; }
      kmBasis = Math.ceil(hinweis.hinfahrt_km);
    } else {
      if (!kmEinfach || isNaN(Number(kmEinfach))) { setPreis(null); setPreisGesamt(null); return; }
      kmBasis = Math.ceil(Number(kmEinfach));
    }

    const pflichtig =
      verordnung?.zuzahlungspflichtig === 1 &&
      verordnung?.zuzahlungsbefreit   === 0;
    const grund   = tarif.grundpauschale ?? 12.20;
    const kmPreis = tarif.preis_pro_zusatz_km ?? 2.39;

    const berechneFahrt = (km: number) => {
      const zusatzKm = Math.max(0, km - 5);
      const strecke  = Math.round(zusatzKm * kmPreis * 100) / 100;
      const brutto   = Math.round((grund + strecke) * 100) / 100;
      let zuzahlung  = 0;
      if (pflichtig) {
        const roh = brutto * 0.10;
        zuzahlung = Math.round(Math.max(5.00, Math.min(10.00, roh)) * 100) / 100;
      }
      return { grundpauschale: grund, streckenpreis: strecke, gesamt_brutto: brutto,
               zuzahlung, gesamt_netto: Math.round((brutto - zuzahlung) * 100) / 100,
               km_abgerechnet: km };
    };

    if (fahrtrichtung === 'beide') {
      // Fahrer sieht Einzelpreis der Rückfahrt mit eigener Zuzahlung.
      // preisGesamt nur für das Info-Popup (Gesamtübersicht Hin+Rück).
      const einzelPreis = berechneFahrt(kmBasis);
      const gesamtPreis = berechneFahrt(kmBasis * 2);
      setPreis(einzelPreis);
      setPreisGesamt(gesamtPreis);
    } else {
      setPreis(berechneFahrt(kmBasis));
      setPreisGesamt(null);
    }
  }, [kmEinfach, kmIdentisch, tarif, verordnung, kmMultiplikator, fahrtrichtung, hinweis]);

  const handleScan = async (ktsId: string) => {
    setLoading(true); setError(''); setScannerFehler('');
    try {
      const res = await fetch(`/api/kts/${ktsId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerordnung(data.verordnung);
      setTarif(data.tarif);
      setHinweis(data.hinweis);
      setStep('formular');
    } catch (err: any) {
      setError(err.message);
      setScanModus('kamera');
    } finally { setLoading(false); }
  };

  const handleManuelleEingabe = (e: React.FormEvent) => {
    e.preventDefault();
    if (manuelleId.trim()) handleScan(manuelleId.trim());
  };

  const handleAbschliessen = async () => {
    if (!hasSignature) return;
    setLoading(true); setError('');
    try {
      const canvas = canvasRef.current;
      const unterschrift_blob = canvas?.toDataURL('image/png') ?? '';

      // TASK-03: Bei Rückfahrt gleicher Fahrer — Checkbox oder km-Wert senden
      const payload: any = {
        verordnung_id: verordnung.id,
        fahrt_von: fahrtVon,
        fahrt_nach: fahrtNach,
        fahrtdatum,
        km_kommentar: kmKommentar.trim() || null,
        unterschrift_blob,
      };
      if (fahrtrichtung === 'beide' && kmIdentisch) {
        payload.km_identisch_hinfahrt = true;
      } else {
        payload.km_einfach = Number(kmEinfach);
      }

      const res = await fetch('/api/fahrten/abschliessen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep('fertig');
    } catch (err: any) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  // Canvas
  const getXY = (e: React.MouseEvent | React.TouchEvent, rect: DOMRect) => {
    if ('touches' in e) return {
      x: e.touches[0].clientX - rect.left,
      y: e.touches[0].clientY - rect.top
    };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    setIsDrawing(true); setHasSignature(true);
    const { x, y } = getXY(e, canvas.getBoundingClientRect());
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const { x, y } = getXY(e, canvas.getBoundingClientRect());
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e3a5f';
    ctx.lineTo(x, y); ctx.stroke();
  };
  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const resetFahrt = () => {
    setStep('scan'); setVerordnung(null); setTarif(null); setHinweis(null);
    setKmEinfach(''); setKmIdentisch(true); setKmKommentar(''); setManuellerTausch(false);
    setPreis(null); setPreisGesamt(null); setInfoOffen(false); setHasSignature(false);
    setError('');
    setManuelleId(''); setScanModus('kamera');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 border border-gray-100">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold text-blue-600">MEINTAXI</h1>
            <p className="text-xs text-gray-500">{fahrerName}</p>
          </div>
          <button onClick={handleLogout} className="text-xs text-red-500 hover:text-red-700 font-bold">
            Ausloggen
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-semibold">
            ⚠️ {error}
          </div>
        )}

        {/* ======= SCHRITT 1: QR SCAN ======= */}
        {step === 'scan' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 text-center">QR-Code scannen</h2>
            <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-xl gap-1">
              <button type="button" onClick={() => { setScanModus('kamera'); setScannerFehler(''); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${scanModus === 'kamera' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                📷 Kamera
              </button>
              <button type="button" onClick={() => setScanModus('manuell')}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${scanModus === 'manuell' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                ⌨️ Manuell
              </button>
            </div>
            {scanModus === 'kamera' && (
              <div className="space-y-3">
                {scannerFehler ? (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                    <p className="text-red-600 text-sm font-semibold">⚠️ {scannerFehler}</p>
                    <button onClick={() => setScanModus('manuell')} className="text-xs text-blue-600 underline mt-2">
                      Manuell eingeben
                    </button>
                  </div>
                ) : (
                  <QrScanner onScan={handleScan} onError={setScannerFehler} />
                )}
                <p className="text-xs text-center text-blue-600">
                  Patient bittet, QR-Code in der MEINTAXI App zu öffnen.
                </p>
              </div>
            )}
            {scanModus === 'manuell' && (
              <form onSubmit={handleManuelleEingabe} className="space-y-3">
                <input type="text" placeholder="KTS-ID eingeben..."
                  value={manuelleId} onChange={e => setManuelleId(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                <button type="submit" disabled={loading || !manuelleId.trim()}
                  className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
                  {loading ? 'Lade...' : 'Verordnung laden'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ======= SCHRITT 2: FORMULAR (ohne km) ======= */}
        {step === 'formular' && verordnung && (
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
              <p className="text-sm font-bold text-blue-800">
                {verordnung.patient_vorname} {verordnung.patient_nachname}
              </p>
              <p className="text-xs text-blue-600">
                {verordnung.kasse_name} · {verordnung.befoerderungsart}
              </p>
            </div>

            {/* Fahrtrichtung — reine Anzeige, nicht editierbar (US-4.2 AC5) */}
            <div className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${fahrtrichtungFarbe}`}>
              {fahrtrichtungLabel}
            </div>

            {hinweis && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700">
                {hinweis.nachricht}
              </div>
            )}

            <div className="space-y-1">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrt von</label>
                <div className="w-full p-3 border rounded-xl text-sm bg-gray-50 text-gray-700">
                  {fahrtVon}
                </div>
              </div>
              {/* TASK-02: Tausch-Button nur bei Hinfahrt — bei Rückfahrt
                  tauscht das System automatisch, kein manueller Eingriff */}
              {!istRueckfahrtScan && (
                <div className="flex justify-center -my-1 relative z-10">
                  <button type="button" onClick={() => setManuellerTausch(t => !t)}
                    title="Von/Nach tauschen, falls die Verordnung die Adressen andersherum hinterlegt hat"
                    className="bg-white border-2 border-gray-200 rounded-full w-8 h-8 flex items-center justify-center text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm">
                    ⇄
                  </button>
                </div>
              )}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrt nach</label>
                <div className="w-full p-3 border rounded-xl text-sm bg-gray-50 text-gray-700">
                  {fahrtNach}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fahrtdatum</label>
                <input type="date" value={fahrtdatum} onChange={e => setFahrtdatum(e.target.value)}
                  className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 text-center">
              💡 Tarif: {tarif?.kasse_name ?? 'vdek-NRW'} · {tarif?.grundpauschale ?? 12.20} € Grundpauschale · {tarif?.preis_pro_zusatz_km ?? 2.39} € / km ab km 6
            </div>
            <button onClick={() => setStep('fahrt_laeuft')}
              disabled={!fahrtdatum}
              className="w-full bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all text-lg">
              🚕 Fahrt starten
            </button>
          </div>
        )}

        {/* ======= SCHRITT 3: FAHRT LÄUFT ======= */}
        {step === 'fahrt_laeuft' && verordnung && (
          <div className="space-y-5 text-center">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-200">
              <div className="text-4xl mb-3 animate-pulse">🚕</div>
              <p className="font-bold text-green-800 text-lg">Fahrt läuft</p>
              <p className="text-sm text-green-600 mt-1">
                {verordnung.patient_vorname} {verordnung.patient_nachname}
              </p>
              <p className="text-xs text-green-500 mt-2">
                {fahrtVon} → {fahrtNach}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border text-xs text-gray-500">
              <p>Du kannst das Gerät jetzt weglegen.</p>
              <p className="mt-1">Klicke auf "Am Zielort angekommen" wenn die Fahrt beendet ist.</p>
            </div>
            <button onClick={() => setStep('abschluss_km')}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold hover:bg-blue-700 transition-all text-base">
              📍 Am Zielort angekommen
            </button>
          </div>
        )}

        {/* ======= SCHRITT 4: KM EINGABE + PREIS ======= */}
        {step === 'abschluss_km' && verordnung && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Fahrt abschließen</h2>
            <p className="text-xs text-gray-500">
              {verordnung.patient_vorname} {verordnung.patient_nachname} ·
              {fahrtVon} → {fahrtNach}
            </p>
            {/* TASK-03: Bei Rückfahrt gleicher Fahrer → Checkbox-Ansatz.
                Bei Hinfahrt oder anderem Fahrer → normale km-Eingabe */}
            {fahrtrichtung === 'beide' ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-xs font-bold text-purple-700">Referenz Hinfahrt</p>
                  <p className="text-lg font-bold text-purple-900">{hinfahrtKmGerundet} km</p>
                </div>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={kmIdentisch}
                    onChange={e => { setKmIdentisch(e.target.checked); setKmEinfach(''); setKmKommentar(''); }}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    Kilometer sind identisch ({hinfahrtKmGerundet} km)
                  </span>
                </label>
                {!kmIdentisch && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block font-semibold">
                      Abweichende Kilometer vom Taxameter
                    </label>
                    <input type="number" placeholder="z.B. 12" value={kmEinfach}
                      onChange={e => setKmEinfach(e.target.value)} min="0" step="0.1"
                      className="w-full p-4 border-2 border-red-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-red-400 outline-none" />
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs text-gray-500 mb-1 block font-semibold">
                  Kilometer vom Taxameter
                </label>
                <input type="number" placeholder="z.B. 12" value={kmEinfach}
                  onChange={e => setKmEinfach(e.target.value)} min="0" step="0.1"
                  className="w-full p-4 border-2 border-blue-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            )}

            {preis && (
              <div className="p-4 bg-gray-50 rounded-xl border space-y-2 text-sm">
                {fahrtrichtung === 'beide' && (
                  <div className="flex justify-between items-center pb-1 border-b">
                    <span className="text-xs font-bold text-purple-700">Rückfahrt</span>
                    <button
                      type="button"
                      onClick={() => setInfoOffen(o => !o)}
                      className="text-[10px] text-purple-600 underline">
                      {infoOffen ? 'Info ausblenden' : 'ℹ️ Hin+Rück Gesamt anzeigen'}
                    </button>
                  </div>
                )}
                {infoOffen && preisGesamt && (
                  <div className="p-2 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-800 space-y-1">
                    <p className="font-bold">Hin- und Rückfahrt gesamt ({preisGesamt.km_abgerechnet} km)</p>
                    <div className="flex justify-between"><span>Grundpauschale</span><span>{preisGesamt.grundpauschale.toFixed(2)} €</span></div>
                    {preisGesamt.streckenpreis > 0 && (
                      <div className="flex justify-between"><span>Strecke ab km 6</span><span>{preisGesamt.streckenpreis.toFixed(2)} €</span></div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1"><span>Gesamt</span><span>{preisGesamt.gesamt_brutto.toFixed(2)} €</span></div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Grundpauschale (km 1–5)</span>
                  <span className="font-semibold">{preis.grundpauschale.toFixed(2)} €</span>
                </div>
                {preis.streckenpreis > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Strecke ab km 6 ({preis.km_abgerechnet - 5} km × {tarif?.preis_pro_zusatz_km ?? 2.39} €)
                    </span>
                    <span className="font-semibold">{preis.streckenpreis.toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Gesamt Brutto</span>
                  <span className="font-bold">{preis.gesamt_brutto.toFixed(2)} €</span>
                </div>
                {preis.zuzahlung > 0 ? (
                  <div className="p-2 bg-red-50 rounded-lg text-center">
                    <span className="text-red-600 font-bold">
                      ⚠️ Patient zahlt: {preis.zuzahlung.toFixed(2)} € Zuzahlung
                    </span>
                  </div>
                ) : (
                  <div className="p-2 bg-green-50 rounded-lg text-center text-green-600 text-xs font-semibold">
                    ✓ Von Zuzahlung befreit
                  </div>
                )}
              </div>
            )}

            {/* Bemerkung zur Strecke — bei km-Abweichung zwischen Hin- und
                Rückfahrt des gleichen Fahrers Pflichtfeld (US-3.1 AC10) */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block font-semibold">
                Bemerkung zur Strecke {kommentarPflicht
                  ? '(Pflicht — Kilometer weichen von der Hinfahrt ab)'
                  : '(optional, z.B. Umleitung)'}
              </label>
              {fahrtrichtung === 'beide' && hinfahrtKmGerundet != null && (
                <p className="text-xs text-gray-400 mb-1">
                  Hinfahrt: {hinfahrtKmGerundet} km · jetzt: {kmEinfachGerundet ?? '?'} km
                </p>
              )}
              <textarea value={kmKommentar} onChange={e => setKmKommentar(e.target.value)}
                placeholder="z.B. Umleitung wegen Baustelle" rows={2}
                className={`w-full p-3 border rounded-xl text-sm focus:ring-2 outline-none ${
                  kommentarPflicht ? 'border-red-300 focus:ring-red-400' : 'focus:ring-blue-500'
                }`} />
              {kommentarPflicht && !kmKommentar.trim() && (
                <p className="text-xs text-red-500 mt-1">
                  Kilometer weichen von der Hinfahrt ab — bitte kurz begründen.
                </p>
              )}
            </div>

            <button onClick={() => setStep('uebersicht')}
              disabled={
                !preis ||
                (fahrtrichtung === 'beide' && kmIdentisch ? false : !kmEinfach) ||
                (kommentarPflicht && !kmKommentar.trim())
              }
              className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all">
              Weiter zur Übersicht
            </button>
          </div>
        )}

        {/* ======= SCHRITT 5: ÜBERSICHT ======= */}
        {step === 'uebersicht' && verordnung && preis && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Übersicht für Patient</h2>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient</span>
                <span className="font-bold">{verordnung.patient_vorname} {verordnung.patient_nachname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Strecke</span>
                <span className="font-bold">{fahrtVon} → {fahrtNach}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kilometer</span>
                <span className="font-bold">{preis.km_abgerechnet} km</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">Gesamtkosten</span>
                <span className="font-bold">{preis.gesamt_brutto.toFixed(2)} €</span>
              </div>
              {preis.zuzahlung > 0 ? (
                <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-center">
                  <p className="text-red-700 font-bold">Es fällt eine gesetzliche Zuzahlung an:</p>
                  <p className="text-red-700 font-bold text-xl mt-1">{preis.zuzahlung.toFixed(2)} €</p>
                  <p className="text-red-500 text-xs mt-1">Bitte an den Fahrer entrichten.</p>
                </div>
              ) : (
                <div className="p-2 bg-green-50 rounded-lg text-center text-green-700 text-xs font-semibold">
                  ✓ Von Zuzahlung befreit
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('abschluss_km')}
                className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Zurück
              </button>
              <button onClick={() => setStep('unterschrift')}
                className="flex-1 bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
                Zur Unterschrift
              </button>
            </div>
          </div>
        )}

        {/* ======= SCHRITT 6: UNTERSCHRIFT ======= */}
        {step === 'unterschrift' && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800">Digitale Unterschrift</h2>
            <p className="text-sm text-gray-500">Bitte dem Patienten das Gerät zur Unterschrift vorlegen.</p>
            <canvas ref={canvasRef} width={380} height={180}
              className="w-full border-2 border-gray-300 rounded-xl bg-white touch-none cursor-crosshair"
              onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
              onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            <div className="flex gap-2">
              <button onClick={clearCanvas}
                className="flex-1 bg-gray-100 text-gray-700 p-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Löschen
              </button>
              <button onClick={handleAbschliessen} disabled={!hasSignature || loading}
                className="flex-1 bg-green-600 text-white p-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-all">
                {loading ? 'Speichere...' : 'Bestätigen'}
              </button>
            </div>
          </div>
        )}

        {/* ======= SCHRITT 7: FERTIG ======= */}
        {step === 'fertig' && (
          <div className="space-y-4 text-center">
            <div className="p-6 bg-green-50 rounded-2xl border border-green-100">
              <span className="text-4xl block mb-3">✅</span>
              <p className="font-bold text-green-800 text-lg">Fahrt erfolgreich dokumentiert!</p>
              <p className="text-sm text-green-600 mt-2">Wartet auf Freigabe durch das Taxiunternehmen.</p>
              {preis?.zuzahlung > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-amber-700 font-bold text-sm">
                    💰 Zuzahlung kassieren: {preis.zuzahlung.toFixed(2)} €
                  </p>
                </div>
              )}
            </div>
            <button onClick={resetFahrt}
              className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
              Neue Fahrt starten
            </button>
          </div>
        )}

      </div>
    </div>
  );
}