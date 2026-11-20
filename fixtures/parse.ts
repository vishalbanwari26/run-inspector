// A stand-in for the model, for the chaos test and local UI work only:
// reads the invoice fields straight from the sample text format.
export function parseInvoice(text: string) {
  const get = (re: RegExp) => text.match(re)?.[1]?.trim() ?? '';
  const lines = [...text.matchAll(/^(.+?)\s{2,}EUR\s+([\d.]+)$/gm)]
    .filter((m) => !m[1]!.startsWith('TOTAL'))
    .map((m) => ({ description: m[1]!.trim(), amount: Number(m[2]) }));
  return {
    vendor: get(/^From: (.+)$/m), invoiceNumber: get(/^INVOICE (.+)$/m), poNumber: get(/^Your order: (.+)$/m),
    requester: get(/^Requested by: (.+)$/m), currency: 'EUR', lines, total: Number(get(/^TOTAL\s+EUR\s+([\d.]+)$/m)),
  };
}
