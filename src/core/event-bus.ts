// Typed publish/subscribe bus. Single channel for all gantt events; replaces the
// old `trigger_event` + scattered `on_*` option callbacks.
type Handler<P> = (payload: P) => void;

export class EventBus<E> {
  private handlers: { [K in keyof E]?: Set<Handler<E[K]>> } = {};

  /** Subscribe. Returns an unsubscribe function. */
  on<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    (this.handlers[type] ??= new Set<Handler<E[K]>>()).add(handler);
    return () => this.off(type, handler);
  }

  /** Subscribe for a single delivery. Returns an unsubscribe function. */
  once<K extends keyof E>(type: K, handler: Handler<E[K]>): () => void {
    const wrapped: Handler<E[K]> = (payload) => {
      this.off(type, wrapped);
      handler(payload);
    };
    return this.on(type, wrapped);
  }

  off<K extends keyof E>(type: K, handler: Handler<E[K]>): void {
    this.handlers[type]?.delete(handler);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers[type];
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        // One handler's failure must not break the others or the emitter.
        console.error(`[gantt] event handler for "${String(type)}" threw:`, err);
      }
    }
  }

  clear(): void {
    this.handlers = {};
  }
}
