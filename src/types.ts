// The two `type-fest` types Ink used, inlined (MIT, Sindre Sorhus).

/**
Allows creating a union type by combining primitive types and literal types
without sacrificing auto-completion in IDEs for the literal type part of the
union.
*/
export type LiteralUnion<LiteralType, BaseType extends string | number> =
  | LiteralType
  | (BaseType & Record<never, never>);

/**
Create a type from an object type without certain keys.
*/
export type Except<ObjectType, KeysType extends keyof ObjectType> = Omit<ObjectType, KeysType>;
