function requestMetadata(request) {
  const forwarded = request?.headers?.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() || request?.headers?.get("x-real-ip") || null,
    userAgent: request?.headers?.get("user-agent") || null,
  };
}

export async function appendAuditLog(execute, {
  request,
  user,
  action,
  targetType,
  targetId,
  sessionId = null,
  sessionTeamId = null,
  description,
  metadata = null,
  oldValues = null,
  newValues = null,
  reason = null,
}) {
  const { ipAddress, userAgent } = requestMetadata(request);
  await execute(`
    INSERT INTO activity_logs
      (user_id, username, action_type, target_type, target_id, eoc_session_id,
       session_team_id, description, ip_address, user_agent, metadata,
       old_values, new_values, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    user.id,
    user.username,
    action,
    targetType,
    String(targetId),
    sessionId,
    sessionTeamId,
    description,
    ipAddress,
    userAgent,
    metadata ? JSON.stringify(metadata) : null,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason,
  ]);
}

