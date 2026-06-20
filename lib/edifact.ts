/**
 * MEINTAXI – EDIFACT Generator
 * §302 SGB V · Format SLGA/SLLA:E · Technische Anlage 3 Version 21
 */

export interface EdifactInput {
  // Übertragung
  ik_taxi:        string;   // IK des Transportunternehmens (9-stellig)
  ik_kasse:       string;   // IK der Krankenkasse (9-stellig)
  datei_referenz: string;   // fortlaufende Nummer z.B. "00001"

  // Rechnung
  rechnungsnummer: string;  // z.B. "RN20250722001"
  fahrtdatum:      string;  // ISO: "2025-07-22"

  // Versicherter
  patient_nachname:    string;
  patient_vorname:     string;
  patient_geburtsdatum: string; // ISO: "1958-03-14"
  versichertenstatus:  string;  // "1000" / "3000" / "5000"
  patient_kvnr:        string;  // 10-stellig

  // Verordnung
  arzt_lanr:        string;  // 9-stellig
  arzt_bsnr:        string;  // 9-stellig
  verordnungsdatum: string;  // ISO: "2025-07-22"

  // Fahrt & Preisberechnung
  km_einfach:    number;
  grundpauschale: number;
  streckenpreis:  number;
  gesamt_brutto:  number;
  zuzahlung:      number;
  gesamt_netto:   number;
}

export interface EdifactErgebnis {
  inhalt:    string;  // fertiger EDIFACT-String
  dateiname: string;  // z.B. DTA_999888777_20250722_001.txt
}

// Umlaute konvertieren (ISO-8859-1 Pflicht bei §302)
function konvertiereUmlaute(text: string): string {
  return text
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .toUpperCase();
}

// ISO-Datum → JJJJMMTT (z.B. "2025-07-22" → "20250722")
function formatDatum(iso: string): string {
  return iso.replace(/-/g, '');
}

// ISO-Datum → JJMM (für REC-Segment)
function formatJJMM(iso: string): string {
  const d = new Date(iso);
  const jj = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${jj}${mm}`;
}

// Aktuelles Datum JJJJMMTT
function heuteDatum(): string {
  return formatDatum(new Date().toISOString().slice(0, 10));
}

// Aktuelle Uhrzeit HHMM
function heuteUhrzeit(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
}

// Betrag formatieren: 2 Nachkommastellen mit Punkt (z.B. 8.50)
function formatBetrag(wert: number): string {
  return wert.toFixed(2);
}

/**
 * Hauptfunktion: EDIFACT-Datei generieren
 */
export function generiereEdifact(input: EdifactInput): EdifactErgebnis {
  const heute     = heuteDatum();
  const uhrzeit   = heuteUhrzeit();
  const fahrtJJMM = formatJJMM(input.fahrtdatum);
  const fahrtDat  = formatDatum(input.fahrtdatum);
  const verdDat   = formatDatum(input.verordnungsdatum);
  const gebDat    = formatDatum(input.patient_geburtsdatum);

  const nachname  = konvertiereUmlaute(input.patient_nachname);
  const vorname   = konvertiereUmlaute(input.patient_vorname);

  const belegnr   = `BEL${input.datei_referenz}`;
  const rechnr    = `RECH${input.datei_referenz}`;

  // Kilometeranteil: ganzzahlig (Anzahl Zusatz-km)
  const zusatzKm  = Math.max(0, Math.round(input.km_einfach) - 5);

  const segmente: string[] = [
    // Datei-Header
    `UNA:+.? '`,
    `UNB+UNOC:3+${input.ik_taxi}:30+${input.ik_kasse}:30+${heute}:${uhrzeit}+${input.datei_referenz}'`,

    // SLGA – Sammelrechnung
    `UNH+1+SLGA:5:1:GKV'`,
    `FKT+01+01+${input.ik_taxi}+${input.ik_kasse}'`,
    `REC+${rechnr}+1+${fahrtJJMM}'`,
    `SRD+T'`,
    `UNT+5+1'`,

    // SLLA:E – Einzelabrechnung
    `UNH+2+SLLA:5:1:GKV'`,
    `FKT+01+01+${input.ik_taxi}+${input.ik_kasse}'`,
    `REC+${belegnr}+1+${fahrtJJMM}'`,
    `INV+${nachname}+${vorname}+${gebDat}+${input.versichertenstatus}+${input.patient_kvnr}'`,
    `NAD+${input.ik_taxi}'`,
    `SRD+T'`,
    `SKO+${input.arzt_lanr}+${input.arzt_bsnr}+${verdDat}'`,

    // Grundpauschale (km 1–5 inkludiert)
    `ESK+${fahrtDat}+${fahrtDat}+510000+1+0.00+${formatBetrag(input.grundpauschale)}+0.00'`,

    // Kilometerpauschale (ab km 6)
    `ESK+${fahrtDat}+${fahrtDat}+530000+${zusatzKm}+0.00+${formatBetrag(input.streckenpreis)}+0.00'`,

    // Belegsumme
    `BES+1+${formatBetrag(input.gesamt_brutto)}+${formatBetrag(input.zuzahlung)}+${formatBetrag(input.gesamt_netto)}'`,
    `UNT+10+2'`,

    // Datei-Trailer
    `UNZ+2+${input.datei_referenz}'`,
  ];

  // Validierung vor Ausgabe
  validiereInput(input);

  const inhalt    = segmente.join('\n');
  const dateiname = `DTA_${input.ik_taxi}_${heute}_${input.datei_referenz}.txt`;

  return { inhalt, dateiname };
}

/**
 * Pflichtfeld-Validierung (wirft Fehler wenn ungültig)
 * Verhindert dass eine fehlerhafte Datei generiert wird
 */
function validiereInput(input: EdifactInput): void {
  const fehler: string[] = [];

  if (!/^\d{9}$/.test(input.ik_taxi))
    fehler.push('IK Taxi muss exakt 9 Ziffern haben');

  if (!/^\d{9}$/.test(input.ik_kasse))
    fehler.push('IK Kasse muss exakt 9 Ziffern haben');

  if (!/^\d{9}$/.test(input.arzt_lanr))
    fehler.push('LANR muss exakt 9 Ziffern haben');

  if (!/^\d{9}$/.test(input.arzt_bsnr))
    fehler.push('BSNR muss exakt 9 Ziffern haben');

  if (!/^[A-Z]\d{9}$/i.test(input.patient_kvnr))
    fehler.push('KVNR muss 1 Buchstabe + 9 Ziffern sein (10-stellig)');

  if (!input.fahrtdatum)
    fehler.push('Fahrtdatum fehlt');

  if (!input.verordnungsdatum)
    fehler.push('Verordnungsdatum fehlt');

  if (!input.patient_geburtsdatum)
    fehler.push('Geburtsdatum fehlt');

  if (fehler.length > 0) {
    throw new Error(`EDIFACT Validierungsfehler: ${fehler.join(', ')}`);
  }
}