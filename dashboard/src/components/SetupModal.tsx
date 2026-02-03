'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiService, getApiBaseUrl } from '@/lib/api';
import { isAddress } from 'ethers';
import {
  connectMetaMask,
  createEIP712Message,
  signMessage,
  formatTokenExport,
  formatExpirationTime,
  copyToClipboard
} from '@/lib/auth';

const TOKEN_TTL = 604800; // 7 days

const POPULAR_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o3-mini',
  'gemini-2.0-flash',
  'deepseek-chat',
  'llama-3.3-70b-versatile',
];

interface SetupModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SetupModal({ open, onClose }: SetupModalProps) {
  const auth = useAuth();
  const [step, setStep] = useState<'connect' | 'sign' | 'preferences' | 'success'>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Preferences state
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [useOwnKeys, setUseOwnKeys] = useState(true);
  const [delegateAddress, setDelegateAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState('');
  const [noDefault, setNoDefault] = useState(true);

  // Load preferences when entering preferences step
  const loadPreferences = useCallback(async () => {
    if (!auth.address) return;

    try {
      setPrefsLoading(true);
      setError(null);
      const prefs = await apiService.getPreferences();

      const isOwnKeys = prefs.api_address.toLowerCase() === auth.address.toLowerCase();
      setUseOwnKeys(isOwnKeys);
      setDelegateAddress(isOwnKeys ? '' : prefs.api_address);

      if (prefs.default_model) {
        setNoDefault(false);
        if (POPULAR_MODELS.includes(prefs.default_model)) {
          setSelectedModel(prefs.default_model);
          setCustomModel('');
        } else {
          setSelectedModel(null);
          setCustomModel(prefs.default_model);
        }
      } else {
        setNoDefault(true);
        setSelectedModel(null);
        setCustomModel('');
      }
    } catch {
      // If preferences don't exist yet, that's fine - use defaults
      console.log('No existing preferences, using defaults');
    } finally {
      setPrefsLoading(false);
    }
  }, [auth.address]);

  useEffect(() => {
    if (step === 'preferences') {
      loadPreferences();
    }
  }, [step, loadPreferences]);

  // Reset state when modal opens
  const resetState = () => {
    if (!auth.token) {
      setStep('connect');
      setAddress(null);
      setError(null);
    } else {
      setStep('success');
    }
  };

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

      // Check and switch network if needed (Oasis Sapphire Testnet)
      const chainId = 23295;
      const currentChainId = await window.ethereum?.request({
        method: 'eth_chainId'
      }) as string;

      if (parseInt(currentChainId, 16) !== chainId) {
        try {
          await window.ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x5aff' }]
          });
        } catch (switchError: unknown) {
          const err = switchError as { code?: number };
          if (err.code === 4902) {
            await window.ethereum?.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x5aff',
                chainName: 'Oasis Sapphire Testnet',
                rpcUrls: ['https://testnet.sapphire.oasis.io'],
                nativeCurrency: { name: 'ROSE', symbol: 'ROSE', decimals: 18 },
                blockExplorerUrls: ['https://testnet.explorer.oasis.io']
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
      setStep('preferences');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelegateAddressChange = (value: string) => {
    setDelegateAddress(value);
    if (value && !isAddress(value)) {
      setAddressError('Invalid Ethereum address');
    } else {
      setAddressError(null);
    }
  };

  const handleModelSelect = (model: string) => {
    setNoDefault(false);
    setSelectedModel(model);
    setCustomModel('');
  };

  const handleCustomModelChange = (value: string) => {
    setCustomModel(value);
    if (value) {
      setNoDefault(false);
      setSelectedModel(null);
    }
  };

  const handleNoDefaultChange = (checked: boolean) => {
    setNoDefault(checked);
    if (checked) {
      setSelectedModel(null);
      setCustomModel('');
    }
  };

  const handleSavePreferences = async () => {
    try {
      setPrefsSaving(true);
      setError(null);

      if (!useOwnKeys) {
        if (!delegateAddress) {
          setError('Please enter a delegate address');
          return;
        }
        if (!isAddress(delegateAddress)) {
          setError('Invalid Ethereum address');
          return;
        }
      }

      const apiAddress = useOwnKeys ? auth.address! : delegateAddress;
      const defaultModel = noDefault ? null : (selectedModel || customModel || null);

      await apiService.updatePreferences({
        api_address: apiAddress,
        default_model: defaultModel,
      });

      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  if (!open) return null;

  // Check if already connected
  if (open && step === 'connect' && auth.token) {
    setStep('success');
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'success' ? 'Setup Instructions' : step === 'preferences' ? 'Set Preferences' : 'Use Ekai Gateway'}
          </h2>
          <button
            onClick={() => { onClose(); resetState(); }}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Connect Wallet */}
          {step === 'connect' && (
            <>
              <p className="text-gray-600 mb-6">
                Connect your wallet to authorize LLM inference through Ekai Gateway.
              </p>

              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ backgroundColor: '#004f4f' }}
              >
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>

              <div className="mt-6 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Connect your wallet</li>
                  <li>Sign a message to verify ownership</li>
                  <li>Get an API token (valid 7 days)</li>
                  <li>Use with Claude Code or Codex</li>
                </ol>
              </div>
            </>
          )}

          {/* Step 2: Sign Message */}
          {step === 'sign' && (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-gray-500 mb-1">Connected wallet</p>
                <p className="text-sm font-mono text-gray-800 break-all">{address}</p>
              </div>

              <p className="text-gray-600 mb-6">
                Sign a message to authorize the gateway. This proves wallet ownership - no transaction required.
              </p>

              <button
                onClick={handleSign}
                disabled={loading}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ backgroundColor: '#004f4f' }}
              >
                {loading ? 'Signing...' : 'Sign & Authorize'}
              </button>

              <button
                onClick={() => { setStep('connect'); setAddress(null); }}
                className="w-full mt-3 py-2 px-4 text-gray-600 hover:text-gray-800"
              >
                Back
              </button>
            </>
          )}

          {/* Step 3: Preferences */}
          {step === 'preferences' && (
            <>
              {prefsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Success indicator */}
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                    <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-green-800">Connected!</p>
                      <p className="text-sm text-green-600">Token valid for {auth.expiresAt ? formatExpirationTime(auth.expiresAt) : '7 days'}</p>
                    </div>
                  </div>

                  {/* API Keys Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Whose API Keys to Use</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="apiKeys"
                          checked={useOwnKeys}
                          onChange={() => setUseOwnKeys(true)}
                          className="w-4 h-4 text-teal-700 focus:ring-teal-600"
                        />
                        <span className="text-sm text-gray-700">Use my own API keys</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="apiKeys"
                          checked={!useOwnKeys}
                          onChange={() => setUseOwnKeys(false)}
                          className="w-4 h-4 text-teal-700 focus:ring-teal-600"
                        />
                        <span className="text-sm text-gray-700">Use another wallet&apos;s keys (as delegate)</span>
                      </label>

                      {!useOwnKeys && (
                        <div className="ml-7">
                          <input
                            type="text"
                            value={delegateAddress}
                            onChange={(e) => handleDelegateAddressChange(e.target.value)}
                            placeholder="0x..."
                            className={`w-full px-3 py-2 border rounded-lg text-sm font-mono ${
                              addressError ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-teal-500'
                            } focus:outline-none focus:ring-2`}
                          />
                          {addressError && (
                            <p className="text-xs text-red-600 mt-1">{addressError}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Enter the wallet address whose API keys you want to use
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <hr className="border-gray-200" />

                  {/* Default Model Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Default Model</h3>
                    <p className="text-xs text-gray-500 mb-3">
                      Used when client sends &quot;ekai-config&quot; as the model
                    </p>

                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <input
                        type="checkbox"
                        checked={noDefault}
                        onChange={(e) => handleNoDefaultChange(e.target.checked)}
                        className="w-4 h-4 text-teal-700 focus:ring-teal-600 rounded"
                      />
                      <span className="text-sm text-gray-700">No default model</span>
                    </label>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {POPULAR_MODELS.map((model) => (
                        <button
                          key={model}
                          onClick={() => handleModelSelect(model)}
                          disabled={noDefault}
                          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                            selectedModel === model
                              ? 'bg-teal-700 text-white border-teal-700'
                              : noDefault
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-teal-500 hover:text-teal-700'
                          }`}
                        >
                          {model}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Or enter custom model ID:</label>
                      <input
                        type="text"
                        value={customModel}
                        onChange={(e) => handleCustomModelChange(e.target.value)}
                        disabled={noDefault}
                        placeholder="e.g., claude-opus-4-20250514"
                        className={`w-full px-3 py-2 border rounded-lg text-sm ${
                          noDefault
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                            : 'border-gray-300 focus:ring-teal-500 focus:outline-none focus:ring-2'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSavePreferences}
                    disabled={prefsSaving || (addressError !== null)}
                    className="w-full py-3 px-4 rounded-lg font-semibold text-white disabled:opacity-60 transition-colors"
                    style={{ backgroundColor: '#004f4f' }}
                  >
                    {prefsSaving ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step 4: Success - Show Instructions */}
          {step === 'success' && auth.token && (() => {
            const token = auth.token;
            return (
            <div className="space-y-6">
              {/* Success indicator */}
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-green-800">Connected!</p>
                  <p className="text-sm text-green-600">Token valid for {auth.expiresAt ? formatExpirationTime(auth.expiresAt) : '7 days'}</p>
                </div>
              </div>

              {/* Claude Code Instructions */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Claude Code
                </h3>
                <p className="text-sm text-gray-600 mb-3">Run this in your terminal:</p>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
                    {formatTokenExport(token)}
                  </pre>
                  <button
                    onClick={() => handleCopy(formatTokenExport(token), 'claude')}
                    className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                  >
                    {copiedField === 'claude' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Then run: <code className="bg-gray-100 px-2 py-1 rounded">claude</code>
                </p>
              </div>

              {/* Codex Instructions */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  OpenAI Codex
                </h3>
                <p className="text-sm text-gray-600 mb-3">Add to <code className="bg-gray-100 px-2 py-1 rounded">~/.codex/config.toml</code>:</p>
                <div className="relative">
                  <pre className="bg-gray-900 text-amber-300 rounded-lg p-4 text-xs overflow-x-auto">
{`model_provider = "ekai"

[model_providers.ekai]
name = "Ekai Gateway"
base_url = "${getApiBaseUrl()}/v1"
wire_api = "chat"`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`model_provider = "ekai"\n\n[model_providers.ekai]\nname = "Ekai Gateway"\nbase_url = "${getApiBaseUrl()}/v1"\nwire_api = "chat"`, 'codex-config')}
                    className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                  >
                    {copiedField === 'codex-config' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-3 mb-2">Then set your token:</p>
                <div className="relative">
                  <pre className="bg-gray-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
                    {`export OPENAI_API_KEY=${token}`}
                  </pre>
                  <button
                    onClick={() => handleCopy(`export OPENAI_API_KEY=${token}`, 'codex-token')}
                    className="absolute top-2 right-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded"
                  >
                    {copiedField === 'codex-token' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Then run: <code className="bg-gray-100 px-2 py-1 rounded">codex</code>
                </p>
              </div>

              {/* Done button */}
              <button
                onClick={onClose}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-colors"
                style={{ backgroundColor: '#004f4f' }}
              >
                Done
              </button>
            </div>
            );
          })()}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
