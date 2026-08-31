// Deterministic IDs for demo rows shared across seed modules.

const ID_TAIL_RADIX = 16;
const ID_TAIL_LENGTH = 12;
const TAIL_BLOCK_BITS = 0x1_00_00_00_00;

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
