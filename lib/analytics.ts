import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export async function trackEvent(eventType: string, path?: string, metadata?: Record<string, unknown>) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventType,
        path,
        metadata: metadata as Prisma.InputJsonValue | undefined
      }
    });
  } catch (error) {
    console.error("Analytics event failed", error);
  }
}
