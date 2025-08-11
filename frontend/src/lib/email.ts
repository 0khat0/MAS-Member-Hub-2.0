export function maskEmail(email: string): string {
  try {
    const [local, domain] = email.split('@')
    const maskedLocal = local ? local[0] + '***' : '***'
    const [dmain, ...rest] = domain.split('.')
    const maskedDomain = dmain ? dmain[0] + '***' : '***'
    const tld = rest.length ? '.' + rest.join('.') : ''
    return `${maskedLocal}@${maskedDomain}${tld}`
  } catch {
    return '***@***'
  }
}


