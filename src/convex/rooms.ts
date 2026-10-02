import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { inputFrameValidator } from "./schema";

/** Alphabet without 0/O, 1/I so a code read off one screen to another never trips. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;

const codeArg = v.object({ code: v.string() });

async function normalize(ctx: QueryCtx, raw: string) {
  const code = raw.trim().toUpperCase();
  const doc = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
  return { code, doc };
}

async function randomCode(ctx: QueryCtx) {
  for (let attempt = 0; attempt < 24; attempt++) {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    const taken = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!taken || taken.status === "closed") return code;
  }
  throw new Error("Could not allocate a room code");
}

/** Receiver opens a room and gets back a code to type into the phone. */
export const create = mutation({
  args: {
    hostId: v.string(),
    ownerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const code = await randomCode(ctx);
    await ctx.db.insert("rooms", {
      code,
      ownerId: args.ownerId,
      status: "waiting",
      hostId: args.hostId,
      createdAt: now,
      updatedAt: now,
    });
    return code;
  },
});

/** Reactive room document — drives both the signalling handshake and the UI. */
export const byCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { doc } = await normalize(ctx, code);
    return doc;
  },
});

/** The console's own still-open room, so a page reload keeps the pairing. */
export const activeForOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const open = await ctx.db
      .query("rooms")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .filter((q) => q.neq(q.field("status"), "closed"))
      .collect();
    open.sort((a, b) => b.createdAt - a.createdAt);
    return open[0] ?? null;
  },
});

/** After a reload the console takes its room back with a fresh host session,
 *  wiping the previous peer handshake while keeping the paired controller. */
export const reclaim = mutation({
  args: { code: v.string(), ownerId: v.string(), hostId: v.string() },
  handler: async (ctx, { code, ownerId, hostId }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) throw new Error("No room with that code");
    if (doc.status === "closed") throw new Error("That room is closed");
    if (doc.ownerId !== ownerId) {
      throw new Error("That room belongs to another console");
    }
    await ctx.db.patch(doc._id, {
      hostId,
      hostSDP: undefined,
      hostCandidates: undefined,
      controllerSDP: undefined,
      controllerCandidates: undefined,
      transport: undefined,
      lastInput: undefined,
      heartbeat: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** The controller claims the room with the shared code. */
export const join = mutation({
  args: {
    code: v.string(),
    controllerId: v.string(),
    controllerLabel: v.optional(v.string()),
  },
  handler: async (ctx, { code, controllerId, controllerLabel }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) throw new Error("No room with that code");
    if (doc.status === "closed") throw new Error("That room is closed");
    // Only one phone drives the pad — unless the current one went quiet.
    if (doc.controllerId && doc.controllerId !== controllerId) {
      const lastActivity = Math.max(doc.heartbeat?.at ?? 0, doc.updatedAt);
      if (Date.now() - lastActivity < 15_000) {
        throw new Error("That room already has a controller");
      }
    }
    await ctx.db.patch(doc._id, {
      controllerId,
      controllerLabel,
      status: "live",
      updatedAt: Date.now(),
    });
  },
});

export const setHostSdp = mutation({
  args: { code: v.string(), hostId: v.string(), sdp: v.string() },
  handler: async (ctx, { code, hostId, sdp }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc || doc.hostId !== hostId) return;
    await ctx.db.patch(doc._id, { hostSDP: sdp, updatedAt: Date.now() });
  },
});

export const setControllerSdp = mutation({
  args: { code: v.string(), controllerId: v.string(), sdp: v.string() },
  handler: async (ctx, { code, controllerId, sdp }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc || doc.controllerId !== controllerId) return;
    await ctx.db.patch(doc._id, {
      controllerSDP: sdp,
      updatedAt: Date.now(),
    });
  },
});

export const addHostCandidate = mutation({
  args: { code: v.string(), candidate: v.string() },
  handler: async (ctx, { code, candidate }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) return;
    await ctx.db.patch(doc._id, {
      hostCandidates: [...(doc.hostCandidates ?? []), candidate],
      updatedAt: Date.now(),
    });
  },
});

export const addControllerCandidate = mutation({
  args: { code: v.string(), candidate: v.string() },
  handler: async (ctx, { code, candidate }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) return;
    await ctx.db.patch(doc._id, {
      controllerCandidates: [...(doc.controllerCandidates ?? []), candidate],
      updatedAt: Date.now(),
    });
  },
});

/** Flipped by the controller when the peer channel could not be established. */
export const setTransport = mutation({
  args: {
    code: v.string(),
    transport: v.union(v.literal("rtc"), v.literal("relay")),
  },
  handler: async (ctx, { code, transport }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) return;
    await ctx.db.patch(doc._id, { transport, updatedAt: Date.now() });
  },
});

/** Fallback path: one snapshot written per frame, read reactively by the host. */
export const relay = mutation({
  args: { code: v.string(), controllerId: v.string(), frame: inputFrameValidator },
  handler: async (ctx, { code, controllerId, frame }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc || doc.controllerId !== controllerId) return;
    await ctx.db.patch(doc._id, { lastInput: frame, updatedAt: Date.now() });
  },
});

/** Cheap liveness + measured round trip from the controller. */
export const beat = mutation({
  args: { code: v.string(), rtt: v.number() },
  handler: async (ctx, { code, rtt }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) return;
    await ctx.db.patch(doc._id, {
      heartbeat: { at: Date.now(), rtt },
      updatedAt: Date.now(),
    });
  },
});

export const close = mutation({
  args: codeArg,
  handler: async (ctx, { code }) => {
    const { doc } = await normalize(ctx, code);
    if (!doc) return;
    await ctx.db.patch(doc._id, { status: "closed", updatedAt: Date.now() });
  },
});
