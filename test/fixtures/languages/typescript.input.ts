type User = {
  id: string;
  email: string;
  roles: string[];
};

export function canInviteUser(actor: User, targetEmail: string): boolean {
  // TODO #1: Move role checks into the authorization service
  if (!actor.roles.includes("admin")) {
    return false;
  }

  const normalizedEmail = targetEmail.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    return false;
  }

  // TODO #5: Reject disposable email domains
  return normalizedEmail !== actor.email.toLowerCase();
}

export async function sendInvite(email: string): Promise<void> {
  const payload = {
    email,
    requestedAt: new Date().toISOString()
  };

  // TODO #8: Add retry behavior around the invite service
  await Promise.resolve(payload);
}
