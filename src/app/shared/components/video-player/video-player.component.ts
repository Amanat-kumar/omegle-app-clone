import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.scss']
})
export class VideoPlayerComponent implements OnChanges {
  @Input() stream?: MediaStream | null;
  @Input() muted = false;

  @ViewChild('vid', { static: true }) vidRef!: ElementRef<HTMLVideoElement>;

  ngOnChanges() {
    if (this.vidRef && this.stream) {
      this.vidRef.nativeElement.srcObject = this.stream;
    }
  }
}
