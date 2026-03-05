import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { CameraMultiCapture } from 'camera-multi-capture';
import { environment } from '../../environments/environment';

/**
 * Cloud Upload Service - Handles background upload of images to cloud storage
 * 
 * Follows Single Responsibility Principle (SRP):
 * - ONLY handles cloud upload operations
 * - Does NOT manage local photo storage (handled by PhotoService)
 * - Does NOT manage camera state (handled by CameraService)
 * 
 * Features:
 * - Authentication token management
 * - SAS token retrieval for Azure Blob Storage
 * - Background upload queuing
 * - Upload status monitoring
 * - User feedback via toast notifications
 */
@Injectable({
  providedIn: 'root'
})
export class CloudUploadService {
  private readonly AUTH_ENDPOINT = environment.api.authEndpoint;
  private readonly SAS_TOKEN_ENDPOINT = environment.api.sasTokenEndpoint;
  
  // Cache auth token to avoid repeated login requests
  private authToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private toastController: ToastController) {}

  /**
   * Upload image to cloud storage with background processing
   * 
   * This is the main public method that orchestrates the entire upload process:
   * 1. Get authentication token (cached if valid)
   * 2. Request SAS token for secure upload
   * 3. Queue background upload job
   * 4. Monitor upload progress
   * 5. Show user feedback via toasts
   * 
   * @param imageUri - URI of the image to upload
   * @returns Promise<boolean> - true if upload initiated successfully
   */
  async uploadImage(imageUri: string): Promise<boolean> {
    return this.uploadMedia(imageUri, 'image');
  }

  async uploadMedia(uri: string, type: 'image' | 'video'): Promise<boolean> {
    try {
      await this.showToast(`📤 Starting ${type} upload...`, 'primary', 1000);

      const token = await this.getAuthToken();
      if (!token) {
        await this.showToast('Authentication failed', 'danger');
        return false;
      }

      const sasUrl = await this.getSasToken(token, uri, type);
      if (!sasUrl) {
        await this.showToast('Failed to get upload URL', 'danger');
        return false;
      }

      const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      const uploadResult = await this.queueBackgroundUpload(uri, sasUrl, contentType);
      if (!uploadResult) {
        await this.showToast('Failed to queue upload', 'danger');
        return false;
      }

      await this.showToast('⏫ Upload queued successfully', 'success');

      this.monitorUploadStatus(uploadResult.jobId);

      return true;

    } catch (error) {
      await this.showToast('Upload failed: ' + (error as Error).message, 'danger');
      return false;
    }
  }

  /**
   * Get authentication token (with caching)
   * 
   * Implements token caching to avoid unnecessary auth requests:
   * - Returns cached token if still valid
   * - Requests new token if expired or missing
   * - Handles auth failures gracefully
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.authToken && Date.now() < this.tokenExpiry) {
      return this.authToken;
    }

    try {
      const response = await fetch(this.AUTH_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'testuser123', 
          email: 'test@example.com' 
        })
      });

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.status}`);
      }

      const { token } = await response.json();
      
      this.authToken = token;
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      return token;

    } catch (error) {
      console.error('[CloudUpload] Auth failed:', error);
      this.authToken = null;
      this.tokenExpiry = 0;
      return null;
    }
  }

  /**
   * Get SAS token for secure upload to Azure Blob Storage
   * 
   * SAS (Shared Access Signature) tokens provide secure, time-limited
   * access to Azure storage without exposing credentials
   */
  private async getSasToken(authToken: string, uri: string, type: 'image' | 'video' = 'image'): Promise<string | null> {
    try {
      const fileName = this.generateFileName(uri, type);
      const containerName = type === 'video' ? 'videos' : 'photos';
      
      const response = await fetch(this.SAS_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          fileName,
          containerName
        })
      });

      if (!response.ok) {
        throw new Error(`SAS token request failed: ${response.status}`);
      }

      const { sasUrl } = await response.json();
      console.log('[CloudUpload] Got SAS URL for:', fileName);
      
      return sasUrl;

    } catch (error) {
      console.error('[CloudUpload] Failed to get SAS token:', error);
      return null;
    }
  }

  /**
   * Queue background upload using the camera plugin's upload capability
   * 
   * This leverages the native background upload functionality
   * which continues even if the app is backgrounded or closed
   */
  private async queueBackgroundUpload(uri: string, sasUrl: string, contentType: string = 'image/jpeg'): Promise<any> {
    try {
      const uploadResult = await CameraMultiCapture.queueBackgroundUpload({
        imageUri: uri,
        uploadEndpoint: sasUrl,
        headers: { 
          'Content-Type': contentType,
          'x-ms-blob-type': 'BlockBlob'
        },
        method: 'PUT'
      });

      return uploadResult;

    } catch (error) {
      console.error('[CloudUpload] Failed to queue upload:', error);
      return null;
    }
  }

  /**
   * Monitor upload status with exponential backoff
   * 
   * Checks upload progress periodically and provides user feedback
   * Uses exponential backoff to avoid overwhelming the system
   */
  private async monitorUploadStatus(jobId: string): Promise<void> {
    let checkCount = 0;
    const maxChecks = 30; // Maximum number of status checks
    
    const checkStatus = async (): Promise<void> => {
      try {
        if (checkCount >= maxChecks) {
          await this.showToast('Upload monitoring timeout', 'warning');
          return;
        }



        const status = await CameraMultiCapture.getUploadStatus({ jobId });
        
        if (status.status === 'completed') {
          await this.showToast('🎉 Upload completed!', 'success');
          return;
        } 
        
        if (status.status === 'failed') {
          await this.showToast('Upload failed', 'danger');
          return;
        } 
        
        if (status.status === 'uploading' || status.status === 'pending') {
          checkCount++;
          // Exponential backoff: 2s, 4s, 6s, 8s, 10s, then 10s intervals
          const delay = Math.min(2000 + (checkCount * 2000), 10000);
          setTimeout(checkStatus, delay);
        }

      } catch (error) {
        console.error('[CloudUpload] Status check failed:', error);
        await this.showToast('Upload monitoring failed', 'danger');
      }
    };

    checkStatus();
  }

  /**
   * Generate unique filename for uploaded image
   * 
   * Creates timestamp-based filename to avoid conflicts
   * and provide chronological ordering
   */
  private generateFileName(uri: string, type: 'image' | 'video' = 'image'): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const ext = type === 'video' ? 'mp4' : 'jpg';
    const prefix = type === 'video' ? 'video' : 'photo';
    return `${prefix}_${timestamp}_${randomSuffix}.${ext}`;
  }

  /**
   * Show toast notification to user
   * 
   * Provides consistent UI feedback across all upload operations
   * Colors: primary (blue), success (green), warning (orange), danger (red)
   */
  private async showToast(
    message: string, 
    color: 'primary' | 'success' | 'warning' | 'danger' = 'primary',
    duration: number = 3000
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'top',
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }
}
