// The business system the workflow talks to. Postgres in the app, memory in
// the chaos test. Both accept duplicate bookings, like many real ERPs.
import type { PrismaClient } from '@prisma/client';

export type PO = { number: string; vendor: string; amount: number; currency: string };
export type Booking = { id: string; externalRef: string; poNumber: string; amount: number };
export type Message = { id: string; externalRef: string; to: string };
export type BookingInput = { vendor: string; invoiceNumber: string; amount: number; currency: string; poNumber: string };

export interface Erp {
  findPO(number: string): Promise<PO | null>;
  findBooking(ref: string): Promise<Booking | null>;
  book(ref: string, data: BookingInput): Promise<Booking>;
  findMessage(ref: string): Promise<Message | null>;
  send(ref: string, to: string, text: string): Promise<Message>;
}

export class PrismaErp implements Erp {
  constructor(private db: PrismaClient) {}
  async findPO(number: string) {
    const po = await this.db.purchaseOrder.findUnique({ where: { number } });
    return po && { number: po.number, vendor: po.vendor, amount: Number(po.amount), currency: po.currency };
  }
  async findBooking(ref: string) {
    const b = await this.db.erpInvoice.findFirst({ where: { externalRef: ref }, orderBy: { createdAt: 'asc' } });
    return b && { id: b.id, externalRef: b.externalRef, poNumber: b.poNumber, amount: Number(b.amount) };
  }
  async book(ref: string, d: BookingInput) {
    const b = await this.db.erpInvoice.create({ data: { externalRef: ref, ...d } });
    return { id: b.id, externalRef: ref, poNumber: b.poNumber, amount: Number(b.amount) };
  }
  async findMessage(ref: string) {
    const m = await this.db.erpMessage.findFirst({ where: { externalRef: ref } });
    return m && { id: m.id, externalRef: m.externalRef, to: m.to };
  }
  async send(ref: string, to: string, text: string) {
    const m = await this.db.erpMessage.create({ data: { externalRef: ref, to, text } });
    return { id: m.id, externalRef: ref, to };
  }
}

export class MemoryErp implements Erp {
  pos = new Map<string, PO>();
  bookings: Booking[] = [];
  messages: Message[] = [];
  constructor(pos: PO[]) { for (const p of pos) this.pos.set(p.number, p); }
  async findPO(n: string) { return this.pos.get(n) ?? null; }
  async findBooking(ref: string) { return this.bookings.find((b) => b.externalRef === ref) ?? null; }
  async book(ref: string, d: BookingInput) { const b = { id: `INV-${this.bookings.length + 1}`, externalRef: ref, poNumber: d.poNumber, amount: d.amount }; this.bookings.push(b); return b; }
  async findMessage(ref: string) { return this.messages.find((m) => m.externalRef === ref) ?? null; }
  async send(ref: string, to: string) { const m = { id: `MSG-${this.messages.length + 1}`, externalRef: ref, to }; this.messages.push(m); return m; }
}
