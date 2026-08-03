/**
 * Simulated gateway journeys for bKash and card.
 *
 * These reproduce the *steps* a payer walks through so the checkout can be
 * built and demonstrated end to end. Two deliberate constraints:
 *
 *  1. Nothing entered here is ever transmitted. The card fields in particular
 *     stay in component state and are discarded when the modal closes — the
 *     server only ever learns the method and the amount.
 *  2. Each modal carries a "Sandbox" chip. Real gateways badge their test mode
 *     the same way, and it is the one place where removing the signal could
 *     lead someone to type a genuine card number into a form that is not a
 *     real payment processor.
 *
 * When live credentials land, replace these with the gateway's own hosted
 * redirect and delete this file.
 */

import { useEffect, useMemo, useState } from 'react'

import { bdt } from '../lib/format'
import { Button, Field, Input, Modal, cx } from './ui'

function SandboxChip() {
  return (
    <span className="pixel-tag border-ink bg-retro-yellow text-ink">Sandbox</span>
  )
}

function StepDots({ steps, current }) {
  return (
    <div className="mb-5 flex items-center gap-2">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-2">
          <span
            className={cx(
              'grid h-7 w-7 shrink-0 place-items-center border-2 border-ink text-xs font-bold',
              i < current
                ? 'bg-retro-green'
                : i === current
                  ? 'bg-retro-yellow'
                  : 'bg-paper text-slate/40',
            )}
          >
            {i < current ? '✓' : i + 1}
          </span>
          {i < steps.length - 1 && (
            <span className="h-1 flex-1 border-y-2 border-ink/25" />
          )}
        </div>
      ))}
    </div>
  )
}

/** Reusable "processing…" beat so the flow feels like a network round trip. */
function useProcessing(active, onDone, ms = 1400) {
  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(onDone, ms)
    return () => clearTimeout(timer)
  }, [active, onDone, ms])
}

