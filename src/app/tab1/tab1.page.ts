import { Component } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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
  galleryItems: GalleryItem[] = [];

  constructor(
    public photoService: PhotoService,
    public actionSheetController: ActionSheetController
  ) {}

  async ngOnInit() {
    await this.photoService.loadSaved();
    this.rebuildGalleryItems();
  }

  ionViewWillEnter(): void {
    this.rebuildGalleryItems();
  }

  private rebuildGalleryItems(): void {
    const items: GalleryItem[] = [];

    this.photoService.photos.forEach((photo, i) => {
      items.push({ type: 'photo', photo, index: i, timestamp: photo.timestamp || 0 });
    });

    this.photoService.videos.forEach((video, i) => {
      items.push({ type: 'video', video, index: i, timestamp: video.timestamp || 0 });
    });

    items.sort((a, b) => b.timestamp - a.timestamp);
    this.galleryItems = items;
  }

  trackByGalleryItem(_index: number, item: GalleryItem): string {
    if (item.type === 'photo') {
      return `photo:${item.photo?.filepath ?? item.photo?.webviewPath ?? item.timestamp}`;
    }
    return `video:${item.video?.filepath ?? item.video?.webviewPath ?? item.timestamp}`;
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

    const buttons: any[] = [{
      text: 'View',
      icon: 'open-outline',
      handler: () => { this.openFile(item); }
    }];

    if (!isVideo && item.photo) {
      buttons.push({
        text: 'Edit',
        icon: 'create-outline',
        handler: () => { this.editPhoto(item.photo!); }
      });
    }

    buttons.push({
      text: 'Delete',
      role: 'destructive',
      icon: 'trash',
      handler: async () => {
        if (isVideo && item.video) {
          await this.photoService.deleteVideo(item.video, item.index);
        } else if (item.photo) {
          await this.photoService.deletePicture(item.photo, item.index);
        }
        this.rebuildGalleryItems();
      }
    }, {
      text: 'Cancel',
      icon: 'close',
      role: 'cancel',
    });

    const actionSheet = await this.actionSheetController.create({
      header,
      animated: false,
      buttons,
    });
    await actionSheet.present();
  }

  private async editPhoto(photo: UserPhoto): Promise<void> {
    const { MarkerArea, Activator } = await import('markerjs2');

    if (!photo.filepath) return;

    if (!photo.sourceFilepath) {
      photo.sourceFilepath = 'source_' + photo.filepath;
      await Filesystem.copy({
        from: photo.filepath,
        to: photo.sourceFilepath,
        directory: Directory.Data,
        toDirectory: Directory.Data,
      });
    }

    const file = await Filesystem.readFile({
      path: photo.sourceFilepath,
      directory: Directory.Data,
    });
    const src = `data:image/jpeg;base64,${file.data}`;

    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center;padding-top:env(safe-area-inset-top);';
    document.body.appendChild(backdrop);

    const img = new Image();
    img.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;';

    img.onload = () => {
      backdrop.appendChild(img);

      const markerArea = new MarkerArea(img);
      markerArea.targetRoot = backdrop;
      markerArea.renderAtNaturalSize = true;
      markerArea.renderImageType = 'image/jpeg';
      markerArea.renderImageQuality = 1;

      markerArea.addEventListener('render', async (event: any) => {
        backdrop.remove();

        await Filesystem.writeFile({
          path: photo.filepath,
          data: event.dataUrl,
          directory: Directory.Data,
        });

        photo.editorState = event.state;

        const { uri } = await Filesystem.getUri({
          path: photo.filepath,
          directory: Directory.Data,
        });
        photo.webviewPath = Capacitor.convertFileSrc(uri) + '?t=' + Date.now();

        await this.photoService.persistPhotos();
        this.rebuildGalleryItems();
      });

      markerArea.addEventListener('close', () => {
        backdrop.remove();
      });

     Activator.addKey();
      markerArea.show();

      if (photo.editorState) {
        markerArea.restoreState(photo.editorState as any);
      }
    };

    img.onerror = () => backdrop.remove();
    img.src = src;
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
