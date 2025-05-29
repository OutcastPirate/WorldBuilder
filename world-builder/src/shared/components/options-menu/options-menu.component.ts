import { Component } from '@angular/core';
import { ObjectsService } from '../../services/objects.service';
import { Position } from '../../interfaces/position';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-options-menu',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './options-menu.component.html',
  styleUrl: './options-menu.component.scss',
})
export class OptionsMenuComponent {
  constructor(private objectsService: ObjectsService) {}

  addCube(
    height: number,
    width: number,
    color: string,
    position: Position
  ): void {
    this.objectsService.addCube(height, width, color, position);
  }

  // moveCube(index: number, translation: Position): void {
  //   this.objectsService.moveCube(index, translation);
  // }

  click(): void {
    console.log('Options menu clicked');
  }
}
