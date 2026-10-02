import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

/** A single controller snapshot. Sent as a whole frame so packets stay
 * order-independent and can ride either the peer channel or the relay. */
export const inputFrameValidator = v.object({
  seq: v.number(),
  /** button bitmask, see BUTTON_ORDER in src/lib/controller.ts */
  b: v.number(),
  /** left stick, -127 .. 127 */
  lx: v.number(),
  ly: v.number(),
  /** right stick, -127 .. 127 */
  rx: v.number(),
  ry: v.number(),
  /** analog triggers, 0 .. 255 */
  lt: v.number(),
  rt: v.number(),
  /** tilt / gyroscope, -127 .. 127 */
  gx: v.number(),
  gy: v.number(),
  /** sender clock, ms */
  t: v.number(),
});
export type InputFrame = Infer<typeof inputFrameValidator>;

export const heartbeatValidator = v.object({
  /** receiver clock, ms — used for staleness */
  at: v.number(),
  /** measured round trip, ms */
  rtt: v.number(),
});

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // A pairing room. The receiver (PC) creates it, the controller (phone)
    // joins with the 4 character code. The same document doubles as the
    // WebRTC signalling channel and as the fallback input relay.
    rooms: defineTable({
      code: v.string(),
      ownerId: v.optional(v.string()),
      status: v.union(
        v.literal("waiting"),
        v.literal("live"),
        v.literal("closed"),
      ),
      hostId: v.string(),
      hostSDP: v.optional(v.string()),
      hostCandidates: v.optional(v.array(v.string())),

      controllerId: v.optional(v.string()),
      controllerLabel: v.optional(v.string()),
      controllerSDP: v.optional(v.string()),
      controllerCandidates: v.optional(v.array(v.string())),

      /** "rtc" = peer channel, "relay" = routed through Convex */
      transport: v.optional(
        v.union(v.literal("rtc"), v.literal("relay")),
      ),
      /** fallback input relay target */
      lastInput: v.optional(inputFrameValidator),
      heartbeat: v.optional(heartbeatValidator),

      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_owner", ["ownerId"])
      .index("by_status", ["status"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
