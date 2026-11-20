// Sample data for the demo. Every company, person and number here is invented.

export const PURCHASE_ORDERS = [
  { number: 'PO-4471', vendor: 'Nordlicht Office Supplies GmbH', amount: 1284.5, currency: 'EUR' },
  { number: 'PO-4472', vendor: 'Kessler Facility Services', amount: 7920.0, currency: 'EUR' },
  { number: 'PO-4473', vendor: 'Brightline IT Hardware', amount: 3410.0, currency: 'EUR' },
  { number: 'PO-4474', vendor: 'Halden Catering', amount: 645.0, currency: 'EUR' },
  { number: 'PO-4475', vendor: 'Vossberg Print & Media', amount: 2150.0, currency: 'EUR' },
  { number: 'PO-4476', vendor: 'Altmark Cleaning Co.', amount: 980.0, currency: 'EUR' },
];

export type Faults = {
  /** extract fails with a rate limit on its first N attempts. */
  rateLimit?: number;
  /** The ERP saves the booking, then the response times out (attempt 1). */
  erpTimeoutAfterCommit?: boolean;
  /** notify fails permanently on attempt 1. */
  notifyFailsOnce?: boolean;
  /** The mail server sends the message, then the response times out (attempt 1). */
  mailTimeoutAfterSend?: boolean;
};

export type Scenario = { title: string; text: string; faults?: Faults; then?: 'approve' | 'reject' | 'fix-po' | 'confirm-sent' | 'leave' };

const invoice = (vendor: string, no: string, po: string, requester: string, lines: [string, number][], total?: number) =>
  [
    `INVOICE ${no}`,
    `From: ${vendor}`,
    `To: Brightmoor GmbH, Accounts Payable`,
    `Your order: ${po}`,
    `Requested by: ${requester}`,
    ``,
    ...lines.map(([d, a]) => `${d.padEnd(30)}  EUR ${a.toFixed(2).padStart(8)}`),
    ``,
    `${'TOTAL'.padEnd(30)}  EUR ${(total ?? lines.reduce((s, [, a]) => s + a, 0)).toFixed(2).padStart(8)}`,
  ].join('\n');

export const SCENARIOS: Scenario[] = [
  { title: 'Office supplies, clean run', text: invoice('Nordlicht Office Supplies GmbH', 'NL-2026-0912', 'PO-4471', 'lena.hoff@brightmoor.example', [['Printer paper A4, 40 boxes', 684.5], ['Toner cartridges, 6 pcs', 600.0]]) },
  { title: 'Facility services over 5,000 EUR', text: invoice('Kessler Facility Services', 'KFS-11873', 'PO-4472', 'tom.reyes@brightmoor.example', [['HVAC maintenance Q4', 5400.0], ['Fire safety inspection', 2520.0]]), then: 'leave' },
  { title: 'Wrong purchase order number', text: invoice('Brightline IT Hardware', 'BL-7765', 'PO-4437', 'aisha.kanu@brightmoor.example', [['Docking stations, 10 pcs', 2190.0], ['Monitors 27 inch, 4 pcs', 1220.0]]), then: 'leave' },
  { title: 'Wrong PO, corrected by a person', text: invoice('Brightline IT Hardware', 'BL-7766', 'PO-4437', 'aisha.kanu@brightmoor.example', [['Docking stations, 10 pcs', 2190.0], ['Monitors 27 inch, 4 pcs', 1220.0]]), then: 'fix-po' },
  { title: 'ERP times out after booking', text: invoice('Halden Catering', 'HC-3391', 'PO-4474', 'marco.bell@brightmoor.example', [['Team lunch, 30 people', 525.0], ['Coffee and snacks', 120.0]]), faults: { erpTimeoutAfterCommit: true } },
  { title: 'Model rate limited twice', text: invoice('Vossberg Print & Media', 'VPM-5520', 'PO-4475', 'jonas.weber@brightmoor.example', [['Brochures, 2,000 copies', 1650.0], ['Roll-up banners, 2 pcs', 500.0]]), faults: { rateLimit: 2 } },
  { title: 'Requester mailbox not found', text: invoice('Altmark Cleaning Co.', 'ACC-0417', 'PO-4476', 'priya.nair@brightmoor.example', [['Office cleaning, November', 980.0]]), faults: { notifyFailsOnce: true }, then: 'leave' },
  { title: 'Mail server times out after sending', text: invoice('Halden Catering', 'HC-3402', 'PO-4474', 'marco.bell@brightmoor.example', [['Team lunch, 30 people', 525.0], ['Coffee and snacks', 120.0]]), faults: { mailTimeoutAfterSend: true }, then: 'leave' },
  { title: 'Mail timeout, checked by a person', text: invoice('Altmark Cleaning Co.', 'ACC-0418', 'PO-4476', 'priya.nair@brightmoor.example', [['Office cleaning, December', 980.0]]), faults: { mailTimeoutAfterSend: true }, then: 'confirm-sent' },
  { title: 'Approved after review', text: invoice('Kessler Facility Services', 'KFS-11874', 'PO-4472', 'tom.reyes@brightmoor.example', [['HVAC maintenance Q4', 5400.0], ['Fire safety inspection', 2520.0]]), then: 'approve' },
  { title: 'Rejected as a duplicate', text: invoice('Kessler Facility Services', 'KFS-11873-B', 'PO-4472', 'tom.reyes@brightmoor.example', [['HVAC maintenance Q4', 5400.0], ['Fire safety inspection', 2520.0]]), then: 'reject' },
  { title: 'Lines do not add up', text: invoice('Nordlicht Office Supplies GmbH', 'NL-2026-0951', 'PO-4471', 'lena.hoff@brightmoor.example', [['Printer paper A4, 40 boxes', 684.5], ['Toner cartridges, 6 pcs', 600.0]], 1384.5), then: 'leave' },
];
