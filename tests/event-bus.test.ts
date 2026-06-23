import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/core/event-bus';

type E = { ping: { n: number }; pong: void };

describe('EventBus', () => {
  it('delivers emitted payloads to handlers', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    bus.on('ping', h);
    bus.emit('ping', { n: 1 });
    expect(h).toHaveBeenCalledWith({ n: 1 });
  });

  it('unsubscribe function stops delivery', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    const off = bus.on('ping', h);
    off();
    bus.emit('ping', { n: 2 });
    expect(h).not.toHaveBeenCalled();
  });

  it('once fires at most one time', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    bus.once('ping', h);
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('off removes a specific handler', () => {
    const bus = new EventBus<E>();
    const h = vi.fn();
    bus.on('ping', h);
    bus.off('ping', h);
    bus.emit('ping', { n: 9 });
    expect(h).not.toHaveBeenCalled();
  });

  it('isolates errors in one handler from others', () => {
    const bus = new EventBus<E>();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bad = () => {
      throw new Error('boom');
    };
    const good = vi.fn();
    bus.on('ping', bad);
    bus.on('ping', good);
    expect(() => bus.emit('ping', { n: 1 })).not.toThrow();
    expect(good).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
