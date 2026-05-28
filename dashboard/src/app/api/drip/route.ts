import { NextRequest, NextResponse } from 'next/server';
import { formatEther, isAddress, JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { SAPPHIRE_TX_OPTIONS } from '@/lib/contract';
import { getRpcUrl } from '@/lib/server-config';

// --- Configuration -----------------------------------------------------------

const DRIP_PRIVATE_KEY = process.env.DRIP_PRIVATE_KEY;
const CONFIGURED_DRIP_AMOUNT = process.env.DRIP_AMOUNT
  ? parseEther(process.env.DRIP_AMOUNT)
  : BigInt(0);
const MIN_TARGET_BALANCE = parseEther('0.5'); // ROSE
const TARGET_BALANCE = CONFIGURED_DRIP_AMOUNT > MIN_TARGET_BALANCE
  ? CONFIGURED_DRIP_AMOUNT
  : MIN_TARGET_BALANCE;
const FUNDER_GAS_BUFFER = parseEther('0.05'); // ROSE

// Minimum balance the recipient must already have to skip the drip
const MIN_BALANCE = TARGET_BALANCE;

// --- In-memory state (resets on server restart) ------------------------------

/** IP → timestamps of recent requests (sliding window). */
const ipHits = new Map<string, number[]>();
const RATE_LIMIT = 5; // requests
const RATE_WINDOW_MS = 60_000; // per minute

// --- Helpers -----------------------------------------------------------------

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = ipHits.get(ip) ?? [];
  // Remove expired entries
  const recent = hits.filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return true;
  recent.push(now);
  ipHits.set(ip, recent);
  return false;
}

// --- Route handler -----------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Env check
  if (!DRIP_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'Drip faucet not configured' },
      { status: 503 },
    );
  }

  // 2. Parse body
  let address: string;
  try {
    const body = await req.json();
    address = body.address;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 });
  }

  // 3. Rate limit by IP
  if (isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // 4. On-chain checks
  const provider = new JsonRpcProvider(getRpcUrl());
  const balance = await provider.getBalance(address);

  if (balance >= MIN_BALANCE) {
    return NextResponse.json(
      { error: 'Already has sufficient balance', address },
      { status: 409 },
    );
  }

  // 5. Funder balance check
  const funder = new Wallet(DRIP_PRIVATE_KEY, provider);
  const funderBalance = await funder.provider!.getBalance(funder.address);
  const dripWei = TARGET_BALANCE - balance;

  if (funderBalance < dripWei + FUNDER_GAS_BUFFER) {
    // Keep a buffer so funder can cover gas
    return NextResponse.json(
      { error: 'Funder wallet low on funds' },
      { status: 503 },
    );
  }

  // 6. Send ROSE
  try {
    const tx = await funder.sendTransaction({
      to: address,
      value: dripWei,
      ...SAPPHIRE_TX_OPTIONS,
    });
    await tx.wait();

    return NextResponse.json({
      txHash: tx.hash,
      amount: formatEther(dripWei),
    });
  } catch (err) {
    console.error('Drip tx failed:', err);
    return NextResponse.json(
      { error: 'Transaction failed' },
      { status: 500 },
    );
  }
}