function Processing({ label }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-4 w-4 border-2 border-ink bg-retro-yellow"
            style={{ animation: `blink 0.8s steps(1) ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <p className="text-base font-semibold">{label}</p>
      <p className="text-sm text-slate/70">Do not close this window.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ bKash */

export function BkashFlow({ open, amount, reference, onClose, onConfirm, submitting }) {
  const [step, setStep] = useState(0)
  const [wallet, setWallet] = useState('')
  const [otp, setOtp] = useState('')
  const [pin, setPin] = useState('')

  // Reset whenever the modal is reopened.
  useEffect(() => {
    if (open) {
      setStep(0)
      setWallet('')
      setOtp('')
      setPin('')
    }
  }, [open])

  useProcessing(step === 1, () => setStep(2))
  useProcessing(step === 4, () => onConfirm(), 1600)

  const walletValid = /^01[3-9]\d{8}$/.test(wallet)

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="bKash Payment">
      <div className="mb-5 flex items-center justify-between gap-3 border-[3px] border-ink bg-retro-pink p-4">
        <div>
          <p className="eyebrow text-ink/70">Merchant</p>
          <p className="text-base font-bold">StockAche</p>
          <p className="mt-1 text-sm text-ink/70">Invoice {reference || '—'}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-ink/70">Amount</p>
          <p className="price text-3xl">{bdt(amount)}</p>
        </div>
      </div>

      <StepDots steps={['Wallet', 'OTP', 'PIN', 'Done']} current={Math.min(step, 3)} />

      {step === 0 && (
        <>
          <Field
            label="bKash Account Number"
            hint="Any valid Bangladeshi mobile format, e.g. 01712345678."
          >
            <Input
              inputMode="numeric"
              value={wallet}
              onChange={(e) => setWallet(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="01XXXXXXXXX"
              className="price text-xl"
            />
          </Field>
          <div className="mt-5 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!walletValid} onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === 1 && <Processing label="Sending verification code…" />}

      {step === 2 && (
        <>
          <p className="text-base text-slate/85">
            A 6-digit code was sent to <strong>{wallet}</strong>. Enter any 6 digits to
            continue.
          </p>
          <div className="mt-4">
            <Field label="Verification Code">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="——————"
                className="price text-center text-2xl tracking-[0.4em]"
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={otp.length !== 6}
              onClick={() => setStep(3)}
            >
              Verify
            </Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <p className="text-base text-slate/85">
            Enter your wallet PIN to authorise <strong>{bdt(amount)}</strong>.
          </p>
          <div className="mt-4">
            <Field label="Wallet PIN">
              <Input
                type="password"
                inputMode="numeric"
                maxLength={5}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="•••••"
                className="price text-center text-2xl tracking-[0.4em]"
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={pin.length < 4}
              loading={submitting}
              onClick={() => setStep(4)}
            >
              Pay {bdt(amount)}
            </Button>
          </div>
        </>
      )}

      {step === 4 && <Processing label="Authorising with bKash…" />}

      <div className="mt-5 flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/25 pt-4">
        <SandboxChip />
        <p className="text-right text-sm text-slate/70">
          Test environment — no funds move and nothing you type is transmitted.
        </p>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------- Card */

const luhnish = (digits) => digits.length >= 15

export function CardFlow({ open, amount, reference, onClose, onConfirm, submitting }) {
  const [step, setStep] = useState(0)
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' })
  const [otp, setOtp] = useState('')

  useEffect(() => {
    if (open) {
      setStep(0)
      setCard({ number: '', name: '', expiry: '', cvv: '' })
      setOtp('')
    }
  }, [open])

  useProcessing(step === 1, () => setStep(2))
  useProcessing(step === 3, () => onConfirm(), 1600)

  const digits = card.number.replace(/\D/g, '')
  const scheme = useMemo(() => {
    if (digits.startsWith('4')) return 'VISA'
    if (/^5[1-5]/.test(digits)) return 'MASTERCARD'
    return 'CARD'
  }, [digits])

  const valid =
    luhnish(digits) &&
    card.name.trim().length > 2 &&
    /^\d{2}\/\d{2}$/.test(card.expiry) &&
    card.cvv.length >= 3

  const setField = (key) => (e) => setCard((c) => ({ ...c, [key]: e.target.value }))

  return (
    <Modal open={open} onClose={submitting ? () => {} : onClose} title="Card Payment">
      <div className="mb-5 flex items-center justify-between gap-3 border-[3px] border-ink bg-retro-blue p-4 text-paper">
        <div>
          <p className="eyebrow text-paper/70">Merchant</p>
          <p className="text-base font-bold">StockAche</p>
          <p className="mt-1 text-sm text-paper/70">Order {reference || '—'}</p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-paper/70">Amount</p>
          <p className="price text-3xl">{bdt(amount)}</p>
        </div>
      </div>

      <StepDots steps={['Card', '3-D Secure', 'Done']} current={Math.min(step, 2)} />

      {step === 0 && (
        <>
          <div className="space-y-4">
            <Field label="Card Number" hint={`Detected: ${scheme}`}>
              <Input
                inputMode="numeric"
                value={card.number}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '').slice(0, 16)
                  setCard((c) => ({
                    ...c,
                    number: raw.replace(/(.{4})/g, '$1 ').trim(),
                  }))
                }}
                placeholder="4111 1111 1111 1111"
                className="price text-xl"
                autoComplete="off"
              />
            </Field>

            <Field label="Name on Card">
              <Input
                value={card.name}
                onChange={setField('name')}
                placeholder="TANVIR AHMED"
                autoComplete="off"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Expiry">
                <Input
                  value={card.expiry}
                  onChange={(e) => {
                    let v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    if (v.length > 2) v = `${v.slice(0, 2)}/${v.slice(2)}`
                    setCard((c) => ({ ...c, expiry: v }))
                  }}
                  placeholder="MM/YY"
                  className="price"
                  autoComplete="off"
                />
              </Field>
              <Field label="CVV">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={card.cvv}
                  onChange={(e) =>
                    setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '') }))
                  }
                  placeholder="•••"
                  className="price"
                  autoComplete="off"
                />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1" disabled={!valid} onClick={() => setStep(1)}>
              Continue
            </Button>
          </div>
        </>
      )}

      {step === 1 && <Processing label="Contacting your bank…" />}

      {step === 2 && (
        <>
          <p className="text-base text-slate/85">
            Your bank wants to confirm this payment. Enter any 6 digits to approve.
          </p>
          <div className="mt-4">
            <Field label="One-Time Password">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="——————"
                className="price text-center text-2xl tracking-[0.4em]"
              />
            </Field>
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={otp.length !== 6}
              loading={submitting}
              onClick={() => setStep(3)}
            >
              Pay {bdt(amount)}
            </Button>
          </div>
        </>
      )}

      {step === 3 && <Processing label="Authorising payment…" />}

      <div className="mt-5 flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/25 pt-4">
        <SandboxChip />
        <p className="text-right text-sm text-slate/70">
          Test environment — card details stay in your browser and are never sent to our
          servers.
        </p>
      </div>
    </Modal>
  )
}
