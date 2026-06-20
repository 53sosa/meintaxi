import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function openDb(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: path.join(process.cwd(), 'meintaxi.db'),
    driver: sqlite3.Database,
  });

  await db.exec(`PRAGMA journal_mode = WAL;`);
  await db.exec(`PRAGMA foreign_keys = ON;`);

  // ==========================================
  // 1. TAXIUNTERNEHMEN
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS taxiunternehmen (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      firmen_name   VARCHAR(150) NOT NULL,
      ik_nummer     CHAR(9)      NOT NULL UNIQUE,
      tarif_region  VARCHAR(50)  NOT NULL,
      firmen_code   VARCHAR(10)  NOT NULL UNIQUE,
      email         VARCHAR(150) NOT NULL UNIQUE,
      passwort_hash VARCHAR(255) NOT NULL,
      erstellt_am   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ==========================================
  // 2. FAHRER — neu: status (aktiv/ausstehend/abgelehnt)
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS fahrer (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      unternehmen_id INTEGER      NOT NULL,
      vorname        VARCHAR(100) NOT NULL,
      nachname       VARCHAR(100) NOT NULL,
      email          VARCHAR(150) NOT NULL UNIQUE,
      passwort_hash  VARCHAR(255) NOT NULL,
      status         TEXT         NOT NULL DEFAULT 'aktiv',
      erstellt_am    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unternehmen_id) REFERENCES taxiunternehmen(id)
    );
  `);

  // ==========================================
  // 3. PATIENTEN
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS patienten (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      vorname       VARCHAR(100) NOT NULL,
      nachname      VARCHAR(100) NOT NULL,
      email         VARCHAR(150) NOT NULL UNIQUE,
      passwort_hash VARCHAR(255) NOT NULL,
      kvnr          CHAR(10)     UNIQUE,
      mfa_code      VARCHAR(10),
      mfa_expires   TEXT,
      erstellt_am   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ==========================================
  // 4. VERORDNUNGEN
  // status: offen / hinfahrt_abgeschlossen / abgeschlossen
  // hinfahrt_abgeschlossen: nur wenn Hin+Rück verordnet und Hinfahrt erledigt
  // abgeschlossen: alle verordneten Fahrten erledigt
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS verordnungen (
      id                      TEXT        PRIMARY KEY,
      status                  VARCHAR(30) NOT NULL DEFAULT 'offen',
      patient_vorname         VARCHAR(100) NOT NULL,
      patient_nachname        VARCHAR(100) NOT NULL,
      patient_geburtsdatum    TEXT         NOT NULL,
      patient_kvnr            CHAR(10)     NOT NULL,
      versichertenstatus      VARCHAR(10)  NOT NULL DEFAULT '1000',
      kasse_name              VARCHAR(150) NOT NULL,
      kasse_ik                CHAR(9)      NOT NULL,
      arzt_bsnr               CHAR(9)      NOT NULL,
      arzt_lanr               CHAR(9)      NOT NULL,
      verordnungsdatum        TEXT         NOT NULL,
      fahrt_von               VARCHAR(255) NOT NULL,
      fahrt_nach              VARCHAR(255) NOT NULL,
      fahrt_grund_code        CHAR(1)      NOT NULL DEFAULT 'a',
      befoerderungsart        VARCHAR(10)  NOT NULL DEFAULT 'TAXI',
      hinfahrt                INTEGER      NOT NULL DEFAULT 1,
      rueckfahrt              INTEGER      NOT NULL DEFAULT 0,
      zuzahlungspflichtig     INTEGER      NOT NULL DEFAULT 1,
      zuzahlungsbefreit       INTEGER      NOT NULL DEFAULT 0,
      behandlung_beschreibung VARCHAR(255),
      gueltig_bis             TEXT,
      erstellt_am             TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ==========================================
  // 5. FAHRTEN — Freigabe-Workflow + GKV statt DMRZ
  // freigabe_status: nicht_freigegeben / freigegeben / abgelehnt
  // gkv_status:     ausstehend / pending / success / failed / signature_error
  // fahrtrichtung:  hinfahrt / rueckfahrt / beide
  // EDIFACT wird erst nach Freigabe generiert
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS fahrten (
      id                       TEXT    PRIMARY KEY,
      verordnung_id            TEXT    NOT NULL,
      fahrer_id                INTEGER NOT NULL,
      unternehmen_id           INTEGER NOT NULL,

      fahrtrichtung            TEXT    NOT NULL DEFAULT 'beide',

      wagennummer              TEXT    NOT NULL,
      fahrtdatum               TEXT    NOT NULL,
      fahrt_von                TEXT    NOT NULL,
      fahrt_nach               TEXT    NOT NULL,
      km_einfach               REAL    NOT NULL,
      hinfahrt                 INTEGER NOT NULL DEFAULT 1,
      rueckfahrt               INTEGER NOT NULL DEFAULT 1,

      grundpauschale           REAL    NOT NULL,
      streckenpreis            REAL    NOT NULL,
      gesamt_brutto            REAL    NOT NULL,
      zuzahlung                REAL    NOT NULL,
      gesamt_netto             REAL    NOT NULL,

      unterschrift_blob        TEXT    NOT NULL,
      unterschrift_zeitstempel TEXT    NOT NULL,
      unterschrift_hash        TEXT    NOT NULL,

      freigabe_status          TEXT    NOT NULL DEFAULT 'nicht_freigegeben',
      freigabe_zeitstempel     TEXT,
      freigabe_begruendung     TEXT,

      edifact_datei            TEXT,
      edifact_generiert_am     TEXT,
      edifact_dateiname        TEXT,

      gkv_status               TEXT    NOT NULL DEFAULT 'ausstehend',
      gkv_uebermittelt_am      TEXT,
      gkv_referenz             TEXT,

      erstellt_am              TEXT    DEFAULT CURRENT_TIMESTAMP,

      FOREIGN KEY (verordnung_id)  REFERENCES verordnungen(id),
      FOREIGN KEY (fahrer_id)      REFERENCES fahrer(id),
      FOREIGN KEY (unternehmen_id) REFERENCES taxiunternehmen(id)
    );
  `);

  // ==========================================
  // 6. TARIFE
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tarife (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      kasse_name           VARCHAR(150) NOT NULL,
      kv_region            VARCHAR(50)  NOT NULL,
      befoerderungsart     VARCHAR(10)  NOT NULL DEFAULT 'TAXI',
      grundpauschale       REAL         NOT NULL,
      preis_pro_zusatz_km  REAL         NOT NULL,
      gueltig_ab           TEXT         NOT NULL,
      gueltig_bis          TEXT
    );
  `);

  await db.exec(`
    INSERT OR IGNORE INTO tarife
      (id, kasse_name, kv_region, befoerderungsart, grundpauschale, preis_pro_zusatz_km, gueltig_ab, gueltig_bis)
    VALUES
      (1, 'Standard', 'Nordrhein', 'TAXI', 8.50, 1.50, '2025-01-01', '2026-03-31');
  `);

  await db.exec(`
    INSERT OR IGNORE INTO tarife
      (id, kasse_name, kv_region, befoerderungsart, grundpauschale, preis_pro_zusatz_km, gueltig_ab, gueltig_bis)
    VALUES
      (2, 'vdek-NRW', 'Nordrhein-Westfalen', 'TAXI', 12.20, 2.39, '2026-04-01', NULL);
  `);

  // ==========================================
  // 7. AIS-ZUGAENGE — neu für praxisspezifische Auth (US-NEXT-02)
  // Noch nicht aktiv im Endpoint — Vorbereitung
  // ==========================================
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ais_zugaenge (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      bsnr         CHAR(9)      NOT NULL UNIQUE,
      api_key_hash VARCHAR(255) NOT NULL,
      praxis_name  VARCHAR(150) NOT NULL,
      aktiv        INTEGER      NOT NULL DEFAULT 1,
      erstellt_am  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}