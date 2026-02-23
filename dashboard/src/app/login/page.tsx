'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  connectMetaMask,
  createEIP712Message,
  signMessage,
  formatTokenExport,
  formatExpirationTime,
  copyToClipboard,
  getApiBaseUrl
} from '@/lib/auth';
import { NETWORK } from '@/lib/config';

const TOKEN_TTL = 604800; // 7 days

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const [step, setStep] = useState<'connect' | 'sign' | 'success'>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      setLoading(true);
      const addr = await connectMetaMask();
      setAddress(addr);
      setStep('sign');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    try {
      setError(null);
      setLoading(true);

      if (!address) {
        throw new Error('No address');
      }

      // Check and switch network if needed
      const expectedChainId = parseInt(NETWORK.chainId, 16);
      const hexChainId = '0x' + expectedChainId.toString(16);
      const currentChainId = await window.ethereum?.request({
        method: 'eth_chainId'
      }) as string;

      if (parseInt(currentChainId, 16) !== expectedChainId) {
        try {
          await window.ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }]
          });
        } catch (switchError: unknown) {
          if ((switchError as { code?: number }).code === 4902) {
            // Network not found, add it
            await window.ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: hexChainId,
                chainName: NETWORK.name,
                rpcUrls: [NETWORK.rpcUrl],
                nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
                blockExplorerUrls: NETWORK.explorer ? [NETWORK.explorer] : []
              }]
            });
          } else {
            throw switchError;
          }
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const expiration = now + TOKEN_TTL;

      const typedData = createEIP712Message(address, expiration);
      const signature = await signMessage(typedData);

      await auth.login(address, expiration, signature);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyExport = async () => {
    if (auth.token) {
      const success = await copyToClipboard(formatTokenExport(auth.token));
      if (success) {
        setCopiedText('export');
        setTimeout(() => setCopiedText(null), 2000);
      }
    }
  };

  const handleCopyToken = async () => {
    if (auth.token) {
      const success = await copyToClipboard(auth.token);
      if (success) {
        setCopiedText('token');
        setTimeout(() => setCopiedText(null), 2000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Ekai Gateway</h1>
          <p className="text-gray-600">Web3 Authorization for LLM Inference</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {step === 'connect' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Authorize Your Wallet</h2>
              <p className="text-gray-600 mb-6">
                Sign with your Web3 wallet to authorize LLM inference. <br />
                <span className="text-sm">We only verify you own this wallet address - no private keys or transactions.</span>
              </p>

              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 mb-6"
              >
                {loading ? 'Connecting...' : 'Connect MetaMask'}
              </button>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Connect your MetaMask wallet</li>
                  <li>Sign a message to prove wallet ownership</li>
                  <li>Get an API token valid for 7 days</li>
                  <li>Use with Claude Code or Codex for LLM inference</li>
                </ol>
              </div>
            </>
          )}

          {step === 'sign' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign Authorization</h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-sm font-mono text-gray-700 break-all">{address}</p>
              </div>
              <p className="text-sm text-gray-600 mb-6">
                MetaMask will ask you to sign a message. This proves you own this wallet and authorizes LLM inference requests.
              </p>
              <button
                onClick={handleSign}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 mb-3"
              >
                {loading ? 'Signing...' : 'Sign Authorization'}
              </button>
              <button
                onClick={() => {
                  setAddress(null);
                  setStep('connect');
                }}
                className="w-full py-2 px-4 text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Back
              </button>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="text-center mb-6">
                <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Successful!</h2>
                <p className="text-gray-600">Your token is valid for 7 days</p>
              </div>

              {auth.token && (
                <div className="space-y-6 mb-6">
                  {/* Claude Code Instructions */}
                  <div className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                    <h3 className="font-semibold text-indigo-900 mb-3">For Claude Code</h3>
                    <div className="space-y-3">
                      <p className="text-sm text-indigo-800">
                        Copy these commands to use the gateway with Claude Code:
                      </p>
                      <div className="bg-black text-green-400 rounded p-3 font-mono text-sm whitespace-pre-wrap break-words mb-2">
                        {formatTokenExport(auth.token)}
                        <button
                          onClick={handleCopyExport}
                          className="ml-2 text-green-600 hover:text-green-400"
                        >
                          {copiedText === 'export' ? '✓' : 'copy'}
                        </button>
                      </div>
                      <p className="text-xs text-indigo-700">
                        Then run: <code className="bg-white px-2 py-1 rounded">claude-code &quot;your command&quot;</code>
                      </p>
                    </div>
                  </div>

                  {/* Codex Instructions */}
                  <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                    <h3 className="font-semibold text-orange-900 mb-3">For Codex</h3>
                    <div className="space-y-3">
                      <p className="text-sm text-orange-800">
                        Configure Codex to use the gateway. Edit <code className="bg-white px-2 py-1 rounded">~/.codex/config.toml</code>:
                      </p>
                      <div className="bg-black text-amber-300 rounded p-3 font-mono text-xs whitespace-pre-wrap break-words mb-2">
{`model_provider = "ekai"

[model_providers.ekai]
name = "Ekai Gateway"
base_url = "${getApiBaseUrl()}/v1"
wire_api = "chat"`}
                      </div>
                      <p className="text-xs text-orange-700 mb-2">
                        Then set your token:
                      </p>
                      <div className="bg-black text-green-400 rounded p-3 font-mono text-sm break-words">
                        {`export OPENAI_API_KEY=${auth.token}`}
                        <button
                          onClick={handleCopyToken}
                          className="ml-2 text-green-600 hover:text-green-400"
                        >
                          {copiedText === 'token' ? '✓' : 'copy'}
                        </button>
                      </div>
                      <p className="text-xs text-orange-700">
                        Then run: <code className="bg-white px-2 py-1 rounded">codex --model &quot;gpt-4o&quot;</code>
                      </p>
                    </div>
                  </div>

                  {/* Token Details */}
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Token Details</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-600">API Token</label>
                        <div className="bg-gray-100 rounded p-2 font-mono text-xs text-gray-700 break-all mt-1">
                          {auth.token}
                          <button
                            onClick={handleCopyToken}
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            {copiedText === 'token' ? '✓' : 'copy'}
                          </button>
                        </div>
                      </div>
                      {auth.expiresAt && (
                        <div>
                          <label className="text-xs font-semibold text-gray-600">Expires In</label>
                          <p className="text-sm text-yellow-800 mt-1">
                            {formatExpirationTime(auth.expiresAt)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push('/')}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Go to Dashboard
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>MetaMask required • Web3 authorization only • No private keys sent</p>
        </div>
      </div>
    </div>
  );
}
