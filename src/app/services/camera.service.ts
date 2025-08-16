import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CameraImageData, CapturedImage } from 'camera-multi-capture';

/**
 * Camera Service - Manages camera state and captured images using RxJS Observables
 * 
 * Usage:
 * ```typescript
 * // In your component:
 * capturedImages$ = this.cameraService.capturedImages$; // Get the observable
 * 
 * // In template with async pipe (automatically subscribes/unsubscribes):
 * <div *ngFor="let image of capturedImages$ | async">
 * 
 * // Or manually subscribe in component:
 * this.cameraService.capturedImages$.subscribe(images => {
 *   console.log('Images updated:', images);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class CameraService {
  /**   
   * Reason for using BehaviorSubject:
   * 1. Holds the current value (so new subscribers get the latest data immediately)
   * 2. Can emit new values when data changes
   * 3. Always has a value (starts with initial value)
   * 
   * Keeping these private so components can't accidentally modify them directly.
   * Components should only read via observables and modify via service methods.
   */
  private capturedImagesSubject = new BehaviorSubject<CapturedImage[]>([]);
  private isCapturingSubject = new BehaviorSubject<boolean>(false);

  constructor() { }

  /**
   * Observable stream of captured images
   * 
   * Provides a "live feed" of all captured images that updates automatically
   * 
   * Sample usage:
   * - In template: `<div *ngFor="let img of capturedImages$ | async">`
   * - In component: `this.capturedImages$.subscribe(images => { ... })`
   * 
   * Any component watching this will automatically get updated
   * when new images are added, removed, or cleared. No manual refresh needed!
   * 
   * The $ suffix is a common convention indicating this is an Observable
   */
  get capturedImages$(): Observable<CapturedImage[]> {
    return this.capturedImagesSubject.asObservable();
  }

  /**
   * Observable stream of camera capturing state
   * 
   * Tells you whether the camera is currently active/capturing
   * 
   * Sample usage:
   * - Show loading spinner: `<ion-spinner *ngIf="isCapturing$ | async">`
   * - Disable buttons: `[disabled]="isCapturing$ | async"`
   * - Conditional display: `<div *ngIf="!(isCapturing$ | async)">Show when not capturing</div>`
   * 
   * Multiple components can watch this state and update their UI accordingly.
   */
  get isCapturing$(): Observable<boolean> {
    return this.isCapturingSubject.asObservable();
  }

  /**
   * Get current captured images synchronously
   * 
   * Returns the current snapshot of images at this exact moment.
   * When we need the current value right now (like for validation)
   * When we want automatic updates (use capturedImages$ instead)
   * 
   * DIFFERENCE FROM capturedImages$:
   * - This: One-time value, no automatic updates
   * - capturedImages$: Live stream, automatic updates
   */
  get capturedImages(): CapturedImage[] {
    return this.capturedImagesSubject.value;
  }

  /**
   * Add new captured images to the collection
   * 
   * Takes raw image URIs and converts them to full CapturedImage objects
   * with metadata (timestamp, unique ID), then adds them to the collection
   * When we call .next() on the BehaviorSubject,
   * ALL components watching capturedImages$ will automatically receive the updated list.
   * 
   * IMPORTANT: Converts file:// URIs to web-accessible URLs using Capacitor.convertFileSrc()
   * This is crucial for displaying images properly in the web view.
   * 
   * @param imageUris Array of image file URIs from the camera (e.g., "file://data/user/...")
   */
  addCapturedImages(images: CameraImageData[]): void {
    const currentImages = this.capturedImagesSubject.value;
    const newImages: CapturedImage[] = images.map(image => ({
      id: this.generateId(),
      data: image
    }));
    
    const updatedImages = [...currentImages, ...newImages];
    this.capturedImagesSubject.next(updatedImages);
  }

  /**
   * Remove a specific image from the collection
   * 
   * Finds and removes an image by its unique ID
   * When the image is removed, the UI automatically updates.
   * 
   * @param imageId Unique ID of the image to remove
   */
  removeImage(imageId: string): void {
    const currentImages = this.capturedImagesSubject.value;
    const filteredImages = currentImages.filter(img => img.id !== imageId);
    this.capturedImagesSubject.next(filteredImages);
  }

  /**
   * Clear all captured images
   * 
   * Removes all images from the collection (sets to empty array)
   * All components will automatically switch to "empty state"
   * view without checking and without any manual updates.
   */
  clearAllImages(): void {
    this.capturedImagesSubject.next([]);
  }

  /**
   * Update the camera capturing state
   * 
   * Sets whether the camera is currently active/capturing
   * All components can react to this state change:
   * - Show/hide loading spinners
   * - Enable/disable buttons  
   * - Switch between different UI states
   * 
   * @param isCapturing true when camera is active, false when inactive
   */
  setCapturingState(isCapturing: boolean): void {
    this.isCapturingSubject.next(isCapturing);
  }

  /**
   * Get current count of captured images
   * 
   * Quick way to get just the number of images.
   * For displaying counts in headers, validation, etc.
   * 
   * For reactive count we are using the async pipe, like: `(capturedImages$ | async)?.length`
   */
  get imageCount(): number {
    return this.capturedImagesSubject.value.length;
  }

  /**
   * Generate unique ID for images
   * 
   * Creates a unique string ID using timestamp + random characters.
   * Each image needs a unique identifier for tracking, deletion, etc.
   * Using timestamp + random ensures uniqueness even with rapid captures.
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
