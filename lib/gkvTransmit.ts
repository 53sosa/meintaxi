import crypto from 'crypto';

export interface GkvTransmitErgebnis {
  status:      'success' | 'failed' | 'signature_error';
  referenz_id: string | null;
  uebermittelt_am: string | null;
  fehler?: string;
}

/**
 * Sendet eine EDIFACT-Datei an die GKV-Datenannahmestelle.
 *
 * Im Prototyp: Mock-Endpoint auf localhost
 * Im Produktivbetrieb: echte GKV-Datenannahmestelle mit ITSG-Zertifikat
 *
 * Sicherheit:
 * - HMAC-SHA256 Signatur über den EDIFACT-String (X-Signature Header)
 * - Secret aus process.env.GKV_SIGNING_SECRET
 * - HTTPS (im Produktivbetrieb mit ITSG-Zertifikat)
 */
export async function sendeAnGkv(
  edifactString: string,
  dateiname:     string,
  ik_taxi:       string,
  ik_kasse:      string
): Promise<GkvTransmitErgebnis> {

  // 1. Signing-Secret prüfen
  const signingSecret = process.env.GKV_SIGNING_SECRET;
  if (!signingSecret) {
    console.error('❌ GKV_SIGNING_SECRET nicht gesetzt in .env.local');
    return {
      status:          'signature_error',
      referenz_id:     null,
      uebermittelt_am: null,
      fehler:          'GKV_SIGNING_SECRET fehlt in .env.local',
    };
  }

  // 2. HMAC-SHA256 Signatur berechnen
  const signature = crypto
    .createHmac('sha256', signingSecret)
    .update(edifactString, 'utf8')
    .digest('hex');

  // 3. Endpoint bestimmen (Mock oder produktiv)
  const endpoint = process.env.GKV_ENDPOINT ?? 'http://localhost:3000/api/gkv-mock';

  console.log(`📤 GKV-Übermittlung: ${dateiname} → ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-Signature':   signature,
        'X-IK-Absender': ik_taxi,
        'X-IK-Empfaenger': ik_kasse,
        'X-Dateiname':   dateiname,
      },
      body: JSON.stringify({
        datei:        edifactString,
        dateiname,
        ik_absender:  ik_taxi,
        ik_empfaenger: ik_kasse,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`❌ GKV-Endpoint Fehler ${response.status}:`, text);
      return {
        status:          'failed',
        referenz_id:     null,
        uebermittelt_am: null,
        fehler:          `HTTP ${response.status}: ${text}`,
      };
    }

    const data = await response.json();

    console.log(`✅ GKV-Übermittlung erfolgreich: ${data.referenz_id}`);
    return {
      status:          'success',
      referenz_id:     data.referenz_id ?? null,
      uebermittelt_am: new Date().toISOString(),
    };

  } catch (err: any) {
    console.error('❌ GKV-Übermittlung Netzwerkfehler:', err.message);
    return {
      status:          'failed',
      referenz_id:     null,
      uebermittelt_am: null,
      fehler:          err.message,
    };
  }
}