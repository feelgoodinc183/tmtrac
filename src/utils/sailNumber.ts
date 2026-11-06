/** Sail numbers compare without case or extra spaces: "mas  101" is the same boat as "MAS 101". */
export const normalizeSail = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
