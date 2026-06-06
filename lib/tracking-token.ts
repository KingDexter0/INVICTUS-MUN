import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export function generateTrackingToken(): string {
  return randomUUID();
}

export async function ensureUniqueTrackingToken(): Promise<string> {
  let token = generateTrackingToken();
  let attempts = 0;
  
  while (attempts < 10) {
    const indCount = await prisma.individualRegistration.count({
      where: { trackingToken: token }
    });
    
    const delCount = await prisma.delegationDelegate.count({
      where: { trackingToken: token }
    });
    
    if (indCount === 0 && delCount === 0) {
      return token;
    }
    
    token = generateTrackingToken();
    attempts++;
  }
  
  throw new Error("Could not generate a unique tracking token.");
}
