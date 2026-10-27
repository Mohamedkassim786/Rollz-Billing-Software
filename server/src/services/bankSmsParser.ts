/**
 * Bank SMS & Push Notification Parser for Inbound UPI Credits
 * Supports HDFC, SBI, ICICI, Axis, Kotak, Paytm, PhonePe, GPay Business, and standard NPCI alerts.
 */

export interface ParsedBankAlert {
  isCredit: boolean;
  amountPaise: number;
  amountRupees: number;
  utrNumber: string | null;
  bankName: string;
  payerInfo: string | null;
  rawText: string;
}

export function parseBankSms(text: string, senderHeader?: string): ParsedBankAlert | null {
  if (!text || typeof text !== "string") return null;

  const clean = text.replace(/[\r\n]+/g, " ").trim();
  const lower = clean.toLowerCase();

  // 1. Guard against Debit / Outgoing alerts
  const isDebit =
    /\b(debited|sent|withdrawn|paid to|transferred to|deducted|spent)\b/i.test(lower) &&
    !/\b(received from|credited to|credited by|refund credited)\b/i.test(lower);

  if (isDebit) {
    return {
      isCredit: false,
      amountPaise: 0,
      amountRupees: 0,
      utrNumber: null,
      bankName: detectBankName(clean, senderHeader),
      payerInfo: null,
      rawText: clean,
    };
  }

  // 2. Must be a Credit / Inward UPI receipt
  const isCredit =
    /\b(credited|received|deposit|deposited|payment received|added to)\b/i.test(lower);

  if (!isCredit) {
    return null;
  }

  // 3. Extract Amount
  // Matches: "Rs. 140.00", "Rs 140", "INR 1,450.50", "₹140.00", "Rs.140"
  const amountPatterns = [
    /(?:(?:rs\.?|inr|₹)\s*)([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:(?:rs\.?|inr|₹))/i,
    /(?:credited\s+(?:by|with)\s+)([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:received\s+)([0-9,]+(?:\.[0-9]{1,2})?)/i,
  ];

  let parsedAmountRupees = 0;
  for (const pattern of amountPatterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      const numStr = match[1].replace(/,/g, "");
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        parsedAmountRupees = num;
        break;
      }
    }
  }

  if (parsedAmountRupees <= 0) {
    return null; // Could not reliably parse money amount
  }

  const amountPaise = Math.round(parsedAmountRupees * 100);

  // 4. Extract UTR / UPI Reference Number (12 digits)
  // Standard NPCI UPI UTR is 12 digits (e.g. 429381923841)
  let utrNumber: string | null = null;

  const utrPatterns = [
    /(?:upi\s*ref(?:\s*no)?\.?\s*:?\s*|upi\/|ref\s*no\.?\s*:?\s*|rrn\s*:?\s*)([0-9]{12})/i,
    /(?:info:\s*upi-?)([0-9]{12})/i,
    /(?:ref(?:\s*no)?[:\s]+)([0-9]{12})/i,
    /\b([0-9]{12})\b/, // Fallback 12-digit number standalone
  ];

  for (const pattern of utrPatterns) {
    const match = clean.match(pattern);
    if (match && match[1]) {
      utrNumber = match[1];
      break;
    }
  }

  // 5. Extract Payer Information (VPA or Name if present)
  let payerInfo: string | null = null;
  const payerVpaMatch = clean.match(/([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})/i);
  if (payerVpaMatch && payerVpaMatch[1]) {
    payerInfo = payerVpaMatch[1];
  } else {
    const fromNameMatch = clean.match(/(?:from|transfer from|by)\s+([A-Za-z\s]{3,30})(?:\s+on|\s+ref|\s+upi|\.|$)/i);
    if (fromNameMatch && fromNameMatch[1]) {
      const candidate = fromNameMatch[1].trim();
      if (!/customer|account|bank|branch|phonepe|paytm|gpay/i.test(candidate)) {
        payerInfo = candidate;
      }
    }
  }

  const bankName = detectBankName(clean, senderHeader);

  return {
    isCredit: true,
    amountPaise,
    amountRupees: parsedAmountRupees,
    utrNumber,
    bankName,
    payerInfo,
    rawText: clean,
  };
}

function detectBankName(text: string, senderHeader?: string): string {
  const combined = `${senderHeader || ""} ${text}`.toUpperCase();

  if (combined.includes("HDFC")) return "HDFC Bank";
  if (combined.includes("SBI") || combined.includes("STATE BANK")) return "State Bank of India";
  if (combined.includes("ICICI")) return "ICICI Bank";
  if (combined.includes("AXIS")) return "Axis Bank";
  if (combined.includes("KOTAK")) return "Kotak Mahindra Bank";
  if (combined.includes("PAYTM")) return "Paytm Payments Bank";
  if (combined.includes("PHONEPE")) return "PhonePe Merchant";
  if (combined.includes("GPAY") || combined.includes("GOOGLE PAY")) return "Google Pay Business";
  if (combined.includes("PNB") || combined.includes("PUNJAB")) return "Punjab National Bank";
  if (combined.includes("CANARA")) return "Canara Bank";
  if (combined.includes("BOB") || combined.includes("BARODA")) return "Bank of Baroda";
  if (combined.includes("INDUSIND")) return "IndusInd Bank";
  if (combined.includes("YES BANK")) return "Yes Bank";

  return "UPI / Bank Account";
}
