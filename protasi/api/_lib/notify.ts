// Sends a plain notification email via Resend (https://resend.com). Best-effort —
// callers should not let a notification failure block the actual request (a sign-up
// should still succeed even if the "hey, someone signed up" email doesn't go out).
export async function notifyAdmin(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.ADMIN_NOTIFY_EMAIL
  if (!apiKey || !to) return // not configured — silently skip, don't break the caller

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Protasi <onboarding@resend.dev>',
        to,
        subject,
        text,
      }),
    })
  } catch (e) {
    console.error('notifyAdmin failed:', e)
  }
}
