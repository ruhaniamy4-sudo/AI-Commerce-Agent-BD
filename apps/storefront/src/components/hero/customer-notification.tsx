"use client";

import Image from "next/image";
import { Globe2 } from "lucide-react";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import {
  CHANNEL_NAMES,
  INQUIRIES,
  NOTIFICATION_CYCLE,
  NOTIFICATION_TRACKS,
  PREVIEW_EASE,
  PRODUCT_IMAGE,
  type Channel,
} from "./preview-timeline";

export function ChannelIcon({ channel }: { channel: Channel }) {
  return (
    <span className={`sales-channel-icon ${channel}`} aria-hidden="true">
      {channel === "website" ? (
        <Globe2 />
      ) : channel === "messenger" ? (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.4 2 2 6.1 2 11.3c0 2.9 1.4 5.4 3.7 7.1V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.6 0 10-4.1 10-9.3S17.6 2 12 2Z" />
          <path
            d="m5.5 14 5.2-5.5 3.1 2.4 4.7-2.4-5.2 5.6-3.1-2.5Z"
            fill="#3689ff"
          />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.3-4.8A8.5 8.5 0 1 1 20.5 11.7Z" />
          <path
            d="m8.3 7.5 1.5 2.7-1 1.1c.7 1.5 1.7 2.5 3.3 3.2l1.1-1 2.8 1.5c-.2 1.3-1.2 2-2.4 1.7-3.9-.8-7.1-4-7.8-7.1-.2-1.2.9-2.1 2.5-2.1Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      )}
    </span>
  );
}

export function CustomerNotification({
  index,
  elapsed,
  reduced,
}: {
  index: number;
  elapsed: number;
  reduced: boolean;
}) {
  const track = NOTIFICATION_TRACKS[index];
  const localTime = Math.max(0, elapsed - track.delay);
  const pass = Math.floor(localTime / NOTIFICATION_CYCLE);
  const item =
    INQUIRIES[(pass * NOTIFICATION_TRACKS.length + index) % INQUIRIES.length];
  const departing =
    !reduced && localTime % NOTIFICATION_CYCLE >= NOTIFICATION_CYCLE - 600;
  const arrived = reduced || elapsed >= track.delay;

  return (
    <div
      className={`sales-notification-track track-${index}`}
      data-channel={item.channel}
    >
      {arrived && (
        <motion.div
          key={item.name}
          className="sales-notification-arrival"
          initial={
            reduced
              ? false
              : { opacity: 0, x: track.from[0], y: track.from[1], scale: 0.94 }
          }
          animate={
            departing
              ? { opacity: 0, x: track.to[0], y: track.to[1], scale: 0.94 }
              : { opacity: 1, x: 0, y: 0, scale: 1 }
          }
          transition={{
            duration: reduced ? 0 : departing ? 0.5 : 0.65,
            ease: PREVIEW_EASE,
          }}
        >
          <div
            className="sales-notification"
            style={{ "--drift-delay": `${index * -0.8}s` } as CSSProperties}
            title={`${CHANNEL_NAMES[item.channel]}: ${item.name}`}
          >
            <span className={`sales-customer-avatar ${item.avatar}`}>
              {item.name === "Website Visitor" ? (
                <Globe2 size={13} />
              ) : (
                item.name[0]
              )}
              <ChannelIcon channel={item.channel} />
            </span>
            <div className="sales-notification-text">
              <strong>
                {item.name}
                <span>now</span>
              </strong>
              <p>{item.message}</p>
            </div>
            {item.image && (
              <Image
                className="sales-notification-product"
                src={PRODUCT_IMAGE}
                alt=""
                width={24}
                height={24}
                sizes="24px"
              />
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
