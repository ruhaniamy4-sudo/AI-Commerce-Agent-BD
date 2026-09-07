"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BatteryFull,
  Bot,
  Check,
  CheckCheck,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  ShoppingBag,
  Signal,
  Sparkles,
  Wifi,
} from "lucide-react";
import { ChannelIcon } from "./customer-notification";
import { PHONE_BEATS, PREVIEW_EASE, PRODUCT_IMAGE } from "./preview-timeline";

function PhoneBeat({
  at,
  time,
  reduced,
  className,
  children,
}: {
  at: number;
  time: number;
  reduced: boolean;
  className: string;
  children: ReactNode;
}) {
  const shown = reduced || time >= at;
  return (
    <motion.div
      className={className}
      initial={false}
      data-beat={at}
      data-visible={shown}
      animate={{ opacity: shown ? 1 : 0, y: shown || reduced ? 0 : 8 }}
      transition={{ duration: reduced ? 0 : 0.35, ease: PREVIEW_EASE }}
    >
      {children}
    </motion.div>
  );
}

export function SalesPhone({
  time,
  reduced,
}: {
  time: number;
  reduced: boolean;
}) {
  const answering = reduced || time >= PHONE_BEATS.reply;
  return (
    <div className="sales-phone-float">
      <div className="sales-phone">
        <div className="sales-phone-screen">
          <div className="sales-phone-status">
            <span>9:41</span>
            <i />
            <div>
              <Signal />
              <Wifi />
              <BatteryFull />
            </div>
          </div>
          <header className="sales-phone-header">
            <ChevronLeft size={18} />
            <span className="sales-agent-avatar">
              <Bot size={21} />
            </span>
            <div>
              <strong>SellPilot</strong>
              <small>
                <i /> Your AI sales agent
              </small>
            </div>
            <MoreHorizontal size={18} />
          </header>
          <div className="sales-phone-channel">
            <ChannelIcon channel="messenger" /> Messenger conversation{" "}
            <ShieldCheck size={11} />
          </div>
          <div className="sales-phone-thread">
            <p className="sales-thread-date">TODAY, 9:41 AM</p>
            <div className="sales-bubble customer">
              <Image
                src={PRODUCT_IMAGE}
                alt=""
                width={34}
                height={34}
                sizes="34px"
                preload
              />
              <p>
                Ei sneaker ta ache?
                <small>
                  9:41 <CheckCheck size={11} />
                </small>
              </p>
            </div>
            <div className="sales-agent-label">
              <Sparkles size={10} /> SELLPILOT AI
            </div>
            <div className="sales-phone-answer">
              {!answering && (
                <div className="sales-typing">
                  <i />
                  <i />
                  <i />
                  <span>
                    {time >= PHONE_BEATS.understand
                      ? "Checking products & stock"
                      : "Understanding the question"}
                  </span>
                </div>
              )}
              <PhoneBeat
                at={PHONE_BEATS.reply}
                time={time}
                reduced={reduced}
                className="sales-bubble agent"
              >
                Ji, available! Daily use er jonno perfect.{" "}
                <span className="sales-bubble-time">9:41</span>
              </PhoneBeat>
            </div>
            <PhoneBeat
              at={PHONE_BEATS.recommend}
              time={time}
              reduced={reduced}
              className="sales-phone-product"
            >
              <div className="sales-product-photo">
                <Image
                  src={PRODUCT_IMAGE}
                  alt=""
                  width={85}
                  height={65}
                  sizes="85px"
                />
              </div>
              <div>
                <span>RECOMMENDED FOR YOU</span>
                <strong>Everyday sneaker</strong>
                <p>
                  ৳2,490 <span>In stock</span>
                </p>
              </div>
            </PhoneBeat>
            <PhoneBeat
              at={PHONE_BEATS.intent}
              time={time}
              reduced={reduced}
              className="sales-bubble customer small"
            >
              Size 42. COD e order korbo!
              <small>
                9:41 <CheckCheck size={11} />
              </small>
            </PhoneBeat>
            <PhoneBeat
              at={PHONE_BEATS.details}
              time={time}
              reduced={reduced}
              className="sales-bubble agent"
            >
              Naam, number ar address ta diben?
            </PhoneBeat>
            <PhoneBeat
              at={PHONE_BEATS.order}
              time={time}
              reduced={reduced}
              className="sales-order-started"
            >
              <span>
                <ShoppingBag size={14} />
              </span>
              <div>
                <strong>
                  Order started <Check size={10} />
                </strong>
                <small>Everyday sneaker · Size 42 · COD</small>
              </div>
            </PhoneBeat>
          </div>
          <div className="sales-phone-composer">
            <Plus size={15} />
            <span>Message SellPilot…</span>
            <i>
              <Send size={13} />
            </i>
          </div>
          <div className="sales-phone-home-bar" />
        </div>
      </div>
    </div>
  );
}
