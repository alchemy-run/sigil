// Derived from `auto-bind` (MIT, Sindre Sorhus), reduced to the surface Ink uses.
// Reflective prototype-walking code: the broad `object` type is the right one here.
/* eslint-disable @typescript-eslint/no-restricted-types */

// Gets all non-builtin properties up the prototype chain.
const getAllProperties = (object: object): Array<[object, string | symbol]> => {
  const properties: Array<[object, string | symbol]> = [];
  let current: object | null = object;

  do {
    for (const key of Reflect.ownKeys(current)) {
      properties.push([current, key]);
    }

    current = Reflect.getPrototypeOf(current);
  } while (current && current !== Object.prototype);

  return properties;
};

const autoBind = <T extends object>(self: T): T => {
  for (const [object, key] of getAllProperties(
    (self.constructor as { prototype: object }).prototype,
  )) {
    if (key === "constructor") {
      continue;
    }

    const descriptor = Reflect.getOwnPropertyDescriptor(object, key);

    if (descriptor && typeof descriptor.value === "function") {
      const value = (self as Record<string | symbol, unknown>)[key];

      if (typeof value === "function") {
        (self as Record<string | symbol, unknown>)[key] = value.bind(self);
      }
    }
  }

  return self;
};

export default autoBind;
