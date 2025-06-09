import { Component } from '@angular/core';
import { SceneService } from '../../services/scene.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { OnInit } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-scene-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scene-menu.component.html',
  styleUrl: './scene-menu.component.scss',
})
export class SceneMenuComponent implements OnInit {
  private subscription!: Subscription;
  terrain: any;
  scene: any;
  backgroundColor: any = '#202020';
  fogColor: any = '#cccccc';

  constructor(private sceneService: SceneService) {}

  async ngOnInit(): Promise<void> {
    this.subscription = this.sceneService.scene$.subscribe((scene) =>
      setTimeout(() => {
        this.scene = scene;
        if (scene) {
          this.backgroundColor =
            '#' + this.scene.background.getHexString().toString();
          if (scene.fog) {
            this.fogColor =
              '#' + this.scene.fog.color.getHexString().toString();
          }
        }
      }, 0)
    );
  }

  addFog() {
    this.scene.fog = new THREE.FogExp2(0xcccccc, 0.03);
    this.scene.background = new THREE.Color(0xcccccc);
    console.log(this.scene.fog);
  }

  restoreDefault() {
    this.removeFog();
    this.scene.background = new THREE.Color(0x202020);
  }

  changeBackground(color?: string) {
    if (color) {
      this.scene.background = new THREE.Color(color);
      this.backgroundColor = color;
    } else {
      this.scene.background = new THREE.Color(this.backgroundColor);
    }
  }

  changeFogColor() {
    this.scene.fog.color = new THREE.Color(this.fogColor);
    this.changeBackground(this.fogColor);
  }

  removeFog() {
    this.scene.fog = null;
    this.scene.background = new THREE.Color(this.backgroundColor);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
