import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  captureMode: string = 'infinite';
  customCaptureCount: number = 5;

  constructor(private navCtrl: NavController) {}

  onSegmentChange(event: any) {
    this.captureMode = event.detail.value;
  }

  getMaxCaptures(): number | undefined {
    switch (this.captureMode) {
      case 'single':
        return 1;
      case 'custom':
        return this.customCaptureCount;
      case 'infinite':
        return undefined;
      default:
        return undefined;
    }
  }

  async initCamera() {
    const maxCaptures = this.getMaxCaptures();
    this.navCtrl.navigateForward('/camera', {
      queryParams: {
        maxCaptures: maxCaptures
      }
    });
  }
}
