import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Settings Service - Manages app settings with reactive state management
 * 
 * Provides centralized settings management with automatic persistence
 * and reactive updates for all components watching settings changes.
 */
@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly SETTINGS_STORAGE_KEY = 'app_settings';
  
  private defaultSettings: AppSettings = {
    activeSyncUpload: false
  };

  private settingsSubject = new BehaviorSubject<AppSettings>(this.defaultSettings);

  constructor() {
    this.loadSettings();
  }

  /**
   * Observable stream of settings
   * Components can subscribe to get automatic updates when settings change
   */
  get settings$(): Observable<AppSettings> {
    return this.settingsSubject.asObservable();
  }

  /**
   * Get current settings synchronously
   */
  get currentSettings(): AppSettings {
    return this.settingsSubject.value;
  }

  /**
   * Get specific setting - ActiveSync Upload status
   */
  get isActiveSyncEnabled(): boolean {
    return this.settingsSubject.value.activeSyncUpload;
  }

  /**
   * Enable or disable ActiveSync Upload
   */
  async setActiveSyncUpload(enabled: boolean): Promise<void> {
    const currentSettings = this.settingsSubject.value;
    const updatedSettings: AppSettings = {
      ...currentSettings,
      activeSyncUpload: enabled
    };
    
    await this.saveSettings(updatedSettings);
    this.settingsSubject.next(updatedSettings);
  }

  /**
   * Load settings from persistent storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: this.SETTINGS_STORAGE_KEY });
      if (value) {
        const savedSettings = JSON.parse(value) as AppSettings;
        const settings = { ...this.defaultSettings, ...savedSettings };
        this.settingsSubject.next(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  /**
   * Save settings to persistent storage
   */
  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await Preferences.set({
        key: this.SETTINGS_STORAGE_KEY,
        value: JSON.stringify(settings)
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  }
}

/**
 * App Settings Interface
 * Add new settings here as the app grows
 */
export interface AppSettings {
  activeSyncUpload: boolean;
}
