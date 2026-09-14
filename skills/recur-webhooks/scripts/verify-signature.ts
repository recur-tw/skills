/**
 * Verify Recur webhook signature
 *
 * Usage:
 *   npx tsx verify-signature.ts <payload> <signature> <secret>
 *
 * Example:
 *   npx tsx verify-signature.ts '{"type":"checkout.completed"}' 'K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=' 'whsec_xxx'
 *
 * Recur signs the raw body with HMAC-SHA256 and sends it Base64-encoded in
 * the X-Recur-Signature header (same as recur.webhooks.verify() in recur-tw/server).
 */

import crypto from 'crypto'

function verifySignature(payload: string, signature: string | null | undefined, secret: string): boolean {
  // Match recur.webhooks.verify(): reject a missing X-Recur-Signature header and a blank
  // secret before hashing, instead of throwing or verifying against an empty HMAC key.
  if (!signature || !secret) return false

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64')

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function main() {
  const args = process.argv.slice(2)

  if (args.length < 3) {
    console.log('Usage: npx tsx verify-signature.ts <payload> <signature> <secret>')
    console.log('')
    console.log('Example:')
    console.log(
      "  npx tsx verify-signature.ts '{\"type\":\"test\"}' 'abc123' 'whsec_xxx'"
    )
    process.exit(1)
  }

  const [payload, signature, secret] = args

  console.log('Payload:', payload.substring(0, 50) + '...')
  console.log('Signature:', signature.substring(0, 20) + '...')
  console.log('')

  const isValid = verifySignature(payload, signature, secret)

  if (isValid) {
    console.log('✅ Signature is VALID')
  } else {
    console.log('❌ Signature is INVALID')

    // Show expected signature for debugging
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64')
    console.log('')
    console.log('Expected:', expected)
    console.log('Received:', signature)
  }

  process.exit(isValid ? 0 : 1)
}

main()
