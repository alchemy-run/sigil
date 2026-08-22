// Derived from `quick-lru` (MIT, Sindre Sorhus), reduced to the surface Ink
// uses. Implements the same two-generation LRU algorithm: when the hot map
// fills up, it becomes the cold generation and reads promote entries back.
export class QuickLru<KeyType, ValueType> {
  #size = 0;
  #cache = new Map<KeyType, ValueType>();
  #oldCache = new Map<KeyType, ValueType>();
  readonly #maxSize: number;

  constructor({ maxSize }: { maxSize: number }) {
    if (!(maxSize && maxSize > 0)) {
      throw new TypeError("`maxSize` must be a number greater than 0");
    }

    this.#maxSize = maxSize;
  }

  get size(): number {
    let oldCacheSize = 0;

    for (const key of this.#oldCache.keys()) {
      if (!this.#cache.has(key)) {
        oldCacheSize++;
      }
    }

    return Math.min(this.#size + oldCacheSize, this.#maxSize);
  }

  get(key: KeyType): ValueType | undefined {
    if (this.#cache.has(key)) {
      return this.#cache.get(key);
    }

    if (this.#oldCache.has(key)) {
      const value = this.#oldCache.get(key)!;
      this.#oldCache.delete(key);
      this.#set(key, value);
      return value;
    }

    return;
  }

  set(key: KeyType, value: ValueType): this {
    if (this.#cache.has(key)) {
      this.#cache.set(key, value);
    } else {
      this.#set(key, value);
    }

    return this;
  }

  has(key: KeyType): boolean {
    return this.#cache.has(key) || this.#oldCache.has(key);
  }

  delete(key: KeyType): boolean {
    const deleted = this.#cache.delete(key);

    if (deleted) {
      this.#size--;
    }

    return this.#oldCache.delete(key) || deleted;
  }

  clear(): void {
    this.#cache.clear();
    this.#oldCache.clear();
    this.#size = 0;
  }

  #set(key: KeyType, value: ValueType): void {
    this.#cache.set(key, value);
    this.#size++;

    if (this.#size >= this.#maxSize) {
      this.#size = 0;
      this.#oldCache = this.#cache;
      this.#cache = new Map();
    }
  }
}
