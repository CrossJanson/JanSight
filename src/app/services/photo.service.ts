import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';

import { Platform } from '@ionic/angular';
import { CapturedImage, CapturedVideo } from 'camera-multi-capture';


@Injectable({
  providedIn: 'root'
})

export class PhotoService {
  
  public photos: UserPhoto[] = [];
  public videos: UserVideo[] = [];
  private PHOTO_STORAGE: string = 'photos';
  private VIDEO_STORAGE: string = 'videos';
  private platform: Platform;

  constructor(platform: Platform) {
    this.platform = platform;
  }

  public async loadSaved() {
    const { value: photoValue } = await Preferences.get({ key: this.PHOTO_STORAGE });
    this.photos = (photoValue ? JSON.parse(photoValue) : []) as UserPhoto[];

    const { value: videoValue } = await Preferences.get({ key: this.VIDEO_STORAGE });
    this.videos = (videoValue ? JSON.parse(videoValue) : []) as UserVideo[];

    if (!this.platform.is('hybrid')) {
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({
            path: photo.filepath,
            directory: Directory.Data
        });
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }
  }

  public async addNewToGallery() {
    const capturedPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100
    });

    const savedImageFile = await this.savePicture(capturedPhoto);
    this.photos.unshift(savedImageFile);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
  }

  public async addMultipleToGallery(images: CapturedImage[]) {
    const photos: Photo[] = [];
    for (const image of images) {
      photos.push({
        webPath: image.data.webPath,
        saved: false,
        format: 'jpeg',
      });
    }

    const savedPhotos = await this.savePictures(photos);
    this.photos.unshift(...savedPhotos);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
  }

  public async addMultipleVideosToGallery(capturedVideos: CapturedVideo[]) {
    const savedVideos: UserVideo[] = [];
    for (const video of capturedVideos) {
      const saved = await this.saveVideo(video);
      savedVideos.push(saved);
    }

    this.videos.unshift(...savedVideos);

    Preferences.set({
      key: this.VIDEO_STORAGE,
      value: JSON.stringify(this.videos),
    });
  }

  private async saveVideo(video: CapturedVideo): Promise<UserVideo> {
    const now = Date.now();
    const fileName = now + '.mp4';

    await Filesystem.copy({
      from: video.data.uri,
      to: fileName,
      toDirectory: Directory.Data
    });

    const webviewPath = await this.resolveWebviewPath(fileName);

    return {
      filepath: fileName,
      webviewPath: webviewPath || video.data.webPath || video.data.uri,
      thumbnail: video.data.thumbnail,
      duration: video.data.duration,
      timestamp: now,
    };
  }

  private async savePictures(photos: Photo[]): Promise<UserPhoto[]> {
    const savedPhotos: UserPhoto[] = [];
    for (const photo of photos) {
      const savedPhoto = await this.savePicture(photo);
      savedPhotos.push(savedPhoto);
    }
    return savedPhotos;
  }

  private async savePicture(photo: Photo): Promise<UserPhoto> {
    const base64Data = await this.readAsBase64(photo);

    const now = Date.now();
    const fileName = now + '.jpeg';
    await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data
    });

    const webviewPath = await this.resolveWebviewPath(fileName);

    return {
      filepath: fileName,
      webviewPath: webviewPath || photo.webPath,
      timestamp: now,
    };
  }

  private async resolveWebviewPath(path: string): Promise<string | undefined> {
    try {
      const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Data,
      });
      return Capacitor.convertFileSrc(uri);
    } catch {
      return undefined;
    }
  }

  private async readAsBase64(photo: Photo) {
    const response = await fetch(photo.webPath!);
    const blob = await response.blob();
    return await this.convertBlobToBase64(blob) as string;
  }

  public async deletePicture(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);

    Preferences.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos)
    });

    const filename = photo.filepath
                        .substr(photo.filepath.lastIndexOf('/') + 1);

    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data
    });
  }

  public async deleteVideo(video: UserVideo, position: number) {
    this.videos.splice(position, 1);

    Preferences.set({
      key: this.VIDEO_STORAGE,
      value: JSON.stringify(this.videos)
    });

    const filename = video.filepath
                        .substr(video.filepath.lastIndexOf('/') + 1);

    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data
    });
  }

  private convertBlobToBase64 = (blob: Blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
        resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });

}

export interface UserPhoto {
  filepath: string;
  webviewPath?: string;
  timestamp: number;
}

export interface UserVideo {
  filepath: string;
  webviewPath?: string;
  thumbnail?: string;
  duration?: number;
  timestamp: number;
}
