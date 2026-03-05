import { Component } from '@angular/core';
import { PhotoService, UserPhoto, UserVideo } from '../services/photo.service';
import { ActionSheetController } from '@ionic/angular';
import { FileOpener } from '@capacitor-community/file-opener';
import { Filesystem, Directory } from '@capacitor/filesystem';

export type MediaType = 'photo' | 'video';

export interface GalleryItem {
  type: MediaType;
  photo?: UserPhoto;
  video?: UserVideo;
  index: number;
  timestamp: number;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  constructor(
    public photoService: PhotoService,
    public actionSheetController: ActionSheetController
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
  }

  get galleryItems(): GalleryItem[] {
    const items: GalleryItem[] = [];

    this.photoService.photos.forEach((photo, i) => {
      items.push({ type: 'photo', photo, index: i, timestamp: photo.timestamp || 0 });
    });

    this.photoService.videos.forEach((video, i) => {
      items.push({ type: 'video', video, index: i, timestamp: video.timestamp || 0 });
    });

    items.sort((a, b) => b.timestamp - a.timestamp);

    return items;
  }

  getThumbnail(item: GalleryItem): string | undefined {
    if (item.type === 'photo') {
      return item.photo?.webviewPath;
    }
    return item.video?.thumbnail || item.video?.webviewPath;
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  public async showActionSheet(item: GalleryItem) {
    const isVideo = item.type === 'video';
    const header = isVideo ? 'Video' : 'Photo';

    const actionSheet = await this.actionSheetController.create({
      header,
      buttons: [{
        text: 'View',
        icon: 'open-outline',
        handler: () => {
          this.openFile(item);
        }
      }, {
        text: 'Delete',
        role: 'destructive',
        icon: 'trash',
        handler: () => {
          if (isVideo && item.video) {
            this.photoService.deleteVideo(item.video, item.index);
          } else if (item.photo) {
            this.photoService.deletePicture(item.photo, item.index);
          }
        }
      }, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
      }]
    });
    await actionSheet.present();
  }

  private async openFile(item: GalleryItem) {
    const filepath = item.type === 'video' ? item.video?.filepath : item.photo?.filepath;
    if (!filepath) return;

    try {
      const { uri } = await Filesystem.getUri({
        path: filepath,
        directory: Directory.Data,
      });

      const contentType = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
      await FileOpener.open({ filePath: uri, contentType });
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }
}
