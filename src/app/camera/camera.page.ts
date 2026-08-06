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
    maxRecordingDuration: 30,
    containerId: 'camera-container',
    flashAutoModeEnabled: false,
    enableEditing: {
      markerJsLicenseKey: 'MJS2-F907-S214-3611'
    },
    pinchToZoom: {
      enabled: true,
      lockToNearestStep: false
    },
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

      if (permissions.camera !== 'granted') {
        const result = await CameraMultiCapture.requestPermissions();

        if (result.camera !== 'granted') {
          console.error('Camera permission denied');
          return;
        }
      }

      const isActiveSyncEnabled = this.settingsService.isActiveSyncEnabled;

      if (isActiveSyncEnabled) {
        window.addEventListener('photoAdded', this.handlePhotoAdded);
        window.addEventListener('videoRecordingStopped', this.handleVideoAdded);
      }
      window.addEventListener('photoUpdated', this.handlePhotoUpdated);

      const result: CameraOverlayResult = await initialize(this.cameraOverlayOptions);

      if (!isActiveSyncEnabled) {
        if (result.images.length > 0) {
          this.cameraService.addCapturedImages(result.images);
        }
        if (result.videos.length > 0) {
          this.cameraService.addCapturedVideos(result.videos);
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

  async ionViewWillLeave() {
    this.cameraService.setCapturingState(false);
    document.querySelector('ion-app')?.classList.remove('camera-mode');
    this.cleanupEventHandlers();
  }

  private handlePhotoAdded = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent;
    const imageUri = customEvent.detail.image.uri;

    try {
      await this.cloudUploadService.uploadImage(imageUri);
    } catch (error) {
      console.error('[Camera] Cloud upload failed:', error);
    }
  }

  private handlePhotoUpdated = async (_event: Event): Promise<void> => {
    // Photo updated with annotations — no-op
  }

  private handleVideoAdded = async (event: Event): Promise<void> => {
    const customEvent = event as CustomEvent;
    const videoUri = customEvent.detail.video.uri;

    try {
      await this.cloudUploadService.uploadMedia(videoUri, 'video');
    } catch (error) {
      console.error('[Camera] Cloud video upload failed:', error);
    }
  }

  private cleanupEventHandlers(): void {
    window.removeEventListener('photoAdded', this.handlePhotoAdded);
    window.removeEventListener('photoUpdated', this.handlePhotoUpdated);
    window.removeEventListener('videoRecordingStopped', this.handleVideoAdded);
  }
}
