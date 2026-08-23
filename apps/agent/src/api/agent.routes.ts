import { Router } from "express";
import { startAgent, stopAgent, getAgentStatus, getLastHumanActivity } from "../services/agentManager";

const router = Router();

router.post("/start", async (_, res) => {
    await startAgent();
    res.json({ success: true });
});

router.post("/stop", async (_, res) => {
    await stopAgent();
    res.json({ success: true });
});

router.get("/status", async (_, res) => {
    const status = await getAgentStatus();
    const lastActivity = await getLastHumanActivity();

    res.json({
        status,
        lastActivity: new Date(lastActivity).toISOString(),
        autoStartRule: {
            enabled: true,
            inactivityMinutes: 5,
        },
    });
});

export default router;
