export interface Tarif {
  id: number;
  kasse_name: string;
  kv_region: string;
  befoerderungsart: string;
  grundpauschale: number;
  preis_pro_zusatz_km: number;
  gueltig_ab: string;
  gueltig_bis: string | null;
}

export interface PreisErgebnis {
  grundpauschale: number;
  streckenpreis: number;
  gesamt_brutto: number;
  zuzahlung: number;
  gesamt_netto: number;
  km_abgerechnet: number; // tatsächlich abgerechnete km (evtl. × 2)
}

/**
 * vdek NRW Tarif (ab 01.04.2026, Preislistenschlüssel 46 20 024):
 * - Grundpauschale 12,20 € inkl. km 1–5
 * - Ab km 6: 2,39 € pro Besetztkm
 *
 * Bei Hin- UND Rückfahrt: km × 2 als Berechnungsgrundlage
 * Zuzahlung: 10%, min 5€, max 10€ (nur wenn pflichtig)
 */
export function berechneVdekFahrt(
  km_einfach: number,
  tarif: Tarif,
  zuzahlungspflichtig: boolean,
  hinfahrt: boolean,
  rueckfahrt: boolean
): PreisErgebnis {
  // Gesamtkilometer berechnen
  const fahrtenAnzahl = (hinfahrt ? 1 : 0) + (rueckfahrt ? 1 : 0);
  const km_gesamt = km_einfach * (fahrtenAnzahl > 0 ? fahrtenAnzahl : 1);

  // Splitting: Grundpauschale für km 1–5, Zusatz ab km 6
  const zusatzKm      = Math.max(0, km_gesamt - 5);
  const grundpauschale = tarif.grundpauschale;
  const streckenpreis  = Math.round(zusatzKm * tarif.preis_pro_zusatz_km * 100) / 100;
  const gesamt_brutto  = Math.round((grundpauschale + streckenpreis) * 100) / 100;

  // Zuzahlung
  let zuzahlung = 0;
  if (zuzahlungspflichtig) {
    const roh = gesamt_brutto * 0.10;
    zuzahlung = Math.round(Math.max(5.00, Math.min(10.00, roh)) * 100) / 100;
  }

  const gesamt_netto = Math.round((gesamt_brutto - zuzahlung) * 100) / 100;

  return {
    grundpauschale,
    streckenpreis,
    gesamt_brutto,
    zuzahlung,
    gesamt_netto,
    km_abgerechnet: km_gesamt,
  };
}

// Aktueller vdek-NRW Fallback-Tarif
export const FALLBACK_TARIF: Tarif = {
  id: 2,
  kasse_name: 'vdek-NRW',
  kv_region: 'Nordrhein-Westfalen',
  befoerderungsart: 'TAXI',
  grundpauschale: 12.20,
  preis_pro_zusatz_km: 2.39,
  gueltig_ab: '2026-04-01',
  gueltig_bis: null,
};

/**
 * Testbeispiele (vdek NRW ab 01.04.2026):
 *
 * Einzelfahrt 3 km:
 *   km_gesamt=3, zusatzKm=0, brutto=12,20, zuzahlung=5,00 (Minimum)
 *
 * Einzelfahrt 10 km:
 *   km_gesamt=10, zusatzKm=5, strecke=5×2,39=11,95
 *   brutto=12,20+11,95=24,15, zuzahlung=2,42 → Minimum 5,00
 *
 * Hin+Rückfahrt je 10 km:
 *   km_gesamt=20, zusatzKm=15, strecke=15×2,39=35,85
 *   brutto=12,20+35,85=48,05, zuzahlung=4,81 → Minimum 5,00
 *
 * Einzelfahrt 100 km:
 *   km_gesamt=100, zusatzKm=95, strecke=95×2,39=227,05
 *   brutto=239,25, zuzahlung=23,93 → Maximum 10,00
 */