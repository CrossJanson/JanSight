import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { CameraImageData, CameraMultiCapture, CameraOverlayOptions, CameraOverlayResult, initialize } from 'camera-multi-capture';
import { CameraService } from '../services/camera.service';

@Component({
  selector: 'app-camera',
  templateUrl: './camera.page.html',
  styleUrls: ['./camera.page.scss'],
  standalone: false,
})
export class CameraPage implements OnInit {
  cameraOverlayOptions: CameraOverlayOptions = {
    quality: 90,
    containerId: 'camera-container'
  };

  constructor(
    private navCtrl: NavController,
    private cameraService: CameraService
  ) { }

  ngOnInit() {
    document.querySelector('ion-app')?.classList.add('camera-mode');
  }

  async ionViewDidEnter() {
    this.cameraService.setCapturingState(true);
    await this.initCamera();
  }

  async initCamera() {
    const cameraContainer = document.getElementById('camera-container');
    if (cameraContainer) {
      cameraContainer.style.width = '100%';
      cameraContainer.style.height = '100%';
    }

    const cameraInitOptions = {
      quality: 90,
      containerId: 'camera-container'
    };

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

      const result: CameraOverlayResult = await initialize(cameraInitOptions);
      
      if (result.images.length > 0) {
        await this.cameraService.addCapturedImages(result.images);
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
  }
}
