Full Development Prompt: AI Agent + Full F-Commerce Platform (Computer Accessories)
0) Context
Build a production-ready Facebook Page–connected commerce platform for selling computer accessories, where the primary customer journey happens inside Facebook Messenger (with future option to support Instagram messaging). The system includes:

A complete e-commerce backend + admin dashboard
A public web storefront (Next.js)
A Facebook webhook receiver + message sender
A grounded AI agent that answers and sells using trusted business data only
A Knowledge Adding feature (must-have) for admins to add/edit knowledge used by the AI

1) Tech Stack (Required)
Frontend: Next.js (App Router), TypeScript
Admin Dashboard: Next.js + TypeScript (RBAC protected)
Backend API: Node.js + Express + TypeScript
DB: MongoDB + Mongoose
AI: OpenAI (text + vision)
Facebook Integration: Facebook Graph API + Messenger Webhooks
Webhooks/Queue: BullMQ + Redis (recommended for reliability + speed)
Auth: JWT (access + refresh), RBAC
Storage: S3-compatible (or local dev storage) for product images
Deployment: Docker-ready, environment-based config

2) Product Vision
Build a Facebook Page–connected commerce platform where customers:
ask product questions (text + images),
get accurate responses grounded in catalog + policies + history,
place orders conversationally,
track delivery/returns,
switch languages freely.
Admins manage:
products, inventory, orders, customers,
conversation inbox and escalations,
agent settings & knowledge base (without redeploy).

3) Core Roles
A) Customer (Messenger user)
Browse products via chat
Ask questions using text and images
Place orders and receive order ID
Track order status
Warranty/return support
Multi-language support

B) Admin / Support Agent
Manage catalog (products/variants/stock/pricing/warranty)
Manage orders and statuses
Conversation inbox + history
Policies/FAQ and AI settings
Analytics dashboard

C) Optional Staff Roles
Inventory Manager
Fulfillment Staff
Customer Support

4) MUST-HAVE Requirement: Knowledge Adding Feature (Knowledge Base Management)
4.1 Goal
Admins must be able to add and maintain AI-usable knowledge in a controlled way so the AI agent can answer questions accurately without hallucinating.

4.2 What counts as “knowledge”?
Policies (delivery/returns/warranty/payment)
FAQs
Compatibility guidance (e.g., RAM types, SSD sizes, laptop brand notes)
Troubleshooting scripts (e.g., “cable doesn’t fit port”)
Shipping zone rules explanations
Brand-specific warranty terms
Escalation rules / special handling notes

4.3 Knowledge Adding UI (Admin Dashboard)
Create a module: Knowledge Base
CRUD knowledge entries
Each knowledge entry has:
title
content (rich text or markdown)
type (FAQ | POLICY | GUIDE | TROUBLESHOOT | COMPATIBILITY)
language (en, bn, hi optional)
tags[] (used for retrieval)
status (active/inactive)
sourcePriority (optional: high/normal/low)
createdBy, updatedBy, timestamps
Must support:
Search + filter by type/language/tags/status
Version history (simple versioning is OK: store last N revisions)
Preview rendering
“Pin as critical policy” flag (optional)

4.4 Knowledge Retrieval Rules
Before calling OpenAI for responses:
Always retrieve relevant policies_faq and knowledge_base entries using:
tag matching,
keyword/text search,
optionally embeddings later.
The AI must only answer using retrieved knowledge + catalog + customer/order data.
4.5 Knowledge Safety Rules
Admin changes should take effect immediately without redeploy
The AI must never invent policy terms
If knowledge is missing, the AI asks follow-up questions or escalates
✅ This fulfills: “I need knowledge adding feature, you provide the knowledge adding feature.”

5) Functional Requirements: AI Agent
5.1 Grounded Product Q&A

Must answer using trusted data from DB:

Price, stock, variants

Specs (RAM speed, SSD form factor, ports, etc.)

Compatibility (ask required info like laptop model if needed)

Warranty and returnability

Delivery time and fees by location

Grounding rules

Never guess missing specs.

If missing: ask clarifying question or offer human support.

Responses must reference internal identifiers implicitly (product name + SKU).

5.2 Compare + Recommend

Compare 2–5 products in chat

Recommend within budget and requirements:

“Best mouse under 2000”

“Best SSD for gaming laptop”

5.3 Conversational Checkout (Order Taking)

Flows:

Add items:

“Add 2 of that keyboard”

“Add mouse in black”

Collect required fields:

name, phone, address (structured), city/zone, payment method, optional note

Confirm summary:

items, qty, price, delivery fee, total, ETA

Validate:

stock check before confirmation

lock price snapshot at order time

Save order in MongoDB:

return order ID and tracking steps

Post-order automation:

confirmation message

dashboard notification

optional status updates on status change

5.4 Image Understanding (Vision)

When user sends image:

Identify category/model clues:

DDR4 vs DDR5, cable type, port type

Match to catalog:

return best match or top 3 + clarifying questions

Troubleshooting based on image

Safety:

If unclear, ask for clearer photo (front/back/label/closeup)

Must not claim certainty if low confidence

Use internal confidence threshold logic

5.5 Multilingual Support

Auto-detect language

Manual switching:

“Speak Bangla”, “English please”

Product names remain consistent

Policies must not drift in meaning

Store user preferred language in DB

5.6 Human Handoff (Escalation)

Triggers:

low confidence

angry sentiment / complaints

warranty complexity

explicit “human/agent/support”

Handoff:

tag conversation “Needs Human”

notify dashboard

optional “AI suggestion mode” (AI drafts, human sends)

6) Functional Requirements: Full E-commerce Platform
6.1 Product Catalog

Products, categories, variants, images

Specs builder (key/value)

