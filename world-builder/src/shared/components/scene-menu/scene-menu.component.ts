import { Component } from '@angular/core';
import { SceneService } from '../../services/scene.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-scene-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scene-menu.component.html',
  styleUrl: './scene-menu.component.scss',
})
export class SceneMenuComponent {
  constructor(private sceneService: SceneService) {}

  terrain = this.sceneService.getTerrain();
}
