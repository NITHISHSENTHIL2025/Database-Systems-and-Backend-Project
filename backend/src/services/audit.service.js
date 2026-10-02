import { prisma } from '../config/prisma.js';

export async function writeAudit({ actorUserId = null, action, entity, entityId = null, metadata = null }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId,
        action,
        entity,
        entityId: entityId == null ? null : String(entityId),
        metadata
      }
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}