Compatibility tags (DDR4, NVMe, USB-C, M.2 2280, etc.)

Bulk import/export CSV

6.2 Inventory

Stock adjustments

Low-stock alerts

Optional reservation when order created

6.3 Orders & Fulfillment

Status flow:

Pending → Confirmed → Packed → Shipped → Delivered → Completed

Cancelled / Returned / Refunded

Delivery fee rules:

by city/zone or order total

Optional PDF invoice

6.4 Customers (CRM-lite)

PSID, name, phone, language

addresses, order history

tags/notes (VIP, frequent buyer)

6.5 Promotions

coupon codes

bundles

product/category discounts

6.6 Content & Policies

policies pages

FAQ editor (feeds AI retrieval)

optional announcement banners

7) Facebook Integration Requirements
7.1 Setup

Messenger Webhook verify (GET /webhook)

Receive events (POST /webhook)

Store page tokens encrypted

Permissions: pages_messaging, pages_manage_metadata (as needed)

7.2 Webhook Handling

Handle:

messages (text + attachments)

postbacks

optins (optional)

delivery/read receipts (optional)

7.3 Message Sending

quick replies + buttons

product carousel template (generic template)

rate limit + retry

8) AI System Architecture
8.1 Pipeline (Must)

Webhook receives message

Identify customer + fetch conversation context

Intent detection:

product inquiry / order / status / return / handoff

Retrieve relevant facts:

catalog matches

knowledge base (policies/faq/guides)

customer history + last orders

last N messages

Build “Context Pack”

Call OpenAI with strict system prompt

Validate output:

language correct

no hallucinated specs

Send response + log conversation

If action says create order / handoff → trigger workflow

8.2 Retrieval (RAG)

Start with:

MongoDB text indexes

Tag matching
Future:

embeddings + vector search (Atlas)

8.3 Guardrails

“No guessing” rule

Price integrity from DB

Compatibility asks for required device model info

Minimal sensitive info collection

8.4 Memory Rules

Short-term: last N messages + current intent

Long-term: language preference, brands, categories

Opt-out: “Don’t save my info”

9) Data Models (MongoDB/Mongoose)

Implement at minimum:

products

categories

customers

carts (optional)

orders

conversations

policies_faq (or unified knowledge_base)

agent_settings

webhook_events (idempotency)

Include snapshots:

unitPriceSnapshot in order items

shippingAddressSnapshot in order

10) Admin Dashboard Requirements

Modules:

Overview KPIs

Products CRUD + bulk import

Inventory + adjustments

Orders list/kanban + status update + invoice

Customers CRM

Conversations inbox with:

live thread view

customer sidebar

assign to staff

AI on/off toggle per conversation

AI suggestions mode

Knowledge Base (the knowledge adding feature)

AI Agent Settings:

tone, supported languages, escalation thresholds

Promotions/Coupons

Staff & Roles RBAC

Analytics

11) API Requirements (Express)

Implement endpoints (TypeScript):

Auth:

POST /auth/login

POST /auth/refresh

Products:

GET /products

POST /products

PUT /products/:id

DELETE /products/:id

Orders:

GET /orders

POST /orders

PUT /orders/:id/status

Customers:

GET /customers

GET /customers/:id

Conversations:

GET /conversations

GET /conversations/:id

Knowledge Base / Policies:

CRUD endpoints

AI internal:

POST /ai/reply

POST /ai/vision-match

Facebook Webhook:

GET /webhook

POST /webhook

Webhook processing:

verify signature

store event for dedupe

push to queue

respond 200 quickly

12) OpenAI Prompting Contract (Strict)

The AI call must use:

System prompt: “Only answer from provided context pack”

Provide Context Pack as structured content:

catalog hits

knowledge entries

customer profile

last N messages

Require structured output JSON:

{
  "language": "en",
  "message_text": "…",
  "quick_replies": ["View variants", "Buy now", "Talk to human"],
  "suggested_products": [{"sku":"", "name":"", "variantId":""}],
  "action": "none",
  "action_payload": {}
}


Allowed actions:

none

create_order

handoff

ask_clarification

13) Non-Functional Requirements

Webhook ack < 2s

AI response target < 6–10s (async worker ok)

Catalog search typical < 200ms

Retry + idempotency for events

Security:

encrypt tokens and OpenAI key

webhook signature verify

RBAC

audit logs

Privacy:

store only needed customer info

deletion request tooling

14) Deliverables (What to Build)
A) Repos / Apps

apps/admin (Next.js dashboard)

apps/storefront (Next.js public store)

apps/api (Express backend)

apps/worker (BullMQ worker)

shared package: packages/shared (types, schemas)

B) Key Screens

Admin:

Products list + editor

Inventory adjustment

Orders board

Customers profiles

Conversations inbox

Agent settings

Knowledge base CRUD

Storefront:

Listing + search/filter

Product details + variants

Cart + checkout

Order tracking page

Policies pages

C) Logging/Analytics

conversation logs

order conversions

top searched products

escalation rate

15) Acceptance Criteria (“Done”)

AI Chat:

accurate price/stock/specs from DB

no invented specs

supports English + Bangla (+ optional Hindi)

image questions produce matches or clarifying questions

Orders:

orders created fully from chat with required fields

stock validation enforced

status updates sent to customer

Dashboard:

CRUD catalog works

conversation inbox works

AI settings + knowledge base editable without redeploy

Facebook:

webhook stable + dedupe

send messages with buttons/templates

16) Implementation Guidance (Practical)

Use BullMQ worker for AI processing

Always dedupe events (webhook_events)

Start with MongoDB text search; upgrade to vector later

Price snapshots in orders are mandatory

Knowledge Base retrieval must always run before AI calls
