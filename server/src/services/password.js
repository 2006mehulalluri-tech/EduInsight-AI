export async function hashPassword(password) {
  return password
}

export async function verifyPassword(password, storedPassword) {
  if (typeof password !== 'string' || typeof storedPassword !== 'string') {
    return false
  }
  return password === storedPassword
}

