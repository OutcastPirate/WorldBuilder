import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectService } from '../../services/project.service';

interface Message {
  text: string;
  error: boolean;
}

@Component({
  selector: 'app-options-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './options-menu.component.html',
  styleUrl: './options-menu.component.scss',
})
export class OptionsMenuComponent {
  constructor(public project: ProjectService) {}

  @ViewChild('projectFile') projectFile!: ElementRef<HTMLInputElement>;

  busy: 'saving' | 'opening' | 'new' | null = null;
  confirmingNew = false;
  message: Message | null = null;

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      this.save();
    } else if (event.key === 'o' || event.key === 'O') {
      event.preventDefault();
      this.projectFile.nativeElement.click();
    }
  }

  async save(): Promise<void> {
    if (this.busy) return;
    this.busy = 'saving';
    this.message = null;
    try {
      const result = await this.project.save();
      if (result.kind === 'saved') this.message = { text: `Saved to ${result.path}`, error: false };
      if (result.kind === 'downloaded') this.message = { text: 'Download started.', error: false };
    } catch (error) {
      this.message = { text: `Could not save: ${(error as Error).message}`, error: true };
    } finally {
      this.busy = null;
    }
  }

  async open(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.busy) return;
    this.busy = 'opening';
    this.confirmingNew = false;
    this.message = null;
    try {
      const warnings = await this.project.open(file);
      this.message = warnings.length
        ? { text: `Opened ${file.name}. ${warnings.join(' ')}`, error: true }
        : { text: `Opened ${file.name}.`, error: false };
    } catch (error) {
      this.message = { text: `Could not open ${file.name}: ${(error as Error).message}`, error: true };
    } finally {
      this.busy = null;
    }
  }

  async newProject(): Promise<void> {
    this.confirmingNew = false;
    this.busy = 'new';
    try {
      await this.project.newProject();
      this.message = null;
    } finally {
      this.busy = null;
    }
  }
}
