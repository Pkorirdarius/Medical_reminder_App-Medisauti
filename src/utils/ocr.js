/**
 * ocr.js  — On-device prescription OCR via Tesseract.js
 *
 * React Native cannot load Tesseract.js directly from npm in its bundler.
 * We use a WebView-based approach: the heavy OCR work runs inside a hidden
 * WebView that loads Tesseract via CDN (works offline after first load with
 * a caching strategy), then posts the result back to RN via onMessage.
 *
 * This file exports the HTML string injected into the WebView (see
 * PrescriptionScreen.js for the WebView integration), plus helper functions
 * to parse the raw OCR text into structured prescription fields.
 */

// ─── WebView HTML that runs Tesseract.js ─────────────────────────────
export const OCR_WEBVIEW_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
</head>
<body>
<script>
  // Listen for image data sent from React Native
  document.addEventListener('message', async (event) => {
    try {
      const { imageUri } = JSON.parse(event.data);

      const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'progress',
              progress: Math.round(m.progress * 100)
            }));
          }
        }
      });

      const { data: { text } } = await worker.recognize(imageUri);
      await worker.terminate();

      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'result',
        text
      }));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'error',
        message: err.message
      }));
    }
  });

  // Signal ready
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>
`;

// ─── Parse raw OCR text into prescription fields ──────────────────────
/**
 * Heuristically extract prescription fields from raw Tesseract output.
 *
 * Returns:
 *   { drugName, dosage, frequency, times, rawText }
 *
 * Examples of text this handles:
 *   "METFORMIN 500mg  Take 2 tablets twice daily  Morning and Evening"
 *   "Tab. Lisinopril 10 mg  Once a day  8:00 AM"
 */
export function parseOCRText(rawText) {
  const text = rawText.toUpperCase();

  // ── Drug name ─────────────────────────────────────────────────────
  // Common Kenyan chronic-disease medications to match first
  const knownDrugs = [
    'METFORMIN', 'LISINOPRIL', 'ATORVASTATIN', 'AMLODIPINE',
    'ASPIRIN', 'GLIBENCLAMIDE', 'FUROSEMIDE', 'HYDROCHLOROTHIAZIDE',
    'ENALAPRIL', 'RAMIPRIL', 'LOSARTAN', 'NIFEDIPINE', 'PROPRANOLOL',
    'INSULIN', 'GLIMEPIRIDE', 'SITAGLIPTIN', 'EMPAGLIFLOZIN',
  ];

  let drugName = '';
  for (const drug of knownDrugs) {
    if (text.includes(drug)) {
      drugName = drug.charAt(0) + drug.slice(1).toLowerCase();
      break;
    }
  }

  if (!drugName) {
    // Fallback: grab the first capitalized word that looks like a drug
    const match = rawText.match(/\b([A-Z][a-z]{3,})\b/);
    drugName = match ? match[1] : '';
  }

  // ── Dosage ────────────────────────────────────────────────────────
  const dosageMatch = rawText.match(/(\d+\.?\d*\s*(?:mg|mcg|g|ml|iu|units?))/i);
  const dosage = dosageMatch ? dosageMatch[1].trim() : '';

  // ── Frequency ─────────────────────────────────────────────────────
  let frequency = '';
  let timesPerDay = 1;

  if (/once\s*(?:a\s*)?day|1x\s*daily|od\b/i.test(text)) {
    frequency = 'Once daily'; timesPerDay = 1;
  } else if (/twice\s*(?:a\s*)?day|2x\s*daily|bd\b|bid\b/i.test(text)) {
    frequency = 'Twice daily'; timesPerDay = 2;
  } else if (/three\s*times|3x\s*daily|tds\b|tid\b/i.test(text)) {
    frequency = 'Three times daily'; timesPerDay = 3;
  } else if (/four\s*times|4x\s*daily|qds\b|qid\b/i.test(text)) {
    frequency = 'Four times daily'; timesPerDay = 4;
  }

  // ── Default dose times ────────────────────────────────────────────
  const defaultTimes = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['07:00', '12:00', '17:00', '21:00'],
  };

  // Look for explicit times in text
  const timeMatches = rawText.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM)?)\b/gi) || [];
  const times = timeMatches.length > 0
    ? timeMatches.map(t => normalizeTime(t))
    : (defaultTimes[timesPerDay] || ['08:00']);

  return { drugName, dosage, frequency, times, rawText };
}

function normalizeTime(timeStr) {
  const upper = timeStr.toUpperCase().trim();
  const isPM = upper.includes('PM');
  const isAM = upper.includes('AM');
  const numbers = upper.replace(/AM|PM/g, '').trim();
  let [h, m] = numbers.split(':').map(Number);
  if (isNaN(m)) m = 0;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
