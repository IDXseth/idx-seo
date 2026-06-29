export function isSuperUser(email?: string | null): boolean {
  return !!email?.endsWith('@idx.inc')
}

export function canWrite(
  userId: string,
  userEmail: string | null | undefined,
  batchOwnerId: string
): boolean {
  return userId === batchOwnerId || isSuperUser(userEmail)
}
