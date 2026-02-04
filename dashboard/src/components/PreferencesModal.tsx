'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { isAddress } from 'ethers';

// Popular models shown at top
const POPULAR_MODELS = [
  { id: 'claude-haiku-4-5', provider: 'Anthropic' },
  { id: 'claude-opus-4-5', provider: 'Anthropic' },
  { id: 'grok-code-fast-1', provider: 'xAI' },
  { id: 'gpt-5.2', provider: 'OpenAI' },
  { id: 'gpt-5.1-codex', provider: 'OpenAI' },
  { id: 'gpt-5.2-pro', provider: 'OpenAI' },
  { id: 'gpt-4o', provider: 'OpenAI' },
  { id: 'kimi-k2.5', provider: 'Moonshot' },
  { id: 'deepseek-v3.2', provider: 'DeepSeek' },
  { id: 'kimi-k2', provider: 'Moonshot' },
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
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [customModelInput, setCustomModelInput] = useState('');

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

      // Set model preferences
      if (prefs.model_preferences && prefs.model_preferences.length > 0) {
        setSelectedModels(prefs.model_preferences);
      } else {
        setSelectedModels([POPULAR_MODELS[0].id]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
      setSelectedModels([POPULAR_MODELS[0].id]);
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

  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        // Don't allow deselecting if it's the only one
        if (prev.length === 1) return prev;
        return prev.filter(m => m !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  };

  const handleAddCustomModel = () => {
    const model = customModelInput.trim();
    if (model && !selectedModels.includes(model)) {
      setSelectedModels(prev => [...prev, model]);
      setCustomModelInput('');
    }
  };

  const handleRemoveCustomModel = (modelId: string) => {
    if (selectedModels.length > 1) {
      setSelectedModels(prev => prev.filter(m => m !== modelId));
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      if (selectedModels.length === 0) {
        setError('Please select at least one model');
        return;
      }

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

      await apiService.updatePreferences({
        api_address: apiAddress,
        model_preferences: selectedModels,
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

              {/* Model Preferences Section */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-gray-900">Select Your Models</h3>
                  <a
                    href="/models"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:text-teal-800 underline"
                  >
                    View full catalogue
                  </a>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Choose from recommended models or add custom ones.
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {POPULAR_MODELS.map((model, index) => {
                    const isSelected = selectedModels.includes(model.id);
                    return (
                      <label
                        key={model.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleModelToggle(model.id)}
                          className="w-4 h-4 text-teal-700 focus:ring-teal-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 truncate block">{model.id}</span>
                          <span className="text-xs text-gray-500">{model.provider}</span>
                        </div>
                        {index === 0 && !isSelected && (
                          <span className="text-xs text-gray-400">Recommended</span>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Custom models that aren't in popular list */}
                {selectedModels.filter(m => !POPULAR_MODELS.some(p => p.id === m)).length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-600 mb-2">Custom models:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedModels
                        .filter(m => !POPULAR_MODELS.some(p => p.id === m))
                        .map(model => (
                          <span
                            key={model}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-teal-50 text-teal-700 rounded-full border border-teal-200"
                          >
                            {model}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomModel(model)}
                              className="text-teal-500 hover:text-teal-700"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                    </div>
                  </div>
                )}

                {/* Add custom model */}
                <div className="mt-4">
                  <label className="block text-xs text-gray-600 mb-1">Add custom model:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomModel())}
                      placeholder="e.g., grok-3"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-teal-500 focus:outline-none focus:ring-2"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomModel}
                      disabled={!customModelInput.trim()}
                      className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
                      style={{ backgroundColor: '#004f4f' }}
                    >
                      Add
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-3">
                  Selected: {selectedModels.length} model{selectedModels.length !== 1 ? 's' : ''}
                </p>
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
                disabled={saving || addressError !== null || selectedModels.length === 0}
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
