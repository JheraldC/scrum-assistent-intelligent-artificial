// Reloj inyectable (research.md D-12): las marcas de tiempo las genera siempre el servidor.

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Reloj controlable para pruebas. */
export class TestClock implements Clock {
  constructor(private current: Date = new Date('2026-01-01T00:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current.getTime());
  }
  set(date: Date): void {
    this.current = date;
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}
