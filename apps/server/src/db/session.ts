import { prisma } from "./prisma.js";
import type { VerifiedWpIdentity } from "../auth/identity.js";

export async function getOrCreateSession(widgetSessionId: string) {
  return prisma.chatSession.upsert({
    where: { widgetSessionId },
    create: { widgetSessionId },
    update: { lastActivityAt: new Date() },
  });
}

export async function syncSessionIdentity(sessionId: string, identity: VerifiedWpIdentity | undefined) {
  if (!identity) {
    return prisma.chatSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  }

  return prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      wpUserId: identity.userId,
      wpUserEmail: identity.email,
      wpUserName: identity.name,
      verified: true,
      lastActivityAt: new Date(),
    },
  });
}
