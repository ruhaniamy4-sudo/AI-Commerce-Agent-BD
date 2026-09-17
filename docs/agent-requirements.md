## Edutechs Client Communication AI Agent System

### Overview

Edutechs Client Communication AI Agent System is a

### Features

- Chat with client
- Add client in DB
- Set meeting schedule on calender
- Provide neccessary information to client
  - About Edutechs
  - About Edutechs features
  - About Edutechs pricing
  - About Edutechs contact
  - About Edutechs location
  - About Edutechs working hours
  - Demo video
  - Demo link
- Agent start and stop control
- Agent status tracking
- Agent time deily set -> If human not active for 5 min then agent will start
- Memorize permanently Human conversation

### Project Structure

src/
├── agent/
│ ├── agent.ts
│ ├── graph.ts
│ ├── state.ts
│ └── prompts.ts
│
├── tools/
│ ├── clientDb.tool.ts
│ ├── calendar.tool.ts
│ ├── knowledge.tool.ts
│ └── demo.tool.ts
│
├── services/
│ ├── agentManager.ts
│ └── idleWatcher.ts
│
├── routes/
│ ├── chat.routes.ts
│ └── agent.routes.ts
│
├── utils/
│ └── redis.ts
│
└── server.ts

### Core Tech Stack
Express Js For Backend
MongoDB for Database
AI Agent Layer
LangChain → tool calling, chat, memory
LangGraph → agent lifecycle & control
OpenAI GPT-5.2



## APIs
