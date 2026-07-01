// @ts-nocheck
/* eslint-disable */

const C = {
  ais:         { bg: 'bg-amber-50',   border: 'border-amber-500',   label: 'bg-amber-500',   text: 'text-amber-900'  },
  patient:     { bg: 'bg-sky-50',     border: 'border-sky-500',     label: 'bg-sky-600',     text: 'text-sky-900'    },
  fahrer:      { bg: 'bg-blue-50',    border: 'border-blue-600',    label: 'bg-blue-600',    text: 'text-blue-900'   },
  system:      { bg: 'bg-slate-50',   border: 'border-slate-400',   label: 'bg-slate-500',   text: 'text-slate-800'  },
  unternehmer: { bg: 'bg-violet-50',  border: 'border-violet-500',  label: 'bg-violet-600',  text: 'text-violet-900' },
  gkv:         { bg: 'bg-emerald-50', border: 'border-emerald-600', label: 'bg-emerald-600', text: 'text-emerald-900'},
};
const LABEL = { ais:'AIS / Arzt', patient:'Patient', fahrer:'Fahrer', system:'System', unternehmer:'Taxiunternehmer', gkv:'GKV' };

function Badge({ actor }) {
  return <span className={`text-[9px] font-bold text-white rounded-full px-2 py-0.5 ${C[actor].label}`}>{LABEL[actor]}</span>;
}
function Box({ actor, title, detail }) {
  const c = C[actor];
  return (
    <div className={`border-2 rounded-xl p-3 w-full ${c.bg} ${c.border}`}>
      <Badge actor={actor} />
      <div className={`font-semibold text-sm mt-1 ${c.text}`}>{title}</div>
      {detail && <div className="text-[10px] text-gray-500 mt-0.5 leading-snug">{detail}</div>}
    </div>
  );
}
function Err({ title, detail }) {
  return (
    <div className="border-2 border-red-400 rounded-xl p-2 bg-red-50 w-full">
      <div className="text-xs font-bold text-red-800">⛔ {title}</div>
      {detail && <div className="text-[10px] text-red-600 mt-0.5 leading-snug">{detail}</div>}
    </div>
  );
}
function Ok({ title, detail }) {
  return (
    <div className="border-2 border-emerald-400 rounded-xl p-2 bg-emerald-50 w-full">
      <div className="text-xs font-bold text-emerald-800">✅ {title}</div>
      {detail && <div className="text-[10px] text-emerald-600 mt-0.5 leading-snug">{detail}</div>}
    </div>
  );
}
function SmallBox({ color, title, detail }) {
  const colors = {
    blue:'bg-blue-50 border-blue-500 text-blue-800', green:'bg-green-50 border-green-500 text-green-800',
    purple:'bg-purple-50 border-purple-500 text-purple-800', amber:'bg-amber-50 border-amber-400 text-amber-800',
    slate:'bg-slate-100 border-slate-400 text-slate-800', violet:'bg-violet-50 border-violet-400 text-violet-800',
  };
  return (
    <div className={`border-2 rounded-xl p-2 w-full ${colors[color]}`}>
      <div className="text-xs font-bold">{title}</div>
      {detail && <div className="text-[10px] mt-0.5 opacity-80 leading-snug">{detail}</div>}
    </div>
  );
}
function Arrow({ label }) {
  return (
    <div className="flex flex-col items-center my-0.5 flex-shrink-0">
      <div className="w-px h-4 bg-gray-400" />
      {label && <span className="text-[9px] text-gray-500 bg-white border border-gray-200 rounded px-1 my-0.5 whitespace-nowrap">{label}</span>}
      <div style={{width:0,height:0,borderLeft:'5px solid transparent',borderRight:'5px solid transparent',borderTop:'7px solid #9CA3AF'}}/>
    </div>
  );
}
function Decide({ q, small }) {
  const w = small ? 150 : 210, h = small ? 70 : 90;
  const cx = w/2, cy = h/2;
  return (
    <div className="flex flex-col items-center">
      <div className="w-px h-3 bg-gray-400" />
      <div style={{position:'relative',width:w,height:h}}>
        <svg width={w} height={h} style={{position:'absolute',inset:0}}>
          <polygon points={`${cx},4 ${w-4},${cy} ${cx},${h-4} 4,${cy}`} fill="#FFFBEB" stroke="#F59E0B" strokeWidth="2.5"/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontSize:small?9:11,fontWeight:'bold',color:'#92400E',textAlign:'center',lineHeight:1.3,padding:`0 ${small?20:36}px`}}>{q}</div>
        </div>
      </div>
      <div className="w-px h-2 bg-gray-400" />
    </div>
  );
}
function Fork({ paths }) {
  return (
    <div className="flex gap-2 w-full">
      {paths.map((p,i) => (
        <div key={i} className="flex-1 flex flex-col items-center min-w-0">
          <span className="text-[9px] font-bold text-center bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 mb-1">{p.label}</span>
          <div className="w-px h-3 bg-gray-400" />
          <div style={{width:0,height:0,borderLeft:'4px solid transparent',borderRight:'4px solid transparent',borderTop:'6px solid #9CA3AF'}} className="mb-1"/>
          <div className="w-full">{p.node}</div>
        </div>
      ))}
    </div>
  );
}
function Loop({ label }) {
  return (
    <div className="flex justify-center mt-1">
      <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-300 rounded-full px-3 py-1">
        <span className="text-indigo-500">↩</span>
        <span className="text-[10px] font-bold text-indigo-700">{label}</span>
      </div>
    </div>
  );
}
function Sep({ n, title }) {
  return (
    <div className="flex items-center gap-2 w-full my-3">
      <div className="h-px flex-1 bg-gray-200"/>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">Phase {n} · {title}</div>
      <div className="h-px flex-1 bg-gray-200"/>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4" style={{fontFamily:'system-ui,-apple-system,sans-serif'}}>
      <div className="max-w-2xl mx-auto space-y-1">

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center mb-4">
          <div className="text-2xl font-bold text-blue-700" style={{letterSpacing:'-0.02em'}}>MEINTAXI</div>
          <div className="text-sm text-gray-500 mt-0.5">Systemablauf · Digitale Krankenfahrt-Abrechnung §302 SGB V</div>
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            {Object.keys(C).map(k => <span key={k} className={`text-[9px] font-bold text-white rounded-full px-2 py-0.5 ${C[k].label}`}>{LABEL[k]}</span>)}
            <span className="text-[9px] font-bold text-amber-800 rounded-full px-2 py-0.5 border-2 border-amber-400 bg-amber-50">◆ Entscheidung</span>
            <span className="text-[9px] font-bold text-red-800 rounded-full px-2 py-0.5 bg-red-50 border-2 border-red-400">⛔ Fehler</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex flex-col items-center">

            <Sep n="1" title="Verordnungserstellung (AIS)" />
            <Box actor="ais" title="Verordnung übermitteln — POST /api/kts/create"
              detail="Patientendaten · KVNR (10-stellig) · IK-Kasse · BSNR / LANR · fahrt_von / fahrt_nach · Beförderungsart · Fahrtgrund a–f · Hinfahrt / Rückfahrt / Hin+Rück" />
            <Arrow />
            <Box actor="system" title="Verordnung erstellt"
              detail="kts_id (UUID) generiert · Status: offen · Rate-Limit 30/min · Validierung aller Pflichtfelder (HTTP 422 bei Fehler)" />

            <Sep n="2" title="Patienten-Ansicht (jederzeit)" />
            <Box actor="patient" title="App öffnen → QR-Code & Live-Status anzeigen"
              detail="⬤ Grau: offen — noch keine Fahrt  ·  ⬤ Amber: Hinfahrt durchgeführt ✓  ·  ⬤ Grün: Vollständig abgeschlossen (QR ausgegraut · DSGVO-Entsperrung medizinischer Details per Geburtsdatum)" />

            <Sep n="3" title="Fahrer-Scan" />
            <Box actor="fahrer" title="QR-Code scannen"
              detail="Kamera-Scanner oder manuelle kts_id-Eingabe · Ein Code pro Verordnung für alle Scans · JWT-Pflicht: nur eingeloggte, aktive Fahrer" />
            <Arrow label="GET /api/kts/[id]" />
            <Decide q={"Verordnungs-\nstatus?"} />

            <Fork paths={[
              { label: '"abgeschlossen"',
                node: <Err title="HTTP 409 — QR ungültig" detail="Verordnung vollständig abgerechnet. Scan nicht mehr möglich." /> },
              { label: '"offen" → erste Fahrt',
                node: <SmallBox color="blue" title="Hinfahrt-Formular" detail="🔵 Badge: Hinfahrt · fahrt_von/nach read-only aus Verordnung" /> },
              { label: '"hinfahrt_abgeschlossen"',
                node: <div className="flex flex-col items-center w-full gap-1">
                  <Decide q={"Gleicher\nFahrer?"} small />
                  <Fork paths={[
                    { label:'JA', node:<SmallBox color="purple" title="Hin+Rück-Formular" detail="🟣 Hin+Rück · gleicher_fahrer:true · hinfahrt_km geladen" /> },
                    { label:'NEIN', node:<SmallBox color="green" title="Rückfahrt-Formular" detail="🟢 Rückfahrt · Von/Nach automatisch getauscht" /> }
                  ]} />
                </div> }
            ]} />

            <Sep n="4" title="Fahrtdurchführung" />
            <Box actor="fahrer" title="Formular — Adressen sind read-only"
              detail="fahrt_von / fahrt_nach kommen immer aus der AIS-Verordnung · Nur Fahrtdatum editierbar · ⇄-Button für manuellen Adress-Tausch (Korrektur falls AIS Adressen andersherum liefert)" />
            <Arrow />
            <Box actor="fahrer" title="Fahrt startet — Gerät weglegen"
              detail="Patient zeigt QR-Code beim Einstieg · JWT-Session läuft 1h im Hintergrund" />
            <Arrow />
            <Box actor="fahrer" title="Am Zielort: km-Eingabe vom Taxameter"
              detail="Immer aufwärts gerundet: Math.ceil (z.B. 10,3 km → 11 km) · Gilt identisch im Frontend (Vorschau) und Backend (Abrechnung)" />
            <Arrow />
            <Decide q={"fahrtrichtung='beide'\nUND km ≠ Hinfahrt-km?"} />
            <Fork paths={[
              { label:'JA — km weichen ab',
                node:<div className="bg-red-50 border-2 border-red-300 rounded-xl p-2 w-full">
                  <div className="text-xs font-bold text-red-800">Pflichtkommentar</div>
                  <div className="text-[10px] text-red-600 mt-0.5">"Weiter"-Button gesperrt · Server prüft ebenfalls (HTTP 422) · Nur bei gleichem Fahrer Hin+Rück</div>
                </div> },
              { label:'NEIN',
                node:<div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-2 w-full">
                  <div className="text-xs font-bold text-gray-700">Optionaler Kommentar</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">z.B. Umleitung dokumentieren · Kein Einfluss auf Preis</div>
                </div> }
            ]} />
            <Arrow />
            <Box actor="system" title="Live-Preisberechnung"
              detail="vdek-NRW (ab 01.04.2026): 12,20 € Grundpauschale (km 1–5 inkl.) + 2,39 € / km ab km 6 · Zuzahlung: 10%, min 5 €, max 10 €" />
            <Arrow />
            <Box actor="patient" title="Zusammenfassung prüfen & digital unterschreiben"
              detail="Große Schrift · Roter Zuzahlungskasten falls pflichtig · Canvas-Unterschrift (Touch + Maus)" />
            <Arrow label="POST /api/fahrten/abschliessen" />
            <Box actor="system" title="Fahrt gespeichert"
              detail="Unterschrift-Hash: SHA256 · Zeitstempel · fahrtrichtung SERVERSEITIG bestimmt, nie vom Client (US-4.8) · freigabe_status: nicht_freigegeben · EDIFACT: NOCH NICHT — erst nach Freigabe" />

            <Sep n="5" title="Abschluss-Logik & Status-Update (Server)" />
            <Decide q={"War Status\n'offen'?\n(= erste Fahrt)"} />
            <Fork paths={[
              { label:'JA — erste Fahrt',
                node:<div className="flex flex-col items-center gap-1 w-full">
                  <Decide q={"Hin+Rück\nverordnet?"} small />
                  <Fork paths={[
                    { label:'JA', node:<div className="flex flex-col items-center gap-1 w-full">
                        <SmallBox color="amber" title="Status: hinfahrt_abgeschlossen" detail="QR-Code noch gültig für Rückfahrt-Scan" />
                        <Loop label="→ zurück zu Phase 3" />
                      </div> },
                    { label:'NEIN', node:<SmallBox color="slate" title="Status: abgeschlossen" detail="QR-Code dauerhaft ungültig" /> }
                  ]} />
                </div> },
              { label:'NEIN — Rückfahrt-Abschluss',
                node:<div className="flex flex-col items-center gap-1 w-full">
                  <Decide q={"Gleicher\nFahrer?"} small />
                  <Fork paths={[
                    { label:'JA',
                      node:<div className="space-y-1 w-full">
                        <SmallBox color="purple" title="Bündelung"
                          detail="Alter Eintrag → freigabe_status:'gebuendelt' (SHA256-Nachweis erhalten, NIE zur Freigabe angezeigt). Neuer Eintrag: fahrtrichtung='beide', km×2, 1 EDIFACT mit 2 ESK-Segmenten" />
                        <div className="border border-orange-200 rounded-lg p-1 bg-orange-50">
                          <div className="text-[9px] text-orange-700 font-semibold">⚠ Doppelabrechnung strukturell ausgeschlossen</div>
                        </div>
                      </div> },
                    { label:'NEIN',
                      node:<SmallBox color="green" title="Separate Abrechnung"
                        detail="fahrtrichtung='rueckfahrt' · Eigene km · Eigene EDIFACT · Jeder Fahrer rechnet nur seine Strecke ab" /> }
                  ]} />
                  <SmallBox color="slate" title="Status: abgeschlossen" detail="QR-Code dauerhaft ungültig" />
                </div> }
            ]} />

            <Sep n="6" title="Freigabe-Workflow (Taxiunternehmer)" />
            <Box actor="unternehmer" title="Dashboard: Freigabe-Queue"
              detail="Nur freigabe_status='nicht_freigegeben' sichtbar · 'gebuendelt'-Einträge NIE angezeigt · Patient, Fahrer, Strecke, km + Kommentar, Preis · Farbige Fahrtrichtung: 🔵 Hin / 🟢 Rück / 🟣 Hin+Rück" />
            <Arrow />
            <Decide q={"Unternehmer-\nEntscheidung?"} />
            <Fork paths={[
              { label:'ABLEHNEN',
                node:<Err title="Abgelehnt" detail="freigabe_status: abgelehnt · Begründung gespeichert · Fahrer sieht Ablehnungsgrund" /> },
              { label:'FREIGEBEN',
                node:<div className="flex flex-col items-center gap-1 w-full">
                  <SmallBox color="violet" title="Freigegeben" detail="EDIFACT wird jetzt generiert" />
                  <Arrow />
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 my-1">Phase 7 · EDIFACT & GKV</div>
                  <Decide q={"fahrtrichtung\n= 'beide'?"} small />
                  <Fork paths={[
                    { label:'JA — gleicher Fahrer',
                      node:<div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-2 text-center w-full">
                        <div className="text-xs font-bold text-slate-700">1 EDIFACT-Datei</div>
                        <div className="text-[10px] text-slate-500">2 ESK-Segmente (Hin + Rück)</div>
                      </div> },
                    { label:'NEIN — Einzelfahrt',
                      node:<div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-2 text-center w-full">
                        <div className="text-xs font-bold text-slate-700">1 EDIFACT-Datei</div>
                        <div className="text-[10px] text-slate-500">1 ESK-Segment</div>
                      </div> }
                  ]} />
                  <Arrow />
                  <Box actor="system" title="Signieren + Übermitteln"
                    detail="Format SLGA/SLLA:E · Anlage 3 V21 · HMAC-SHA256 · X-Signature Header · HTTPS POST an GKV-Datenannahmestelle (Prototyp: Mock-Endpoint)" />
                  <Arrow />
                  <Decide q={"GKV-\nAntwort?"} small />
                  <Fork paths={[
                    { label:'SUCCESS', node:<Ok title="GKV übermittelt" detail="gkv_status: success · Referenz-ID · Dashboard: '↗ GKV übermittelt'" /> },
                    { label:'FAILED', node:<Err title="Fehlgeschlagen" detail="gkv_status: failed · Fehler-Queue · Retry möglich" /> }
                  ]} />
                </div> }
            ]} />

            <Arrow />
            <div className="bg-emerald-600 text-white rounded-xl p-4 text-center w-full max-w-md">
              <div className="font-bold">🏁 Abrechnung abgeschlossen</div>
              <div className="text-xs mt-1 text-emerald-100">GKV zahlt direkt an Taxiunternehmen · 1–3 Werktage · Kein Clearinghaus (DMRZ) nötig</div>
            </div>

          </div>
        </div>

        {/* Architektur-Notizen */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mt-4">
          <div className="text-sm font-bold text-gray-700 mb-3">🔑 Schlüssel-Architekturentscheidungen</div>
          <div className="space-y-2">
            {[
              {color:'bg-blue-600',    label:'Fahrtrichtung (US-4.7/4.8)', text:'Serverseitig aus Verordnungsstatus + fahrer_id-Vergleich bestimmt — kein Client-Parameter (verhindert Abrechnungsbetrug via direktem API-Call)'},
              {color:'bg-purple-600',  label:'Bündelung (US-4.7 AC2)',     text:'Alter Hinfahrt-Eintrag als gebuendelt markiert, nie im Dashboard gezeigt — SHA256-Nachweis erhalten, Doppelabrechnung strukturell ausgeschlossen'},
              {color:'bg-amber-500',   label:'km-Rundung (US-3.1 AC2)',    text:'Math.ceil immer — Taxameter-Wert aufwärts gerundet (z.B. 10,3 km → 11 km). Frontend-Vorschau und Backend-Abschluss identisch'},
              {color:'bg-red-600',     label:'EDIFACT-Zeitpunkt (US-5.1)', text:'EDIFACT erst nach Freigabe durch Taxiunternehmer — niemals beim Fahrtabschluss'},
              {color:'bg-slate-500',   label:'Adressen (TASK-ADDR-01)',    text:'fahrt_von / fahrt_nach immer aus AIS-Verordnung — Fahrer-Eingabe technisch nicht möglich. Nur ⇄-Tausch-Button als Korrektur'},
              {color:'bg-emerald-600', label:'Verschiedene Fahrer',        text:'Jeder Fahrer rechnet nur seine eigene Strecke ab — Doppelkarte technisch ausgeschlossen (wäre GKV-Abrechnungsbetrug)'},
              {color:'bg-sky-500',     label:'Ein QR-Code pro Verordnung', text:'kts_id bleibt für Hin- und Rückfahrt identisch — status-abhängige Antwort statt HTTP 409 bei Zwischenstatus'},
            ].map((item,i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className={`text-[9px] font-bold text-white rounded-full px-2 py-0.5 mt-0.5 shrink-0 ${item.color}`}>{item.label}</span>
                <span className="text-[11px] text-gray-600 leading-snug">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center text-[10px] text-gray-400 pb-4">MEINTAXI · Backlog v5 · Stand 22.06.2026 · §302 SGB V</div>
      </div>
    </div>
  );
}