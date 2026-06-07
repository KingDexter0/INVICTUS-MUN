import { EventEmitter } from "events";

const globalForEvents = global as unknown as {
  operationsEmitter?: EventEmitter;
  activeConnections?: number;
  lastEventAt?: string;
};

export const operationsEmitter = globalForEvents.operationsEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.operationsEmitter = operationsEmitter;
}

// Track connections and events
export function getActiveConnections() {
  return globalForEvents.activeConnections ?? 0;
}

export function incrementConnections() {
  globalForEvents.activeConnections = (globalForEvents.activeConnections ?? 0) + 1;
}

export function decrementConnections() {
  globalForEvents.activeConnections = Math.max(0, (globalForEvents.activeConnections ?? 1) - 1);
}

export function getLastEventAt() {
  return globalForEvents.lastEventAt ?? new Date().toISOString();
}

export function setLastEventAt(val: string) {
  globalForEvents.lastEventAt = val;
}
