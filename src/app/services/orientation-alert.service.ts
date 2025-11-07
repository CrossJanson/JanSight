import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { CameraMultiCapture } from 'camera-multi-capture';
import { PluginListenerHandle } from '@capacitor/core';

/**
 * Service to monitor device orientation and alert users when there's a mismatch
 * between physical device orientation and screen rotation lock setting.
 * 
 * This service listens for orientation events from the CameraMultiCapture plugin
 * and displays alerts when the device is physically oriented differently than
 * the locked screen orientation.
 */
@Injectable({
  providedIn: 'root'
})
export class OrientationAlertService {
  private orientationListener?: PluginListenerHandle;
  private currentAlert?: HTMLIonAlertElement;

  constructor(private alertController: AlertController) {}

  /**
   * Starts listening for orientation mismatch events.
   * 
   * Sets up a listener that monitors device orientation changes and compares
   * the physical device orientation against the screen's locked orientation.
   * When a mismatch is detected (e.g., device is held in portrait but screen
   * is locked in landscape), an alert is displayed to guide the user.
   * 
   * Automatically dismisses any previous alert before showing a new one to
   * avoid multiple overlapping alerts.
   */
  async start(): Promise<void> {
    try {
      // Listen for orientation check events from the camera plugin
      this.orientationListener = await CameraMultiCapture.addListener(
        'orientationCheck',
        async (event: any) => {
          // Check if rotation is locked and orientations don't match
          if (event.rotationLocked === true && event.deviceOrientation !== event.pluginOrientation) {
            // Dismiss any existing alert before showing a new one
            if (this.currentAlert) {
              await this.currentAlert.dismiss();
              this.currentAlert = undefined;
            }
            
            const message = `Your device is physically ${event.deviceOrientation}, but the screen is locked in ${event.pluginOrientation} orientation. For best results, please unlock rotation or rotate your device to match the screen orientation.`;
            
            // Create and present the mismatch alert
            this.currentAlert = await this.alertController.create({
              header: 'Rotation Mismatch',
              message: message,
              buttons: ['OK']
            });
            
            await this.currentAlert.present();
          }
        }
      );
    } catch (error) {
      console.error('Failed to start orientation listener:', error);
    }
  }

  /**
   * Stops listening for orientation events and cleans up resources.
   * 
   * Dismisses any currently displayed alert and removes the orientation
   * event listener. This should be called when the orientation monitoring
   * is no longer needed (e.g., when exiting the camera view) to prevent
   * memory leaks and unnecessary event handling.
   */
  async stop(): Promise<void> {
    try {
      // Dismiss any active alert
      if (this.currentAlert) {
        await this.currentAlert.dismiss();
        this.currentAlert = undefined;
      }
      // Remove the orientation event listener
      if (this.orientationListener) {
        await this.orientationListener.remove();
        this.orientationListener = undefined;
      }
    } catch (error) {
      console.error('Failed to stop orientation listener:', error);
    }
  }
}

