// Deterministic IDs for demo rows shared across seed modules.

const ID_TAIL_RADIX = 16;
const ID_TAIL_LENGTH = 12;
const TAIL_BLOCK_BITS = 0x1_00_00_00_00;

export function idTailToFactoryIndex(id: string): number {
  const tail = id.slice(-ID_TAIL_LENGTH);
  if (!/^[0-9a-f]{12}$/i.test(tail)) {
    throw new Error(`Seed id must end with a hexadecimal UUID tail: ${id}`);
  }
  return Number.parseInt(tail, ID_TAIL_RADIX);
}

function makeIdFactory(block: number): (index: number) => string {
  return (index: number): string => {
    const tail = (block + index)
      .toString(ID_TAIL_RADIX)
      .padStart(ID_TAIL_LENGTH, "0");
    return `d0000000-0000-4000-8000-${tail}`;
  };
}

export const makeGroupProductId = makeIdFactory(TAIL_BLOCK_BITS * 0);
export const makeViewerAccessId = makeIdFactory(TAIL_BLOCK_BITS * 1);
