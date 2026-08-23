import { Router } from 'express';
import { requireAdministrator } from '../auth/middleware';
import {
    configureSteadfastIntegration,
    CourierOperationError,
    disconnectSteadfastIntegration,
    getSteadfastIntegrationStatus,
    testSteadfastIntegration,
} from '../courier/courier.service';

const router = Router();

function sendCourierError(res: any, error: unknown) {
    const known = error instanceof CourierOperationError;
    return res.status(known ? error.statusCode : 500).json({
        error: known ? error.message : 'Courier integration operation failed',
        code: known ? error.code : 'courier_operation_failed',
    });
}

router.get('/courier-integrations/steadfast', requireAdministrator, async (_req, res) => {
    try {
        res.json(await getSteadfastIntegrationStatus());
    } catch (error) {
        sendCourierError(res, error);
    }
});

async function saveCredentials(req: any, res: any) {
    try {
        const deliveryType = req.body.deliveryType === 1 ? 1 : 0;
        res.json(await configureSteadfastIntegration({
            apiKey: req.body.apiKey,
            secretKey: req.body.secretKey,
            deliveryType,
        }));
    } catch (error) {
        sendCourierError(res, error);
    }
}

router.post('/courier-integrations/steadfast', requireAdministrator, saveCredentials);
router.put('/courier-integrations/steadfast', requireAdministrator, saveCredentials);

router.post('/courier-integrations/steadfast/test', requireAdministrator, async (_req, res) => {
    try {
        res.json(await testSteadfastIntegration());
    } catch (error) {
        sendCourierError(res, error);
    }
});

router.delete('/courier-integrations/steadfast', requireAdministrator, async (_req, res) => {
    try {
        res.json(await disconnectSteadfastIntegration());
    } catch (error) {
        sendCourierError(res, error);
    }
});

export default router;
