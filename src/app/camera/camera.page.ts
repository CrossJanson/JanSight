import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { CameraMultiCapture, CameraOverlayOptions, CameraOverlayResult, initialize } from 'camera-multi-capture';
import { CameraService } from '../services/camera.service';
import { CloudUploadService } from '../services/cloud-upload.service';
import { SettingsService } from '../services/settings.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-camera',
  templateUrl: './camera.page.html',
  styleUrls: ['./camera.page.scss'],
  standalone: false,
})
export class CameraPage implements OnInit {
  cameraOverlayOptions: CameraOverlayOptions = {
    quality: 90,
    containerId: 'camera-container',
    flashAutoModeEnabled: false,
    buttons: {
      switchCamera: {
        icon: `../../assets/switchCamera.svg`,
        style: {
          radius: 40,
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: '#ffffff',
          padding: '0px',
          size: 40
        },
      },
      capture: {
        icon: `../../assets/capture.svg`,
        style: {
          radius: 70,
          backgroundColor: 'rgba(0,0,0,0)',
          opacity: 0.5,
          color: '#ffffff',
          padding: '0px',
          size: 70
        },
      },
      flash: {
        offIcon: `../../assets/offIcon.svg`,
        onIcon: `../../assets/onIcon.svg`,
        style: {
          radius: 40,
          backgroundColor: 'rgba(0,0,0,0)',
          color: '#ffffff',
          padding: '0px',
          size: 40,
          filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.8))'
        },
        position: 'topLeft'
      }
    }
  };

  constructor(
    private navCtrl: NavController,
    private cameraService: CameraService,
    private cloudUploadService: CloudUploadService,
    private settingsService: SettingsService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    document.querySelector('ion-app')?.classList.add('camera-mode');
  }

  async ionViewDidEnter() {
    const maxCaptures = this.route.snapshot.queryParamMap.get('maxCaptures');
    if (maxCaptures) {
      this.cameraOverlayOptions.maxCaptures = parseInt(maxCaptures);
    }

    this.cameraService.setCapturingState(true);
    await this.initCamera();
  }

  async initCamera() {
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) {
      cameraContainer.style.width = '100%';
      cameraContainer.style.height = '100%';
    }

    try {
      const permissions = await CameraMultiCapture.checkPermissions();

      if (permissions.camera !== 'granted' || permissions.photos !== 'granted') {
        // Request permissions
        const result = await CameraMultiCapture.requestPermissions();

        if (result.camera !== 'granted') {
          console.error('Camera permission denied');
          return;
        }
      }

      // Handle result based on ActiveSync setting
      const isActiveSyncEnabled = this.settingsService.isActiveSyncEnabled;

      if (isActiveSyncEnabled) {
        window.addEventListener('photoAdded', this.handlePhotoAdded);
      }

      const result: CameraOverlayResult = await initialize(this.cameraOverlayOptions);

      if (!isActiveSyncEnabled) {
        if (result.images.length > 0) {
          this.cameraService.addCapturedImages(result.images);
        }
      }

      this.goBack();
    } catch (error) {
      console.error('Camera initialization failed:', error);
      this.goBack();
    }
  }

  async goBack() {
    try {
      await CameraMultiCapture.stop();
    } catch (error: any) {
      console.error('Error stopping camera:', error);
    } finally {
      this.cameraService.setCapturingState(false);
      this.navCtrl.navigateBack('/tabs/tab3');
    }
  }

  ionViewWillLeave() {
    this.cameraService.setCapturingState(false);
    document.querySelector('ion-app')?.classList.remove('camera-mode');

    // Clean up event listeners
    this.cleanupPhotoAddedHandler();
  }

  /**
   * Handle individual photo added events for cloud upload
   * 
   * This method gets called for each photo taken when ActiveSync is enabled
   * It bypasses local storage and uploads directly to the cloud
   */
  private handlePhotoAdded = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent;
    const imageUri = customEvent.detail.image.uri;

    try {
      await this.cloudUploadService.uploadImage(imageUri);
    } catch (error) {
      console.error('[Camera] Cloud upload failed:', error);
    }
  }

  /**
   * Clean up event listeners
   * 
   * Important: Remove event listeners to prevent memory leaks
   * and duplicate handlers when navigating between pages
   */
  private cleanupPhotoAddedHandler(): void {
    window.removeEventListener('photoAdded', this.handlePhotoAdded);
  }
}
