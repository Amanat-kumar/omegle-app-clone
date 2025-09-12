import { Component, Input, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss'],
  standalone: true
})
export class VideoPlayerComponent implements AfterViewInit {
  @Input() stream?: MediaStream;
  @Input() muted = false;

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    const video: HTMLVideoElement = this.el.nativeElement.querySelector('video');
    if (video && this.stream) {
      video.srcObject = this.stream;
      video.muted = this.muted;
      video.play();
    }
  }
}
