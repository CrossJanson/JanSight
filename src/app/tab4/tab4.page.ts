import { Component } from '@angular/core';
import { IonItem, IonList, IonToggle } from '@ionic/angular/standalone';
import { ScreenOrientation } from '@capacitor/screen-orientation';

@Component({
  selector: 'app-tab4',
  templateUrl: 'tab4.page.html',
  styleUrls: ['tab4.page.scss'],
  standalone: false,
})
export class Tab4Page {

  rangeValue: number = 8; // Initialize with the max value

  constructor() {}

}
