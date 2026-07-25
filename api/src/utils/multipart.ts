import Busboy from 'busboy';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { ValidationError } from '@arcforge/shared';

export interface ParsedMultipartCsv {
  csvText: string;
  fileName?: string;
  mimeType?: string;
}

function getHeaderCaseInsensitive(
  headers: Record<string, string | undefined>,
  name: string
): string {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && v) return v;
  }
  return '';
}

/**
 * Parse a multipart/form-data request (API Gateway event) and extract CSV contents.
 *
 * Expected form field names:
 * - file: the uploaded CSV file (preferred)
 * - csv: a text field containing CSV text (fallback)
 */
export async function parseMultipartCsv(event: APIGatewayProxyEvent): Promise<ParsedMultipartCsv> {
  const headers = (event.headers || {}) as Record<string, string | undefined>;
  const contentType = getHeaderCaseInsensitive(headers, 'content-type');

  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new ValidationError('Request is not multipart/form-data');
  }

  if (!event.body) {
    throw new ValidationError('Multipart body is missing');
  }

  const bodyBuffer = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64')
    : Buffer.from(event.body, 'utf-8');

  const busboy = Busboy({
    headers: { 'content-type': contentType },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB CSV limit
      files: 1,
      fields: 50,
    },
  });

  let csvText: string | undefined;
  let fileName: string | undefined;
  let mimeType: string | undefined;

  await new Promise<void>((resolve, reject) => {
    busboy.on('file', (fieldname, file, info) => {
      if (fieldname !== 'file') {
        file.resume();
        return;
      }

      fileName = info.filename;
      mimeType = info.mimeType;

      const chunks: Buffer[] = [];
      file.on('data', (d: Buffer) => chunks.push(d));
      file.on('limit', () => reject(new ValidationError('CSV file too large (max 5MB)')));
      file.on('end', () => {
        csvText = Buffer.concat(chunks).toString('utf-8');
      });
    });

    busboy.on('field', (fieldname, val) => {
      if (fieldname === 'csv' && !csvText) {
        csvText = val;
      }
    });

    busboy.on('error', (err) => reject(err));
    busboy.on('finish', () => resolve());

    busboy.end(bodyBuffer);
  });

  if (!csvText || !csvText.trim()) {
    throw new ValidationError(
      "Multipart form must include a CSV file field named 'file' (or text field 'csv')."
    );
  }

  return { csvText, fileName, mimeType };
}
