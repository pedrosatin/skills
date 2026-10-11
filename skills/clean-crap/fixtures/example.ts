export function identity(value: number) {
  return value;
}

export function choose(value: number, fallback?: number) {
  if (value > 0 && value < 10) return value;
  for (let index = 0; index < 2; index++) {
    value += index;
  }
  return value > 10 ? value : fallback ?? 0;
}

export const enabled = (value: boolean) => value || false;

export class Reader {
  read(item?: { value: string }) {
    try {
      return item?.value ?? '';
    } catch {
      return '';
    }
  }
}
