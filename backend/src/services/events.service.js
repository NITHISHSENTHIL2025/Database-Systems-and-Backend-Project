import { EventEmitter } from 'node:events';

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function publishEvent(type, data = {}) {
  bus.emit('event', { type, data, at: new Date().toISOString() });
}

export function subscribeEvents(listener) {
  bus.on('event', listener);
  return () => bus.off('event', listener);
}
