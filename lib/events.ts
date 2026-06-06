import { EventEmitter } from "events";

const globalForEvents = global as unknown as {
  operationsEmitter?: EventEmitter;
};

export const operationsEmitter = globalForEvents.operationsEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.operationsEmitter = operationsEmitter;
}
