// The one `type-fest` type Ink used, inlined (MIT, Sindre Sorhus).

/**
Allows creating a union type by combining primitive types and literal types
without sacrificing auto-completion in IDEs for the literal type part of the
union.
*/
export type LiteralUnion<LiteralType, BaseType extends string | number> =
  | LiteralType
  | (BaseType & Record<never, never>);
