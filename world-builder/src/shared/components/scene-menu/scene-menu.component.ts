import { Component } from '@angular/core';
import { SceneService } from '../../services/scene.service';
import { GenerationConfigService } from '../../services/generation-config.service';
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
  // Remembered while switching tabs.
  private static statsShown = false;
  get showStats(): boolean {
    return SceneMenuComponent.statsShown;
  }
  set showStats(value: boolean) {
    SceneMenuComponent.statsShown = value;
  }

  constructor(
    private sceneService: SceneService,
    private configService: GenerationConfigService
  ) {}

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
    // Density relative to the terrain size, so the far edge fades out
    // without hiding the middle of the map.
    const density = 0.6 / this.configService.config.terrain.worldSize;
    this.scene.fog = new THREE.FogExp2(0xcccccc, Number(density.toFixed(4)));
    this.scene.background = new THREE.Color(0xcccccc);
  }

  restoreDefault() {
    this.backgroundColor = '#202020';
    this.removeFog();
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

  setShowStats(show: boolean): void {
    this.showStats = show;
    this.sceneService.setStatsEnabled(show);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
