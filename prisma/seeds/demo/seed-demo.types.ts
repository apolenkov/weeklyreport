// Dataset shapes for the demo seed — plain data consumed by the demo
// scaffold/cast and profile seeds. No Prisma calls live here.

export interface DemoLead {
  id: string;
  email: string;
  name: string;
  samlId: string;
}

export interface DemoProduct {
  id: string;
  name: string;
  leadId: string;
}

export interface SeedDataset {
  readonly leads: readonly DemoLead[];
  readonly products: readonly DemoProduct[];
}
