'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { isAddress } from 'ethers';

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

interface PreferencesModalProps {
  open: boolean;
  onClose: () => void;
  userAddress: string;
}

export default function PreferencesModal({ open, onClose, userAddress }: PreferencesModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [useOwnKeys, setUseOwnKeys] = useState(true);
  const [delegateAddress, setDelegateAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState('');
  const [noDefault, setNoDefault] = useState(true);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      const prefs = await apiService.getPreferences();

      // Determine if using own keys or delegate
      const isOwnKeys = prefs.api_address.toLowerCase() === userAddress.toLowerCase();
      setUseOwnKeys(isOwnKeys);
      setDelegateAddress(isOwnKeys ? '' : prefs.api_address);

      // Set model state
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  // Load preferences when modal opens
  useEffect(() => {
    if (open) {
      loadPreferences();
    }
  }, [open, loadPreferences]);

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

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validate delegate address if not using own keys
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

      const apiAddress = useOwnKeys ? userAddress : delegateAddress;
      const defaultModel = noDefault ? null : (selectedModel || customModel || null);

      await apiService.updatePreferences({
        api_address: apiAddress,
        default_model: defaultModel,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Preferences</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* API Keys Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">API Keys</h3>
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

                  {/* Delegate address input */}
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

                {/* No default checkbox */}
                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <input
                    type="checkbox"
                    checked={noDefault}
                    onChange={(e) => handleNoDefaultChange(e.target.checked)}
                    className="w-4 h-4 text-teal-700 focus:ring-teal-600 rounded"
                  />
                  <span className="text-sm text-gray-700">No default model</span>
                </label>

                {/* Popular models */}
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

                {/* Custom model input */}
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

              {/* Error Display */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Success Display */}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800">Preferences saved successfully!</p>
                </div>
              )}

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={saving || (addressError !== null)}
                className="w-full py-3 px-4 rounded-lg font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ backgroundColor: '#004f4f' }}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
