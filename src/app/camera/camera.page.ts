import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import {
  CameraMultiCapture,
  CameraOverlayOptions,
  CameraOverlayResult,
  initialize,
} from 'camera-multi-capture';
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
  // Pinch-to-zoom state
  private startDistance = 0;
  private baseZoom = 1;
  private currentZoom = 1;
  private minZoom = 1;
  private maxZoom = 5;
  private availableZoomLevels: number[] = []; // Available discrete zoom levels from device
  private snapToNearestLevel = false; // Toggle between continuous and discrete zoom

  cameraOverlayOptions: CameraOverlayOptions = {
    quality: 90,
    containerId: 'camera-container',
    flashAutoModeEnabled: false,
    pinchToZoom: {
      enabled: true,
      lockToNearestStep: false, // Set to true to snap to preset levels
    },
    buttons: {
      switchCamera: {
        icon: `../../assets/switchCamera.svg`,
        style: {
          radius: 40,
          backgroundColor: 'rgba(0,0,0,0.5)',
          color: '#ffffff',
          padding: '0px',
          size: 40,
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
          size: 70,
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
          filter: 'drop-shadow(0 0 10px rgba(0, 0, 0, 0.8))',
        },
        position: 'topLeft',
      },
    },
  };

  constructor(
    private navCtrl: NavController,
    private cameraService: CameraService,
    private cloudUploadService: CloudUploadService,
    private settingsService: SettingsService,
    private route: ActivatedRoute,
  ) {}

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

      if (
        permissions.camera !== 'granted' ||
        permissions.photos !== 'granted'
      ) {
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

      const result: CameraOverlayResult = await initialize(
        this.cameraOverlayOptions,
      );

      // Native pinch-to-zoom is handled by the plugin when enabled
      // No need for JavaScript handlers

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

  async ionViewWillLeave() {
    this.cameraService.setCapturingState(false);
    document.querySelector('ion-app')?.classList.remove('camera-mode');

    // Clean up event listeners
    this.cleanupPhotoAddedHandler();

    // Native pinch-to-zoom cleanup is handled by the plugin
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
  };

  /**
   * Clean up event listeners
   *
   * Important: Remove event listeners to prevent memory leaks
   * and duplicate handlers when navigating between pages
   */
  private cleanupPhotoAddedHandler(): void {
    window.removeEventListener('photoAdded', this.handlePhotoAdded);
  }

  /**
   * Load device zoom range from native plugin.
   * This ensures pinch zoom respects real camera capabilities
   * instead of using hardcoded values.
   */
  private async loadZoomRange() {
    try {
      // Try to get available zoom levels from the plugin
      // If the plugin supports getAvailableZoomLevels, use it
      const res: any = await (
        CameraMultiCapture as any
      ).getAvailableZoomLevels?.();
      if (res) {
        this.minZoom = res.minZoom ?? 1;
        this.maxZoom = res.maxZoom ?? 5;
        this.availableZoomLevels = res.presetLevels ?? []; // key name fix
        this.currentZoom = 1; // start at 1x (plugin doesn’t send currentZoom)
      }
    } catch (e) {
      // Fallback to default values if plugin doesn't support zoom queries
      console.warn('Zoom range query not available, using defaults');
      this.minZoom = 1;
      this.maxZoom = 5;
      this.currentZoom = 1;
    }
  }

  /**
   * Attach pinch gesture listeners to the camera container.
   * The camera preview is rendered by the plugin overlay,
   * so we listen on the container element or window.
   */
  private attachPinchZoom() {
    const cameraContainer = document.getElementById('camera-container');
    const targetElement = cameraContainer || window;

    targetElement.addEventListener('touchstart', this.onTouchStart, {
      passive: false,
    });
    targetElement.addEventListener('touchmove', this.onTouchMove, {
      passive: false,
    });
    targetElement.addEventListener('touchend', this.onTouchEnd, {
      passive: false,
    });
  }

  /**
   * Remove pinch gesture listeners
   */
  private detachPinchZoom() {
    const cameraContainer = document.getElementById('camera-container');
    const targetElement = cameraContainer || window;

    targetElement.removeEventListener('touchstart', this.onTouchStart);
    targetElement.removeEventListener('touchmove', this.onTouchMove);
    targetElement.removeEventListener('touchend', this.onTouchEnd);
  }

  /**
   * Calculate distance between two touch points
   */
  private getDistance(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Handle touch start - initialize pinch gesture
   */
  private onTouchStart = (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length === 2) {
      touchEvent.preventDefault();
      this.startDistance = this.getDistance(touchEvent.touches);
      this.baseZoom = this.currentZoom;
    }
  };

  /**
   * Handle touch move - calculate and apply zoom dynamically
   */
  private onTouchMove = async (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length === 2 && this.startDistance > 0) {
      touchEvent.preventDefault();

      const currentDistance = this.getDistance(touchEvent.touches);
      const scale = currentDistance / this.startDistance;

      let zoom = this.baseZoom * scale;
      zoom = Math.max(this.minZoom, Math.min(zoom, this.maxZoom));

      this.currentZoom = zoom;

      try {
        await (CameraMultiCapture as any).setZoom?.({ zoom });
      } catch (error) {
        console.warn('Failed to set zoom:', error);
      }
    }
  };

  /**
   * Handle touch end - optionally snap to nearest zoom level
   */
  private onTouchEnd = async (e: Event) => {
    const touchEvent = e as TouchEvent;
    if (touchEvent.touches.length < 2) {
      this.startDistance = 0;

      if (this.snapToNearestLevel && this.availableZoomLevels.length > 0) {
        const snappedZoom = this.findNearestZoomLevel(this.currentZoom);
        if (snappedZoom !== this.currentZoom) {
          this.currentZoom = snappedZoom;
          try {
            await (CameraMultiCapture as any).setZoom?.({ zoom: snappedZoom });
          } catch (error) {
            console.warn('Failed to snap zoom:', error);
          }
        }
      }
    }
  };

  /**
   * Find the nearest available zoom level from discrete options
   */
  private findNearestZoomLevel(zoom: number): number {
    if (this.availableZoomLevels.length === 0) {
      return zoom;
    }

    let nearest = this.availableZoomLevels[0];
    let minDiff = Math.abs(zoom - nearest);

    for (const level of this.availableZoomLevels) {
      const diff = Math.abs(zoom - level);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = level;
      }
    }

    return nearest;
  }
}
