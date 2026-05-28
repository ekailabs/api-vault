import { NextRequest, NextResponse } from 'next/server';
import { isAddress, JsonRpcProvider, Wallet, parseEther } from 'ethers';
import { SAPPHIRE_TX_OPTIONS } from '@/lib/contract';
import { getRpcUrl } from '@/lib/server-config';

// --- Configuration -----------------------------------------------------------

const DRIP_PRIVATE_KEY = process.env.DRIP_PRIVATE_KEY;
const DRIP_AMOUNT = process.env.DRIP_AMOUNT || '0.05'; // ROSE

// Minimum balance the recipient must already have to skip the drip
const MIN_BALANCE = parseEther(DRIP_AMOUNT);

// --- In-memory state (resets on server restart) ------------------------------

/** Addresses that have already been funded this process lifetime. */
const funded = new Set<string>();

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

  const normalized = address.toLowerCase();

  // 3. Rate limit by IP
  if (isRateLimited(getClientIp(req))) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  // 4. Already funded this session?
  if (funded.has(normalized)) {
    return NextResponse.json(
      { error: 'Already funded', address },
      { status: 409 },
    );
  }

  // 5. On-chain checks
  const provider = new JsonRpcProvider(getRpcUrl());
  const balance = await provider.getBalance(address);

  if (balance >= MIN_BALANCE) {
    funded.add(normalized);
    return NextResponse.json(
      { error: 'Already has sufficient balance', address },
      { status: 409 },
    );
  }

  // 6. Funder balance check
  const funder = new Wallet(DRIP_PRIVATE_KEY, provider);
  const funderBalance = await funder.provider!.getBalance(funder.address);
  const dripWei = parseEther(DRIP_AMOUNT);

  if (funderBalance < dripWei * BigInt(2)) {
    // Keep a buffer so funder can cover gas
    return NextResponse.json(
      { error: 'Funder wallet low on funds' },
      { status: 503 },
    );
  }

  // 7. Send ROSE
  try {
    const tx = await funder.sendTransaction({
      to: address,
      value: dripWei,
      ...SAPPHIRE_TX_OPTIONS,
    });

    funded.add(normalized);

    return NextResponse.json({
      txHash: tx.hash,
      amount: DRIP_AMOUNT,
    });
  } catch (err) {
    console.error('Drip tx failed:', err);
    return NextResponse.json(
      { error: 'Transaction failed' },
      { status: 500 },
    );
  }
}
