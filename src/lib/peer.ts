/**
 * Peer transport between the two devices.
 *
 * The room document in Convex is the signalling channel: both sides write
 * their SDP and trickle ICE candidates into it, then talk directly over a
 * WebRTC data channel (same Wi-Fi network → genuinely local traffic).
 *
 * If the channel never opens — restrictive network, no host candidates —
 * the controller falls back to routing frames through Convex, which costs a
 * round trip but always works.
 */

import type { InputFrame } from "./controller";

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    },
  ],
};

export type ControlMessage = { k: "p"; t?: number; r?: number };

export interface PeerHandlers {
  /** Serialised local description, hand it to the room document. */
  onLocalSdp: (sdp: string) => void;
  /** Serialised local ICE candidate, hand it to the room document. */
  onLocalCandidate: (candidate: string) => void;
  onFrame: (frame: InputFrame) => void;
  onControl?: (message: ControlMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

function createChannel(pc: RTCPeerConnection, label: string) {
  try {
    return pc.createDataChannel(label, { ordered: false, maxRetransmits: 0 });
  } catch {
    return pc.createDataChannel(label, { ordered: false });
  }
}

class PeerBase {
  readonly pc: RTCPeerConnection;
  protected remoteDescSet = false;
  protected settingRemote = false;
  protected pending: RTCIceCandidateInit[] = [];
  protected disposed = false;
  protected handlers: PeerHandlers;

  constructor(handlers: PeerHandlers) {
    this.handlers = handlers;
    this.pc = new RTCPeerConnection(ICE_CONFIG);
    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.disposed) {
        this.handlers.onLocalCandidate(JSON.stringify(event.candidate));
      }
    };
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      if (state === "failed" || state === "closed") this.handlers.onClose?.();
    };
  }

  protected async setRemote(desc: RTCSessionDescriptionInit) {
    if (this.remoteDescSet || this.settingRemote) return;
    this.settingRemote = true;
    try {
      await this.pc.setRemoteDescription(desc);
      this.remoteDescSet = true;
      await this.flush();
    } finally {
      this.settingRemote = false;
    }
  }

  addRemoteCandidate(json: string) {
    if (this.disposed) return;
    let candidate: RTCIceCandidateInit;
    try {
      candidate = JSON.parse(json) as RTCIceCandidateInit;
    } catch {
      return;
    }
    if (!this.remoteDescSet) {
      this.pending.push(candidate);
      return;
    }
    void this.pc.addIceCandidate(candidate).catch(() => {
      /* a candidate that no longer applies is not fatal */
    });
  }

  private async flush() {
    const queued = this.pending.splice(0);
    for (const candidate of queued) {
      await this.pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  protected wire(channel: RTCDataChannel) {
    channel.onopen = () => {
      if (!this.disposed) this.handlers.onOpen?.();
    };
    channel.onclose = () => {
      if (!this.disposed) this.handlers.onClose?.();
    };
    channel.onmessage = (event) => {
      if (this.disposed) return;
      let message: {
        k?: string;
        f?: InputFrame;
        t?: number;
        r?: number;
      };
      try {
        message = JSON.parse(event.data as string);
      } catch {
        return;
      }
      if (message.k === "i" && message.f) {
        this.handlers.onFrame(message.f);
      } else if (message.k === "p") {
        this.handlers.onControl?.({ k: "p", t: message.t, r: message.r });
      }
    };
  }

  send(payload: unknown, channel?: RTCDataChannel) {
    if (!channel || channel.readyState !== "open") return false;
    try {
      channel.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  close() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.pc.close();
    } catch {
      /* ignore */
    }
  }
}

/** Receiver side. Always the offerer. */
export class HostLink extends PeerBase {
  readonly channel: RTCDataChannel;
  private negotiated: Promise<void>;

  constructor(handlers: PeerHandlers) {
    super(handlers);
    this.channel = createChannel(this.pc, "input");
    this.wire(this.channel);
    this.negotiated = (async () => {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      if (this.disposed) return;
      this.handlers.onLocalSdp(JSON.stringify(this.pc.localDescription));
    })();
  }

  async acceptRemoteSdp(json: string) {
    await this.negotiated.catch(() => undefined);
    if (this.disposed || this.remoteDescSet) return;
    try {
      await this.setRemote(JSON.parse(json) as RTCSessionDescriptionInit);
    } catch {
      /* malformed or out-of-date description */
    }
  }

  sendFrame(frame: InputFrame) {
    return this.send({ k: "i", f: frame }, this.channel);
  }
}

/** Controller side. Waits for the offer, answers, and adopts the channel. */
export class ControllerLink extends PeerBase {
  private channel: RTCDataChannel | null = null;

  constructor(handlers: PeerHandlers) {
    super(handlers);
    this.pc.ondatachannel = (event) => {
      if (this.channel) return;
      this.channel = event.channel;
      this.wire(this.channel);
      if (this.channel.readyState === "open") this.handlers.onOpen?.();
    };
  }

  get isOpen() {
    return this.channel?.readyState === "open";
  }

  async acceptRemoteSdp(json: string) {
    if (this.disposed || this.remoteDescSet) return;
    let offer: RTCSessionDescriptionInit;
    try {
      offer = JSON.parse(json) as RTCSessionDescriptionInit;
    } catch {
      return;
    }
    await this.setRemote(offer).catch(() => undefined);
    if (this.disposed) return;
    try {
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      if (this.disposed) return;
      this.handlers.onLocalSdp(JSON.stringify(this.pc.localDescription));
    } catch {
      /* renegotiation failure — the relay fallback covers it */
    }
  }

  sendFrame(frame: InputFrame) {
    if (!this.channel) return false;
    return this.send({ k: "i", f: frame }, this.channel);
  }

  sendPing(sentAt: number) {
    if (!this.channel) return false;
    return this.send({ k: "p", t: sentAt }, this.channel);
  }
}
