import { Component, ElementRef, OnDestroy, signal, viewChild } from '@angular/core';
import { PLATFORM_ID, AfterViewInit, inject, effect, afterRenderEffect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthProvidersService } from './services/auth-providers.service.js';
import { CallAccessService, AccessState } from './services/call-access.service.js';
import { isPlatformBrowser, SlicePipe, UpperCasePipe } from '@angular/common';
import { CallWsService } from './services/call-ws.service.js';

interface MediaDevice {
  deviceId: string;
  label: string;
}

@Component({
  selector: 'app-call-placeholder',
  standalone: true,
  imports: [RouterLink, UpperCasePipe, SlicePipe],
  templateUrl: 'call-placeholder.page.html',
  styleUrl: 'call-placeholder.page.css'
})
export class CallPlaceholderPage implements AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthProvidersService);
  private access = inject(CallAccessService);
  private ws = inject(CallWsService);

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private initialDisplayNameSet = false;
  readonly previewVideo = viewChild<ElementRef<HTMLVideoElement>>('previewVideo');
  /** The joined in-call video (only exists in the 'joined' branch). Non-required so it's null-safe before render. */
  readonly selfVideo = viewChild<ElementRef<HTMLVideoElement>>('selfVideo');
  showSkeleton = signal(false);
  private skeletonTimer: ReturnType<typeof setTimeout> | null = null;
  accessState = this.access.state;
  roomName = this.access.roomName;
  readonly roomCode = signal<string>('');

  cameras = signal<MediaDevice[]>([]);
  mics = signal<MediaDevice[]>([]);
  speakers = signal<MediaDevice[]>([]);
  selectedCamera = signal<string>('');
  selectedMic = signal<string>('');
  selectedSpeaker = signal<string>('');
  micVolumePercent = signal<number>(0);

  displayName = signal<string>('');
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private deviceStarted = false;

  constructor() {
    const code = this.route.snapshot.queryParams['code'] as string ?? '';
    this.roomCode.set(code);
    this.access.check(code);
    if (!this.isBrowser) return;

    // Start device selection once access is allowed
    effect(() => {
      const state = this.accessState();
      if (state === AccessState.Validating) {
        // only arm the timer once per validating period
        if (this.skeletonTimer === null) {
          this.skeletonTimer = setTimeout(() => this.showSkeleton.set(true), 200);
        }
      } else {
        // left "validating" — cancel any pending timer and hide the skeleton
        if (this.skeletonTimer !== null) {
          clearTimeout(this.skeletonTimer);
          this.skeletonTimer = null;
        }
        this.showSkeleton.set(false);
      }
      if (state === AccessState.Allowed && !this.deviceStarted) {
        this.deviceStarted = true;
        this.startDeviceSelection();
      }
    });

    // Attach the local stream to the in-call <video> once it exists in the DOM.
    // afterRenderEffect runs AFTER the template has actually rendered 'joined',
    // where the #selfVideo element is present — so this cannot throw before render
    // the way a constructor effect() did. Re-runs on stream swap, camera toggle, unmount.
    afterRenderEffect(() => {
      if (!this.isBrowser) return;
      this.attachSelfStream();
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const user = this.auth.user();
    if (user?.name && !this.initialDisplayNameSet) {
      this.initialDisplayNameSet = true;
      this.displayName.set(user.name);
    }
  }

  private async startDeviceSelection(): Promise<void> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      // Continue anyway
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    this.cameras.set(devices.filter(d => d.kind === 'videoinput'));
    this.mics.set(devices.filter(d => d.kind === 'audioinput'));
    this.speakers.set(devices.filter(d => d.kind === 'audiooutput'));

    if (this.cameras().length > 0) {
      this.selectedCamera.set(this.cameras()[0].deviceId);
      await this.startVideoPreview();
    }
    if (this.mics().length > 0) {
      this.selectedMic.set(this.mics()[0].deviceId);
    }

    await this.startMicMeter();
  }

  private async startVideoPreview(): Promise<void> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };
      if (this.selectedCamera()) {
        constraints.video = { ...constraints.video as any, deviceId: { exact: this.selectedCamera() } } as any;
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      const videoEl = this.previewVideo()?.nativeElement;
      if (videoEl) {
        videoEl.srcObject = stream;
      }
    } catch {
      // Camera unavailable
    }
  }

  private async startMicMeter(): Promise<void> {
    if (this.analyser) return;
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(audioStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      source.connect(this.analyser);

      const data = new Uint8Array(this.analyser.frequencyBinCount);
      const tick = () => {
        if (!this.analyser) return;
        if (!this.ws.micOn()) {
          this.micVolumePercent.set(0);
          this.animationFrameId = requestAnimationFrame(tick);
          return;
        }
        this.analyser.getByteFrequencyData(data);
        const avg = data.reduce((a: number, b: number) => a + b, 0) / data.length;
        this.micVolumePercent.set(Math.min(100, (avg / 128) * 100));
        this.animationFrameId = requestAnimationFrame(tick);
      };
      this.animationFrameId = requestAnimationFrame(tick);
    } catch {
      // Mic unavailable
    }
  }

  async onCameraChange(event: Event): Promise<void> {
    const deviceId = (event.target as HTMLSelectElement).value;
    this.selectedCamera.set(deviceId);
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    await this.startVideoPreview();
  }

  async onMicChange(event: Event): Promise<void> {
    const deviceId = (event.target as HTMLSelectElement).value;
    this.selectedMic.set(deviceId);
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
    if (this.animationFrameId != null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    await this.startMicMeter();
  }

  async onSpeakerChange(event: Event): Promise<void> {
    const deviceId = (event.target as HTMLSelectElement).value;
    this.selectedSpeaker.set(deviceId);
    const videoEl = this.previewVideo()?.nativeElement;
    if (videoEl && this.selectedSpeaker()) {
      await videoEl.setSinkId(deviceId).catch(() => {});
    }
  }

  async testSpeaker(): Promise<void> {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.1;
      oscillator.type = 'sine';
      oscillator.frequency.value = 440;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close().catch(() => {});
      }, 500);
    } catch {
      // Speaker test failed
    }
  }

  onDisplayNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.displayName.set(value.slice(0, 50));
  }

  onJoin(): void {
    const name = this.displayName().trim();
    if (!name) return;
    void this.access.startJoin(this.roomCode(), name);
  }

  onLeave(): void {
    this.ws.leaveRoom();
    this.stopSelfStream();
    this.router.navigate(['/']);
  }

  toggleMute(): void {
    this.ws.micOn.update(v => !v);
    if (!this.ws.micOn()) {
      this.micVolumePercent.set(0);
    }
    this.applyTrackState();
  }

  toggleCamera(): void {
    this.ws.camOn.update(v => !v);
    this.applyTrackState();
  }

  myId(): string {
    return this.ws.myId();
  }

  private applyTrackState(): void {
    const stream = this.localStream;
    if (!stream) return;
    for (const t of stream.getAudioTracks()) {
      t.enabled = this.ws.micOn();
    }
    for (const t of stream.getVideoTracks()) {
      t.enabled = this.ws.camOn();
    }
  }

  private attachSelfStream(): void {
    const el = this.selfVideo()?.nativeElement;
    if (el) el.srcObject = this.localStream;
  }

  private stopSelfStream(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
  }

  ngOnDestroy(): void {
    if (this.ws.state() !== 'disconnected') {
      this.ws.leaveRoom();
    }
    if (this.animationFrameId != null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.stopSelfStream();
    if (this.skeletonTimer !== null) clearTimeout(this.skeletonTimer);
    this.audioContext?.close().catch(() => {});
  }
}
