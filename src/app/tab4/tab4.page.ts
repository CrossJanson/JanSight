import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonItem, IonList, IonToggle } from '@ionic/angular/standalone';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { SettingsService } from '../services/settings.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page implements OnInit, OnDestroy {

  rangeValue: number = 8; // Initialize with the max value
  activeSyncUpload: boolean = false;
  
  private settingsSubscription?: Subscription;

  constructor(private settingsService: SettingsService) {}

  ngOnInit() {
    // Subscribe to settings changes
    this.settingsSubscription = this.settingsService.settings$.subscribe(settings => {
      this.activeSyncUpload = settings.activeSyncUpload;
    });
  }

  ngOnDestroy() {
    // Clean up subscription to prevent memory leaks
    if (this.settingsSubscription) {
      this.settingsSubscription.unsubscribe();
    }
  }

  /**
   * Handle ActiveSync toggle change
   */
  async onActiveSyncToggle(event: any) {
    const isEnabled = event.detail.checked;
    console.log('[Settings] ActiveSync Upload:', isEnabled ? 'ENABLED' : 'DISABLED');
    
    try {
      await this.settingsService.setActiveSyncUpload(isEnabled);
    } catch (error) {
      console.error('[Settings] Failed to save ActiveSync setting:', error);
      // Revert the toggle if save failed
      this.activeSyncUpload = !isEnabled;
    }
  }

}
