import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export async function openDb() {
  const db = await open({
    filename: path.join(process.cwd(), 'meintaxi.db'),
    driver: sqlite3.Database
  });

  // 1. NEU: Tabelle für die Taxiunternehmen (US-1.1)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS taxiunternehmen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firmen_name VARCHAR(150) NOT NULL,
        ik_nummer CHAR(9) NOT NULL UNIQUE,
        tarif_region VARCHAR(50) NOT NULL,
        firmen_code VARCHAR(10) NOT NULL UNIQUE,
        email VARCHAR(150) UNIQUE NOT NULL,
        passwort_hash VARCHAR(255) NOT NULL,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. NEU: Tabelle für die Fahrer (US-1.2)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS fahrer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unternehmen_id INTEGER,
        vorname VARCHAR(100) NOT NULL,
        nachname VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        passwort_hash VARCHAR(255) NOT NULL,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (unternehmen_id) REFERENCES taxiunternehmen(id)
    );
  `);

  // 3. BESTEHEND: Eure Tabelle für die Verordnungen
  await db.exec(`
    CREATE TABLE IF NOT EXISTS verordnungen (
        id TEXT PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'offen',
        patient_vorname VARCHAR(100) NOT NULL,
        patient_nachname VARCHAR(100) NOT NULL,
        patient_geburtsdatum TEXT NOT NULL,
        patient_kvnr CHAR(10) NOT NULL,
        kasse_name VARCHAR(150) NOT NULL,
        kasse_ik CHAR(9) NOT NULL,
        arzt_bsnr CHAR(9) NOT NULL,
        arzt_lanr CHAR(9) NOT NULL,
        verordnungsdatum TEXT NOT NULL,
        fahrt_von VARCHAR(255) NOT NULL,
        fahrt_nach VARCHAR(255) NOT NULL,
        fahrt_grund VARCHAR(150) NOT NULL,
        zuzahlungspflichtig BOOLEAN DEFAULT 1,
        erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}