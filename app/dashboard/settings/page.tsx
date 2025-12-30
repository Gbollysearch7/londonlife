'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/header';
import { getPreferences, savePreferences, type UserPreferences } from '@/lib/storage';
import { STYLE_PROMPTS } from '@/lib/prompts';

type SettingsSection = 'general' | 'defaults' | 'privacy' | 'account';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = getPreferences();
    setPreferences(prefs);
  }, []);

  const handleSave = () => {
    if (preferences) {
      savePreferences(preferences);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const updatePreference = <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    if (preferences) {
      setPreferences({ ...preferences, [key]: value });
    }
  };

  const sections = [
    { id: 'general' as const, label: 'General', icon: 'settings' },
    { id: 'defaults' as const, label: 'Default Settings', icon: 'tune' },
    { id: 'privacy' as const, label: 'Privacy', icon: 'shield' },
    { id: 'account' as const, label: 'Account', icon: 'person' },
  ];

  if (!preferences) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar navigation */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-2 h-fit lg:sticky lg:top-8">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                activeSection === section.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{section.icon}</span>
              <span className="font-medium">{section.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6">
          {/* General Settings */}
          {activeSection === 'general' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-1">General Settings</h2>
                <p className="text-zinc-500 text-sm">Customize your SnapStudio experience</p>
              </div>

              {/* Theme */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">palette</span>
                  Appearance
                </h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
                    { value: 'light', label: 'Light', icon: 'light_mode' },
                    { value: 'system', label: 'System', icon: 'computer' },
                  ].map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => updatePreference('theme', theme.value as 'dark' | 'light' | 'system')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                        preferences.theme === theme.value
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl">{theme.icon}</span>
                      <span className="text-sm font-medium">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">notifications</span>
                  Notifications
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 cursor-pointer">
                    <div>
                      <p className="font-medium">Email Notifications</p>
                      <p className="text-sm text-zinc-500">Receive updates about your generations</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={preferences.emailNotifications}
                        onChange={(e) => updatePreference('emailNotifications', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        preferences.emailNotifications ? 'bg-indigo-600' : 'bg-zinc-600'
                      }`}>
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform absolute top-0.5 ${
                          preferences.emailNotifications ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 cursor-pointer">
                    <div>
                      <p className="font-medium">Marketing Updates</p>
                      <p className="text-sm text-zinc-500">New features and special offers</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={preferences.marketingEmails}
                        onChange={(e) => updatePreference('marketingEmails', e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        preferences.marketingEmails ? 'bg-indigo-600' : 'bg-zinc-600'
                      }`}>
                        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform absolute top-0.5 ${
                          preferences.marketingEmails ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Default Settings */}
          {activeSection === 'defaults' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-1">Default Settings</h2>
                <p className="text-zinc-500 text-sm">Set your preferred defaults for new generations</p>
              </div>

              {/* Default Style */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">style</span>
                  Default Style
                </h3>
                <select
                  value={preferences.defaultStyle}
                  onChange={(e) => updatePreference('defaultStyle', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value="">No default (choose each time)</option>
                  {STYLE_PROMPTS.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Default Background */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">wallpaper</span>
                  Default Background
                </h3>
                <select
                  value={preferences.defaultBackground}
                  onChange={(e) => updatePreference('defaultBackground', e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:border-indigo-500"
                >
                  <option value="studio">Studio (Neutral)</option>
                  <option value="office">Modern Office</option>
                  <option value="outdoor">Outdoor/Nature</option>
                  <option value="gradient">Abstract Gradient</option>
                  <option value="custom">Custom (specify each time)</option>
                </select>
              </div>

              {/* Default Variations */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">grid_view</span>
                  Default Number of Variations
                </h3>
                <div className="flex gap-3">
                  {[1, 2, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => updatePreference('defaultVariations', num)}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                        preferences.defaultVariations === num
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {num} {num === 1 ? 'Image' : 'Images'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Auto-save */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">save</span>
                  Auto-save Options
                </h3>
                <label className="flex items-center justify-between p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 cursor-pointer">
                  <div>
                    <p className="font-medium">Auto-save to Gallery</p>
                    <p className="text-sm text-zinc-500">Automatically save all generated images</p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={preferences.autoSaveToGallery}
                      onChange={(e) => updatePreference('autoSaveToGallery', e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-12 h-6 rounded-full transition-colors ${
                      preferences.autoSaveToGallery ? 'bg-indigo-600' : 'bg-zinc-600'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform absolute top-0.5 ${
                        preferences.autoSaveToGallery ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Privacy Settings */}
          {activeSection === 'privacy' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-1">Privacy Settings</h2>
                <p className="text-zinc-500 text-sm">Control your data and privacy preferences</p>
              </div>

              {/* Data retention */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">schedule</span>
                  Data Retention
                </h3>
                <div className="p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                  <p className="text-sm text-zinc-400 mb-3">
                    Your uploaded photos are processed securely and deleted after generation.
                    Generated images are stored locally in your browser.
                  </p>
                  <div className="flex items-center gap-2 text-green-400">
                    <span className="material-symbols-outlined text-lg">verified_user</span>
                    <span className="text-sm font-medium">Your photos are never stored on our servers</span>
                  </div>
                </div>
              </div>

              {/* Clear data */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">delete_forever</span>
                  Clear Data
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (confirm('Clear all generated images from your gallery? This cannot be undone.')) {
                        localStorage.removeItem('snapstudio_gallery');
                        alert('Gallery cleared successfully');
                      }
                    }}
                    className="w-full p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Clear Gallery</p>
                        <p className="text-sm text-zinc-500">Remove all saved headshots</p>
                      </div>
                      <span className="material-symbols-outlined text-zinc-500">chevron_right</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Clear all generation history? This cannot be undone.')) {
                        localStorage.removeItem('snapstudio_history');
                        alert('History cleared successfully');
                      }
                    }}
                    className="w-full p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Clear History</p>
                        <p className="text-sm text-zinc-500">Remove all generation records</p>
                      </div>
                      <span className="material-symbols-outlined text-zinc-500">chevron_right</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('Clear ALL local data including gallery, history, and preferences? This cannot be undone.')) {
                        localStorage.removeItem('snapstudio_gallery');
                        localStorage.removeItem('snapstudio_history');
                        localStorage.removeItem('snapstudio_preferences');
                        localStorage.removeItem('snapstudio_credits');
                        alert('All data cleared successfully');
                        window.location.reload();
                      }
                    }}
                    className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-400">Clear All Data</p>
                        <p className="text-sm text-red-400/70">Remove everything and start fresh</p>
                      </div>
                      <span className="material-symbols-outlined text-red-400">warning</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Account Settings */}
          {activeSection === 'account' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold mb-1">Account Settings</h2>
                <p className="text-zinc-500 text-sm">Manage your account details</p>
              </div>

              {/* Profile */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">person</span>
                  Profile
                </h3>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl text-white">person</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">Guest User</p>
                    <p className="text-sm text-zinc-500">Sign in to sync across devices</p>
                  </div>
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium transition-colors">
                    Sign In
                  </button>
                </div>
              </div>

              {/* Subscription */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">workspace_premium</span>
                  Subscription
                </h3>
                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-semibold text-lg">Free Trial</p>
                      <p className="text-sm text-zinc-400">3 free headshots remaining</p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-sm font-medium">
                      Active
                    </span>
                  </div>
                  <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined">rocket_launch</span>
                    Upgrade to Pro
                  </button>
                </div>
              </div>

              {/* Export data */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-400">download</span>
                  Export Data
                </h3>
                <button
                  onClick={() => {
                    const data = {
                      gallery: JSON.parse(localStorage.getItem('snapstudio_gallery') || '[]'),
                      history: JSON.parse(localStorage.getItem('snapstudio_history') || '[]'),
                      preferences: JSON.parse(localStorage.getItem('snapstudio_preferences') || '{}'),
                    };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'snapstudio-export.json';
                    a.click();
                  }}
                  className="w-full p-4 rounded-xl bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-800 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Download Your Data</p>
                      <p className="text-sm text-zinc-500">Export gallery, history, and preferences</p>
                    </div>
                    <span className="material-symbols-outlined text-zinc-500">download</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              {saved && (
                <>
                  <span className="material-symbols-outlined text-green-400">check_circle</span>
                  <span className="text-green-400 text-sm">Settings saved!</span>
                </>
              )}
            </div>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-medium transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
