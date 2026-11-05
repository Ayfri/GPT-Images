export const oneOf = <T extends string>(options: object) => (value: unknown): value is T => typeof value === 'string' && Object.hasOwn(options, value);
