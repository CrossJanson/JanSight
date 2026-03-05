import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CameraImageData, CameraVideoData, CapturedImage, CapturedVideo } from 'camera-multi-capture';
import { PhotoService } from './photo.service';

/**
 * Camera Service - Manages camera state and captured media using RxJS Observables
 * 
 * Usage:
 * ```typescript
 * // In your component:
 * capturedImages$ = this.cameraService.capturedImages$;
 * capturedVideos$ = this.cameraService.capturedVideos$;
 * 
 * // In template with async pipe:
 * <div *ngFor="let image of capturedImages$ | async">
 * <div *ngFor="let video of capturedVideos$ | async">
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class CameraService {
  private capturedImagesSubject = new BehaviorSubject<CapturedImage[]>([]);
  private capturedVideosSubject = new BehaviorSubject<CapturedVideo[]>([]);
  private isCapturingSubject = new BehaviorSubject<boolean>(false);

  constructor(
    private photoService: PhotoService
  ) { }

  get capturedImages$(): Observable<CapturedImage[]> {
    return this.capturedImagesSubject.asObservable();
  }

  get capturedVideos$(): Observable<CapturedVideo[]> {
    return this.capturedVideosSubject.asObservable();
  }

  get isCapturing$(): Observable<boolean> {
    return this.isCapturingSubject.asObservable();
  }

  get capturedImages(): CapturedImage[] {
    return this.capturedImagesSubject.value;
  }

  get capturedVideos(): CapturedVideo[] {
    return this.capturedVideosSubject.value;
  }

  addCapturedImages(images: CameraImageData[]): void {
    const currentImages = this.capturedImagesSubject.value;
    const newImages: CapturedImage[] = images.map(image => ({
      id: this.generateId(),
      data: image
    }));
    
    const updatedImages = [...currentImages, ...newImages];
    this.capturedImagesSubject.next(updatedImages);

    this.photoService.addMultipleToGallery(newImages);
  }

  addCapturedVideos(videos: CameraVideoData[]): void {
    const currentVideos = this.capturedVideosSubject.value;
    const newVideos: CapturedVideo[] = videos.map(video => ({
      id: this.generateId(),
      data: video
    }));

    const updatedVideos = [...currentVideos, ...newVideos];
    this.capturedVideosSubject.next(updatedVideos);

    this.photoService.addMultipleVideosToGallery(newVideos);
  }

  removeImage(imageId: string): void {
    const currentImages = this.capturedImagesSubject.value;
    const filteredImages = currentImages.filter(img => img.id !== imageId);
    this.capturedImagesSubject.next(filteredImages);
  }

  removeVideo(videoId: string): void {
    const currentVideos = this.capturedVideosSubject.value;
    const filteredVideos = currentVideos.filter(vid => vid.id !== videoId);
    this.capturedVideosSubject.next(filteredVideos);
  }

  clearAllImages(): void {
    this.capturedImagesSubject.next([]);
  }

  clearAllVideos(): void {
    this.capturedVideosSubject.next([]);
  }

  clearAllMedia(): void {
    this.capturedImagesSubject.next([]);
    this.capturedVideosSubject.next([]);
  }

  setCapturingState(isCapturing: boolean): void {
    this.isCapturingSubject.next(isCapturing);
  }

  get imageCount(): number {
    return this.capturedImagesSubject.value.length;
  }

  get videoCount(): number {
    return this.capturedVideosSubject.value.length;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
